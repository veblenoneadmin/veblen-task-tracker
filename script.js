// Configuration
const CONFIG = {
    n8nWebhookUrl: '/api/task-action',
    sheetsApiUrl: '/api/sheets',
    imgbbApiKey: 'YOUR_IMGBB_API_KEY' // Replace with your actual ImgBB API key
};

// State Management
let currentEmployee = null;
let activeTask = null;
let timerInterval = null;
let elapsedSeconds = 0;
let workSessions = []; // Track work sessions

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Load saved employee
    const savedEmployee = localStorage.getItem('selectedEmployee');
    if (savedEmployee) {
        document.getElementById('employeeSelect').value = savedEmployee;
        currentEmployee = savedEmployee;
        loadEmployeeData();
    }

    // Set up event listeners
    document.getElementById('employeeSelect').addEventListener('change', handleEmployeeChange);
    document.getElementById('newTaskForm').addEventListener('submit', handleStartTask);
    document.getElementById('pauseTaskBtn').addEventListener('click', handlePauseTask);
    document.getElementById('completeTaskBtn').addEventListener('click', handleCompleteTask);
    document.getElementById('refreshTasksBtn').addEventListener('click', loadAssignedTasks);
    document.getElementById('dailyReportForm').addEventListener('submit', handleDailyReport);
    document.getElementById('statusUpdateForm').addEventListener('submit', handleStatusUpdate);
    document.getElementById('refreshSummaryBtn').addEventListener('click', loadTodaySummary);
    
    // Time clock buttons
    document.getElementById('startWorkBtn').addEventListener('click', () => handleTimeClock('🟢 START WORK'));
    document.getElementById('breakBtn').addEventListener('click', () => handleTimeClock('☕ BREAK'));
    document.getElementById('backToWorkBtn').addEventListener('click', () => handleTimeClock('🔵 BACK TO WORK'));
    document.getElementById('endWorkBtn').addEventListener('click', () => handleTimeClock('🔴 END WORK'));

    // Image upload
    document.getElementById('taskImage').addEventListener('change', handleImagePreview);

    // Check for crashed session
    checkForCrashedSession();
}

// Handle employee selection
function handleEmployeeChange(e) {
    currentEmployee = e.target.value;
    localStorage.setItem('selectedEmployee', currentEmployee);
    
    if (currentEmployee) {
        loadEmployeeData();
    } else {
        clearEmployeeData();
    }
}

// Load employee-specific data
async function loadEmployeeData() {
    if (!currentEmployee) return;
    
    // Check for active task
    await checkActiveTask();
    
    // Load assigned tasks
    await loadAssignedTasks();
    
    // Load today's summary
    await loadTodaySummary();
}

// Clear employee data
function clearEmployeeData() {
    document.getElementById('activeTaskDisplay').style.display = 'none';
    document.getElementById('assignedTasksList').innerHTML = '<p class="loading">Select an employee to view assigned tasks...</p>';
    document.getElementById('todaySummary').innerHTML = '<p class="loading">Select an employee to view summary...</p>';
}

// Check for active task
async function checkActiveTask() {
    try {
        const response = await fetch(CONFIG.n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'get_active_task',
                employee: currentEmployee
            })
        });

        const data = await response.json();
        
        if (data.success && data.data.active_task) {
            activeTask = data.data.active_task;
            workSessions = parseWorkSessions(activeTask.description || '');
            showActiveTask();
            startTimer();
        } else {
            hideActiveTask();
        }
    } catch (error) {
        console.error('Error checking active task:', error);
        showToast('Error checking active task', 'error');
    }
}

// Parse work sessions from description
function parseWorkSessions(description) {
    const sessions = [];
    const lines = description.split('\n');
    
    lines.forEach(line => {
        if (line.includes('Time worked:')) {
            const dateMatch = line.match(/\[(\d{4}-\d{2}-\d{2})\]/);
            const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
            
            const timeRanges = line.match(/\d{2}:\d{2}/g);
            if (timeRanges) {
                for (let i = 0; i < timeRanges.length; i += 2) {
                    if (timeRanges[i + 1]) {
                        sessions.push({
                            date: date,
                            start: timeRanges[i],
                            end: timeRanges[i + 1]
                        });
                    }
                }
            }
        }
    });
    
    return sessions;
}

// Format work sessions for description
function formatWorkSessions() {
    const sessionsByDate = {};
    
    workSessions.forEach(session => {
        if (!sessionsByDate[session.date]) {
            sessionsByDate[session.date] = [];
        }
        sessionsByDate[session.date].push(`${session.start} to ${session.end}`);
    });
    
    let description = activeTask.original_description || '';
    
    Object.entries(sessionsByDate).forEach(([date, times]) => {
        const sessionLine = `\n[${date}] Time worked: ${times.join(', ')}`;
        
        // Check if this date already exists in description
        const datePattern = new RegExp(`\\[${date}\\] Time worked:.*`, 'g');
        if (description.match(datePattern)) {
            description = description.replace(datePattern, sessionLine.trim());
        } else {
            description += sessionLine;
        }
    });
    
    return description.trim();
}

// Handle start task
async function handleStartTask(e) {
    e.preventDefault();
    
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    const formData = {
        action: 'start_task',
        employee: currentEmployee,
        task_name: document.getElementById('taskName').value,
        company: document.getElementById('company').value,
        task_type: document.getElementById('taskType').value,
        description: document.getElementById('description').value,
        timestamp: new Date().toISOString()
    };

    // Handle image upload if present
    const imageFile = document.getElementById('taskImage').files[0];
    if (imageFile) {
        const imageUrl = await uploadToImgBB(imageFile);
        if (imageUrl) {
            formData.description += `\n\nAttached image: ${imageUrl}`;
        }
    }

    try {
        const response = await fetch(CONFIG.n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await response.json();
        
        if (data.success) {
            activeTask = {
                task_id: data.data.task_id,
                task_name: formData.task_name,
                company: formData.company,
                task_type: formData.task_type,
                original_description: formData.description,
                start_time: formData.timestamp,
                elapsed_seconds: 0
            };
            
            // Initialize first work session
            const now = new Date();
            workSessions = [{
                date: now.toISOString().split('T')[0],
                start: now.toTimeString().slice(0, 5),
                end: null
            }];
            
            document.getElementById('newTaskForm').reset();
            document.getElementById('imagePreview').innerHTML = '';
            showActiveTask();
            startTimer();
            showToast('Task started successfully!', 'success');
        } else {
            showToast('Failed to start task', 'error');
        }
    } catch (error) {
        console.error('Error starting task:', error);
        showToast('Error starting task', 'error');
    }
}

// Handle pause task
async function handlePauseTask() {
    if (!activeTask) return;
    
    // Update current session end time
    const now = new Date();
    if (workSessions.length > 0 && !workSessions[workSessions.length - 1].end) {
        workSessions[workSessions.length - 1].end = now.toTimeString().slice(0, 5);
    }
    
    const updatedDescription = formatWorkSessions();
    
    try {
        const response = await fetch(CONFIG.n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'pause_task',
                employee: currentEmployee,
                task_id: activeTask.task_id,
                description: updatedDescription,
                elapsed_seconds: elapsedSeconds,
                timestamp: new Date().toISOString()
            })
        });

        const data = await response.json();
        
        if (data.success) {
            stopTimer();
            hideActiveTask();
            activeTask = null;
            workSessions = [];
            showToast('Task paused successfully!', 'success');
        } else {
            showToast('Failed to pause task', 'error');
        }
    } catch (error) {
        console.error('Error pausing task:', error);
        showToast('Error pausing task', 'error');
    }
}

// Handle complete task
async function handleCompleteTask() {
    if (!activeTask) return;
    
    const completionNotes = prompt('Add completion notes (optional):');
    
    // Update current session end time
    const now = new Date();
    if (workSessions.length > 0 && !workSessions[workSessions.length - 1].end) {
        workSessions[workSessions.length - 1].end = now.toTimeString().slice(0, 5);
    }
    
    let finalDescription = formatWorkSessions();
    if (completionNotes) {
        finalDescription += `\n\nCompletion notes: ${completionNotes}`;
    }
    
    try {
        const response = await fetch(CONFIG.n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'complete_task',
                employee: currentEmployee,
                task_id: activeTask.task_id,
                description: finalDescription,
                elapsed_seconds: elapsedSeconds,
                timestamp: new Date().toISOString()
            })
        });

        const data = await response.json();
        
        if (data.success) {
            stopTimer();
            hideActiveTask();
            activeTask = null;
            workSessions = [];
            showToast('Task completed successfully!', 'success');
            loadAssignedTasks();
            loadTodaySummary();
        } else {
            showToast('Failed to complete task', 'error');
        }
    } catch (error) {
        console.error('Error completing task:', error);
        showToast('Error completing task', 'error');
    }
}

// Resume task (when continuing work after break)
async function resumeTask() {
    if (!activeTask) return;
    
    // Add new work session
    const now = new Date();
    workSessions.push({
        date: now.toISOString().split('T')[0],
        start: now.toTimeString().slice(0, 5),
        end: null
    });
    
    startTimer();
}

// Load assigned tasks
async function loadAssignedTasks() {
    if (!currentEmployee) {
        document.getElementById('assignedTasksList').innerHTML = '<p class="loading">Select an employee to view assigned tasks...</p>';
        return;
    }
    
    try {
        const response = await fetch(CONFIG.n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'get_assigned_tasks',
                employee: currentEmployee
            })
        });

        const data = await response.json();
        
        if (data.success && data.data.tasks) {
            displayAssignedTasks(data.data.tasks);
        } else {
            document.getElementById('assignedTasksList').innerHTML = '<p class="loading">No assigned tasks found.</p>';
        }
    } catch (error) {
        console.error('Error loading assigned tasks:', error);
        showToast('Error loading assigned tasks', 'error');
    }
}

// Display assigned tasks
function displayAssignedTasks(tasks) {
    const container = document.getElementById('assignedTasksList');
    
    if (tasks.length === 0) {
        container.innerHTML = '<p class="loading">No assigned tasks found.</p>';
        return;
    }
    
    container.innerHTML = tasks.map(task => `
        <div class="task-card">
            <h4>${task.task_name}</h4>
            <p><strong>Company:</strong> ${task.company}</p>
            <p><strong>Status:</strong> ${task.current_status}</p>
            <p><strong>Due Date:</strong> ${task.due_date || 'No due date'}</p>
            ${task.description ? `<p><strong>Description:</strong> ${task.description}</p>` : ''}
            <button class="btn btn-primary" onclick="startTaskFromAssigned('${task.intake_task_id}', '${task.task_name}', '${task.company}')">
                Start Working
            </button>
        </div>
    `).join('');
}

// Start task from assigned tasks
window.startTaskFromAssigned = function(taskId, taskName, company) {
    document.getElementById('taskName').value = taskName;
    document.getElementById('company').value = company;
    document.getElementById('taskType').focus();
    
    // Scroll to task form
    document.querySelector('.time-tracker-section').scrollIntoView({ behavior: 'smooth' });
};

// Timer functions
function startTimer() {
    if (timerInterval) return;
    
    const startTime = Date.now() - (elapsedSeconds * 1000);
    
    timerInterval = setInterval(() => {
        elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        updateTimerDisplay();
        
        // Auto-save every 10 seconds
        if (elapsedSeconds % 10 === 0) {
            saveTimerState();
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimerDisplay() {
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    
    const display = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    document.getElementById('timerDisplay').textContent = display;
}

// Save timer state
function saveTimerState() {
    if (!activeTask) return;
    
    const timerState = {
        activeTask: activeTask,
        elapsedSeconds: elapsedSeconds,
        workSessions: workSessions,
        lastSaved: new Date().toISOString()
    };
    
    localStorage.setItem('timerState', JSON.stringify(timerState));
}

// Check for crashed session
async function checkForCrashedSession() {
    const savedState = localStorage.getItem('timerState');
    if (!savedState) return;
    
    try {
        const state = JSON.parse(savedState);
        const lastSaved = new Date(state.lastSaved);
        const now = new Date();
        const timeDiff = (now - lastSaved) / 1000; // seconds
        
        // If more than 30 seconds have passed, consider it a crash
        if (timeDiff > 30) {
            const recover = confirm('A previous session was detected. Would you like to recover it?');
            
            if (recover) {
                activeTask = state.activeTask;
                workSessions = state.workSessions || [];
                elapsedSeconds = state.elapsedSeconds + Math.floor(timeDiff);
                showActiveTask();
                startTimer();
                showToast('Session recovered successfully!', 'success');
            } else {
                localStorage.removeItem('timerState');
            }
        }
    } catch (error) {
        console.error('Error recovering session:', error);
        localStorage.removeItem('timerState');
    }
}

// Show/hide active task
function showActiveTask() {
    document.getElementById('activeTaskDisplay').style.display = 'block';
    document.getElementById('startTaskForm').style.display = 'none';
    
    document.getElementById('currentTaskName').textContent = activeTask.task_name;
    document.getElementById('currentCompany').textContent = activeTask.company;
    document.getElementById('currentTaskType').textContent = activeTask.task_type;
    
    updateTimerDisplay();
}

function hideActiveTask() {
    document.getElementById('activeTaskDisplay').style.display = 'none';
    document.getElementById('startTaskForm').style.display = 'block';
    localStorage.removeItem('timerState');
}

// Handle time clock
async function handleTimeClock(action) {
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    // If going on break or ending work, pause active task
    if ((action === '☕ BREAK' || action === '🔴 END WORK') && activeTask) {
        await handlePauseTask();
    }
    
    // If coming back from break, resume active task
    if (action === '🔵 BACK TO WORK' && activeTask) {
        await resumeTask();
    }
    
    try {
        const response = await fetch(CONFIG.n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'time_clock',
                employee: currentEmployee,
                clock_action: action,
                timestamp: new Date().toISOString()
            })
        });

        const data = await response.json();
        
        if (data.success) {
            showToast(`${action} recorded successfully!`, 'success');
            updateTimeClockStatus(action);
        } else {
            showToast('Failed to record time clock action', 'error');
        }
    } catch (error) {
        console.error('Error recording time clock:', error);
        showToast('Error recording time clock action', 'error');
    }
}

function updateTimeClockStatus(action) {
    const statusDiv = document.getElementById('timeClockStatus');
    const time = new Date().toLocaleTimeString();
    statusDiv.innerHTML = `Last action: ${action} at ${time}`;
}

// Handle daily report
// Handle daily report with photo upload
async function handleDailyReport(e) {
    e.preventDefault();
    
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    // Get photo file
    const photoFile = document.getElementById('reportPhoto').files[0];
    if (!photoFile) {
        showToast('Please upload a photo for the report', 'warning');
        return;
    }
    
    // Upload photo to ImgBB
    showToast('Uploading photo...', 'info');
    const photoUrl = await uploadToImgBB(photoFile);
    
    if (!photoUrl) {
        showToast('Failed to upload photo. Please try again.', 'error');
        return;
    }
    
    const formData = {
        action: 'daily_report',
        employee: currentEmployee,
        photo_url: photoUrl,
        company: document.getElementById('reportCompany').value,
        date: document.getElementById('reportDate').value,
        project_name: document.getElementById('projectName').value,
        num_revisions: parseInt(document.getElementById('numRevisions').value),
        total_time_spent: document.getElementById('totalTimeSpent').value,
        notes: document.getElementById('reportNotes').value,
        links: document.getElementById('reportLinks').value,
        feedback_requests: document.getElementById('feedbackRequests').value,
        timestamp: new Date().toISOString()
    };

    try {
        const response = await fetch(CONFIG.n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await response.json();
        
        if (data.success) {
            document.getElementById('dailyReportForm').reset();
            document.getElementById('reportPhotoPreview').innerHTML = '';
            showToast('Daily report submitted successfully!', 'success');
        } else {
            showToast('Failed to submit daily report', 'error');
        }
    } catch (error) {
        console.error('Error submitting daily report:', error);
        showToast('Error submitting daily report', 'error');
    }
}

// Add photo preview handler for report
document.getElementById('reportPhoto').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const preview = document.getElementById('reportPhotoPreview');
    const reader = new FileReader();
    
    reader.onload = function(e) {
        preview.innerHTML = `
            <img src="${e.target.result}" style="max-width: 200px; max-height: 200px; margin-top: 10px; border-radius: var(--radius-md); border: 2px solid var(--border-color);">
            <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">Photo ready for upload</p>
        `;
    };
    
    reader.readAsDataURL(file);
});

// Set default date to today for report
document.getElementById('reportDate').valueAsDate = new Date();

// Handle status update
async function handleStatusUpdate(e) {
    e.preventDefault();
    
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    const taskSelect = document.getElementById('statusTaskSelect');
    const selectedOption = taskSelect.options[taskSelect.selectedIndex];
    
    const formData = {
        action: 'update_task_status',
        employee: currentEmployee,
        task_id: taskSelect.value,
        master_id: selectedOption.dataset.masterId,
        company_id: selectedOption.dataset.companyId,
        new_status: document.getElementById('newStatus').value,
        company: selectedOption.dataset.company,
        timestamp: new Date().toISOString()
    };

    try {
        const response = await fetch(CONFIG.n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await response.json();
        
        if (data.success) {
            document.getElementById('statusUpdateForm').reset();
            showToast('Task status updated successfully!', 'success');
            loadAssignedTasks();
        } else {
            showToast('Failed to update task status', 'error');
        }
    } catch (error) {
        console.error('Error updating task status:', error);
        showToast('Error updating task status', 'error');
    }
}

// Load today's summary
async function loadTodaySummary() {
    if (!currentEmployee) {
        document.getElementById('todaySummary').innerHTML = '<p class="loading">Select an employee to view summary...</p>';
        return;
    }
    
    try {
        const response = await fetch(CONFIG.n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'today_summary',
                employee: currentEmployee
            })
        });

        const data = await response.json();
        
        if (data.success && data.data) {
            displayTodaySummary(data.data);
        } else {
            document.getElementById('todaySummary').innerHTML = '<p class="loading">No data available for today.</p>';
        }
    } catch (error) {
        console.error('Error loading summary:', error);
        showToast('Error loading today\'s summary', 'error');
    }
}

function displayTodaySummary(summary) {
    const container = document.getElementById('todaySummary');
    
    container.innerHTML = `
        <div class="summary-stats">
            <div class="stat-item">
                <h4>Total Hours</h4>
                <p class="stat-value">${summary.total_hours || 0}</p>
            </div>
            <div class="stat-item">
                <h4>Tasks Completed</h4>
                <p class="stat-value">${summary.tasks_completed || 0}</p>
            </div>
            <div class="stat-item">
                <h4>Active Tasks</h4>
                <p class="stat-value">${summary.active_tasks?.length || 0}</p>
            </div>
        </div>
    `;
}

// Image handling
async function handleImagePreview(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const preview = document.getElementById('imagePreview');
    const reader = new FileReader();
    
    reader.onload = function(e) {
        preview.innerHTML = `
            <img src="${e.target.result}" style="max-width: 200px; max-height: 200px; margin-top: 10px;">
            <p style="font-size: 0.875rem; color: var(--text-secondary);">Image will be uploaded when task starts</p>
        `;
    };
    
    reader.readAsDataURL(file);
}

async function uploadToImgBB(file) {
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${CONFIG.imgbbApiKey}`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            return data.data.display_url;
        } else {
            showToast('Failed to upload image', 'error');
            return null;
        }
    } catch (error) {
        console.error('Error uploading image:', error);
        showToast('Error uploading image', 'error');
        return null;
    }
}

// Toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    const container = document.getElementById('toastContainer');
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (activeTask) {
        saveTimerState();
    }
});
