// Configuration
const CONFIG = {
    n8nWebhookUrl: '/api/task-action',
    sheetsApiUrl: '/api/sheets',
    imgbbApiKey: 'YOUR_IMGBB_API_KEY' // Replace with your actual ImgBB API key
};

// Progress attribute IDs for each company
const PROGRESS_ATTRIBUTES = {
    "CROWN REALITY": "eb943dd8-dd91-4620-a875-59bdeee59a1f",
    "LCMB GROUP": "4cff12df-fc0d-40aa-aade-e52161b37621",
    "NEWTECH TRAILERS": "f78f7f1b-ec1f-4f1b-972b-6931f6925373",
    "VEBLEN (Internal)": "05ba9bd9-6829-4049-8366-a1ec8d9281d4",
    "FLECK GROUP": "2f9594ea-c62d-4a15-b668-0cdf2f9162cd"
};

// Status mappings based on progress
const PROGRESS_STATUS_MAPPING = {
    0: "Project",
    10: "Current Project",
    100: "Project Finished"
};

// State Management
let currentEmployee = null;
let activeTask = null;
let timerInterval = null;
let elapsedSeconds = 0;
let workSessions = []; // Track work sessions
let activeTaskProgress = 0;

// Store loaded tasks globally for access
window.loadedTasks = [];

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

    // Report photo preview
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
            window.loadedTasks = data.data.tasks; // Store tasks globally
            displayAssignedTasks(data.data.tasks);
        } else {
            document.getElementById('assignedTasksList').innerHTML = '<p class="loading">No assigned tasks found.</p>';
        }
    } catch (error) {
        console.error('Error loading assigned tasks:', error);
        showToast('Error loading assigned tasks', 'error');
    }
}

// Display assigned tasks with progress
function displayAssignedTasks(tasks) {
    const container = document.getElementById('assignedTasksList');
    
    if (tasks.length === 0) {
        container.innerHTML = '<p class="loading">No assigned tasks found.</p>';
        return;
    }
    
    container.innerHTML = tasks.map(task => `
        <div class="task-card" data-task-id="${task.intake_task_id}">
            <div class="task-card-header">
                <h4>${task.task_name}</h4>
                <span class="task-status ${getStatusClass(task.current_status)}">${task.current_status}</span>
            </div>
            <p><strong>Company:</strong> ${task.company}</p>
            <p><strong>Due Date:</strong> ${task.due_date || 'No due date'}</p>
            ${task.description ? `<p><strong>Description:</strong> ${task.description}</p>` : ''}
            
            <!-- Progress Bar Section -->
            <div class="progress-section">
                <div class="progress-header">
                    <span class="progress-label">Progress</span>
                    <span class="progress-value">${task.progress || 0}%</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${task.progress || 0}%"></div>
                </div>
                <input type="range" 
                       class="progress-slider" 
                       min="0" 
                       max="100" 
                       value="${task.progress || 0}"
                       data-task-id="${task.intake_task_id}"
                       data-company="${task.company}"
                       onchange="updateTaskProgress(this)">
            </div>
            
            <div class="task-actions">
                <button class="btn btn-primary btn-sm" onclick="startTaskFromAssigned('${task.intake_task_id}', '${task.task_name}', '${task.company}')">
                    🚀 Start Working
                </button>
                <button class="btn btn-secondary btn-sm" onclick="openTaskEditor('${task.intake_task_id}')">
                    ✏️ Edit Task
                </button>
            </div>
        </div>
    `).join('');
}

// Function to update task progress
async function updateTaskProgress(slider) {
    const progress = parseInt(slider.value);
    const taskId = slider.dataset.taskId;
    const company = slider.dataset.company;
    
    // Update visual feedback immediately
    const card = slider.closest('.task-card');
    const progressBar = card.querySelector('.progress-bar');
    const progressValue = card.querySelector('.progress-value');
    
    progressBar.style.width = `${progress}%`;
    progressValue.textContent = `${progress}%`;
    
    // Determine if status should change based on progress
    let newStatus = null;
    let statusChanged = false;
    
    if (progress === 0) {
        newStatus = "Project";
    } else if (progress >= 10 && progress < 100) {
        newStatus = "Current Project";
    } else if (progress === 100) {
        newStatus = "Project Finished";
    }
    
    // Show status change notification
    if (newStatus) {
        const currentStatus = card.querySelector('.task-status').textContent;
        if (currentStatus !== newStatus) {
            statusChanged = true;
            showToast(`Status will change to: ${newStatus}`, 'info');
        }
    }
    
    try {
        const response = await fetch('/api/task-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update_progress',
                task_id: taskId,
                company: company,
                progress: progress,
                new_status: statusChanged ? newStatus : null,
                progress_attribute_id: PROGRESS_ATTRIBUTES[company],
                timestamp: new Date().toISOString()
            })
        });

        const data = await response.json();
        
        if (data.success) {
            showToast(`Progress updated to ${progress}%`, 'success');
            
            // Update status display if changed
            if (statusChanged && newStatus) {
                const statusElement = card.querySelector('.task-status');
                statusElement.textContent = newStatus;
                statusElement.className = `task-status ${getStatusClass(newStatus)}`;
            }
        } else {
            showToast('Failed to update progress', 'error');
            // Revert slider on failure
            slider.value = slider.defaultValue;
            progressBar.style.width = `${slider.defaultValue}%`;
            progressValue.textContent = `${slider.defaultValue}%`;
        }
    } catch (error) {
        console.error('Error updating progress:', error);
        showToast('Error updating progress', 'error');
    }
}

// Function to open task editor modal
function openTaskEditor(taskId) {
    const task = findTaskById(taskId);
    if (!task) return;
    
    // Create modal HTML
    const modalHtml = `
        <div id="taskEditModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Edit Task: ${task.task_name}</h2>
                    <span class="close" onclick="closeTaskEditor()">&times;</span>
                </div>
                <form id="editTaskForm" onsubmit="handleTaskEdit(event, '${taskId}')">
                    <div class="form-group">
                        <label for="editTaskName">Task Name</label>
                        <input type="text" id="editTaskName" value="${task.task_name}" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="editTaskDescription">Description</label>
                        <textarea id="editTaskDescription" rows="4">${task.description || ''}</textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="editTaskDueDate">Due Date</label>
                        <input type="date" id="editTaskDueDate" value="${task.due_date || ''}">
                    </div>
                    
                    <div class="form-group">
                        <label for="editTaskProgress">Progress: <span id="progressDisplay">${task.progress || 0}%</span></label>
                        <div class="progress-bar-container">
                            <div class="progress-bar" id="editProgressBar" style="width: ${task.progress || 0}%"></div>
                        </div>
                        <input type="range" 
                               id="editTaskProgress" 
                               min="0" 
                               max="100" 
                               value="${task.progress || 0}"
                               oninput="updateProgressDisplay(this.value)">
                        <div class="progress-hints">
                            <span class="hint">0% = Project</span>
                            <span class="hint">10%+ = Current Project</span>
                            <span class="hint">100% = Finished</span>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="editTaskStatus">Status (Override automatic status)</label>
                        <select id="editTaskStatus">
                            <option value="">Automatic based on progress</option>
                            <option value="Project" ${task.current_status === 'Project' ? 'selected' : ''}>📋 Project</option>
                            <option value="Priority Project" ${task.current_status === 'Priority Project' ? 'selected' : ''}>⭐ Priority Project</option>
                            <option value="Current Project" ${task.current_status === 'Current Project' ? 'selected' : ''}>🔄 Current Project</option>
                            <option value="Revision" ${task.current_status === 'Revision' ? 'selected' : ''}>📝 Revision</option>
                            <option value="Waiting Approval" ${task.current_status === 'Waiting Approval' ? 'selected' : ''}>⏳ Waiting Approval</option>
                            <option value="Project Finished" ${task.current_status === 'Project Finished' ? 'selected' : ''}>✅ Project Finished</option>
                            <option value="Rejected" ${task.current_status === 'Rejected' ? 'selected' : ''}>❌ Rejected</option>
                        </select>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeTaskEditor()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('taskEditModal').style.display = 'block';
}

// Function to update progress display in modal
function updateProgressDisplay(value) {
    document.getElementById('progressDisplay').textContent = `${value}%`;
    document.getElementById('editProgressBar').style.width = `${value}%`;
    
    // Show what status will be set
    let autoStatus = '';
    if (value == 0) {
        autoStatus = 'Project';
    } else if (value >= 10 && value < 100) {
        autoStatus = 'Current Project';
    } else if (value == 100) {
        autoStatus = 'Project Finished';
    }
    
    const statusSelect = document.getElementById('editTaskStatus');
    if (statusSelect.value === '') {
        const hint = document.createElement('div');
        hint.className = 'status-hint';
        hint.textContent = `Auto status: ${autoStatus}`;
        
        const existingHint = statusSelect.parentElement.querySelector('.status-hint');
        if (existingHint) {
            existingHint.textContent = `Auto status: ${autoStatus}`;
        } else {
            statusSelect.parentElement.appendChild(hint);
        }
    }
}

// Function to close task editor
function closeTaskEditor() {
    const modal = document.getElementById('taskEditModal');
    if (modal) {
        modal.remove();
    }
}

// Function to handle task edit submission
async function handleTaskEdit(event, taskId) {
    event.preventDefault();
    
    const task = findTaskById(taskId);
    if (!task) return;
    
    const progress = parseInt(document.getElementById('editTaskProgress').value);
    const manualStatus = document.getElementById('editTaskStatus').value;
    
    // Determine final status
    let finalStatus = manualStatus;
    if (!finalStatus) {
        // Use automatic status based on progress
        if (progress === 0) {
            finalStatus = "Project";
        } else if (progress >= 10 && progress < 100) {
            finalStatus = "Current Project";
        } else if (progress === 100) {
            finalStatus = "Project Finished";
        }
    }
    
    const updateData = {
        action: 'update_task_details',
        employee: currentEmployee,
        task_id: taskId,
        company: task.company,
        task_name: document.getElementById('editTaskName').value,
        description: document.getElementById('editTaskDescription').value,
        due_date: document.getElementById('editTaskDueDate').value,
        progress: progress,
        status: finalStatus,
        progress_attribute_id: PROGRESS_ATTRIBUTES[task.company],
        timestamp: new Date().toISOString()
    };
    
    try {
        const response = await fetch(CONFIG.n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        const data = await response.json();
        
        if (data.success) {
            showToast('Task updated successfully!', 'success');
            closeTaskEditor();
            loadAssignedTasks(); // Refresh the task list
        } else {
            showToast('Failed to update task', 'error');
        }
    } catch (error) {
        console.error('Error updating task:', error);
        showToast('Error updating task', 'error');
    }
}

// Helper function to find task by ID
function findTaskById(taskId) {
    return window.loadedTasks?.find(t => t.intake_task_id === taskId);
}

// Helper function to get status class for styling
function getStatusClass(status) {
    const statusClasses = {
        'Project': 'status-project',
        'Priority Project': 'status-priority',
        'Current Project': 'status-current',
        'Revision': 'status-revision',
        'Waiting Approval': 'status-waiting',
        'Project Finished': 'status-finished',
        'Rejected': 'status-rejected'
    };
    return statusClasses[status] || 'status-default';
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

// ============= TASK EDITOR MODAL FUNCTIONS =============

// Task Editor Modal HTML
function createTaskEditorModal() {
    const modalHTML = `
    <div id="taskEditorModal" class="modal">
        <div class="modal-content modal-large">
            <div class="modal-header">
                <h2>✏️ Task Editor - Paste IDs from Discord</h2>
                <span class="close" onclick="closeTaskEditorModal()">&times;</span>
            </div>
            
            <div class="modal-body">
                <!-- ID Input Section -->
                <div class="id-input-group">
                    <h3>Paste Task IDs from Discord Logs</h3>
                    
                    <div class="paste-area">
                        <label class="paste-label" for="masterBoardId">Master Board ID</label>
                        <input 
                            type="text" 
                            id="masterBoardId" 
                            class="paste-input" 
                            placeholder="bf8167cb-e191-4fb4-b59c-89713cd11812"
                            pattern="[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}"
                        >
                        <button class="quick-paste-btn" onclick="pasteFromClipboard('masterBoardId')">📋 Paste</button>
                    </div>
                    
                    <div class="paste-area">
                        <label class="paste-label" for="companyBoardId">Company Board ID</label>
                        <input 
                            type="text" 
                            id="companyBoardId" 
                            class="paste-input" 
                            placeholder="8e376e2c-a1c8-434b-b6e0-27b8edbca9a5"
                            pattern="[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}"
                        >
                        <button class="quick-paste-btn" onclick="pasteFromClipboard('companyBoardId')">📋 Paste</button>
                    </div>
                    
                    <button class="btn btn-primary load-task-btn" onclick="loadTaskForEdit()">
                        🔍 Load Task
                    </button>
                </div>

                <!-- Task Info Display -->
                <div id="taskInfoDisplay" class="task-info-display">
                    <h4>Current Task Information</h4>
                    <div class="info-grid" id="taskInfoGrid">
                        <!-- Task info will be populated here -->
                    </div>
                </div>

                <!-- Task Edit Form -->
                <form id="taskEditModalForm" class="task-edit-form">
                    <div class="edit-grid">
                        <!-- Company Selection -->
                        <div class="form-group">
                            <label for="editCompany">Company*</label>
                            <select id="editCompany" required>
                                <option value="">Select Company</option>
                                <option value="VEBLEN (Internal)">VEBLEN (Internal)</option>
                                <option value="LCMB GROUP">LCMB GROUP</option>
                                <option value="NEWTECH TRAILERS">NEWTECH TRAILERS</option>
                                <option value="CROWN REALITY">CROWN REALITY</option>
                                <option value="FLECK GROUP">FLECK GROUP</option>
                            </select>
                        </div>

                        <!-- Priority -->
                        <div class="form-group">
                            <label for="editPriority">Priority</label>
                            <select id="editPriority">
                                <option value="Low">🟢 Low</option>
                                <option value="Medium">🟡 Medium</option>
                                <option value="High">🟠 High</option>
                                <option value="Urgent">🔴 Urgent</option>
                            </select>
                        </div>

                        <!-- Task Name -->
                        <div class="form-group full-width">
                            <label for="editModalTaskName">Task Name*</label>
                            <input type="text" id="editModalTaskName" required>
                        </div>

                        <!-- Description -->
                        <div class="form-group full-width">
                            <label for="editModalDescription">Description</label>
                            <textarea id="editModalDescription" rows="4"></textarea>
                        </div>

                        <!-- Due Date -->
                        <div class="form-group">
                            <label for="editModalDueDate">Due Date</label>
                            <input type="date" id="editModalDueDate">
                        </div>

                        <!-- Status -->
                        <div class="form-group">
                            <label for="editModalStatus">Status</label>
                            <select id="editModalStatus">
                                <option value="">Auto (based on progress)</option>
                                <option value="Project">📋 Project</option>
                                <option value="Priority Project">⭐ Priority Project</option>
                                <option value="Current Project">🔄 Current Project</option>
                                <option value="Revision">📝 Revision</option>
                                <option value="Waiting Approval">⏳ Waiting Approval</option>
                                <option value="Project Finished">✅ Project Finished</option>
                                <option value="Rejected">❌ Rejected</option>
                            </select>
                        </div>

                        <!-- Assigned To -->
                        <div class="form-group full-width">
                            <label for="editModalAssigned">Assigned To (Hold Ctrl/Cmd for multiple)</label>
                            <select id="editModalAssigned" class="assigned-select" multiple>
                                <option value="Tony Herrera">Tony Herrera</option>
                                <option value="Alex">Alex</option>
                                <option value="Eden">Eden</option>
                                <option value="Social Media Manager">Social Media Manager</option>
                                <option value="Ridho">Ridho</option>
                                <option value="Risna">Risna</option>
                                <option value="Pran Setiawan">Pran Setiawan</option>
                                <option value="Wayan Arfian (Konsep Kreatif)">Wayan Arfian</option>
                                <option value="Hanif (Konsep Kreatif)">Hanif</option>
                                <option value="Jevahn">Jevahn</option>
                                <option value="Zac Macanally">Zac Macanally</option>
                            </select>
                        </div>

                        <!-- Progress -->
                        <div class="form-group full-width progress-editor">
                            <label for="editModalProgress">Progress</label>
                            <div class="progress-preview">
                                <div class="progress-bar-container">
                                    <div class="progress-bar" id="modalProgressBar" style="width: 0%"></div>
                                </div>
                                <span id="modalProgressValue">0%</span>
                                <span id="modalAutoStatus" class="status-indicator status-project">Project</span>
                            </div>
                            <input 
                                type="range" 
                                id="editModalProgress" 
                                min="0" 
                                max="100" 
                                value="0"
                                oninput="updateModalProgressPreview(this.value)"
                            >
                            <div class="progress-hints">
                                <span class="hint">0% = Project</span>
                                <span class="hint">10-99% = Current Project</span>
                                <span class="hint">100% = Finished</span>
                            </div>
                        </div>

                        <!-- Update Options -->
                        <div class="form-group full-width">
                            <label>
                                <input type="checkbox" id="updateBothBoards" checked>
                                Update both Master and Company boards
                            </label>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeTaskEditorModal()">
                            Cancel
                        </button>
                        <button type="button" class="btn btn-success" onclick="quickCompleteModalTask()">
                            ✅ Quick Complete
                        </button>
                        <button type="submit" class="btn btn-primary">
                            💾 Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    `;
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}
// Initialize task editor modal variables
let currentModalTaskData = null;

// Open task editor modal
function openTaskEditorModal() {
    // Create modal if it doesn't exist
    if (!document.getElementById('taskEditorModal')) {
        createTaskEditorModal();
        // Add event listener to the form
        document.getElementById('taskEditModalForm').addEventListener('submit', handleModalTaskUpdate);
    }
    
    // Show modal
    document.getElementById('taskEditorModal').style.display = 'block';
}

// Close task editor modal
function closeTaskEditorModal() {
    const modal = document.getElementById('taskEditorModal');
    if (modal) {
        modal.style.display = 'none';
        // Reset form
        resetModalTaskEditor();
    }
}

// Paste from clipboard
async function pasteFromClipboard(inputId) {
    try {
        const text = await navigator.clipboard.readText();
        // Extract UUID pattern from pasted text
        const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
        const match = text.match(uuidPattern);
        
        if (match) {
            document.getElementById(inputId).value = match[0];
            showToast('ID pasted successfully!', 'success');
        } else {
            showToast('No valid ID found in clipboard', 'warning');
        }
    } catch (err) {
        showToast('Failed to read clipboard', 'error');
    }
}

// Load task for editing
async function loadTaskForEdit() {
    const masterBoardId = document.getElementById('masterBoardId').value.trim();
    const companyBoardId = document.getElementById('companyBoardId').value.trim();
    
    if (!masterBoardId && !companyBoardId) {
        showToast('Please enter at least one Task ID', 'warning');
        return;
    }
    
    // Show loading state
    showToast('Loading task data...', 'info');
    
    try {
        // Call API to get task data
        // For now, we'll use the loaded tasks data if available
        let taskData = null;
        
        // Try to find task in loaded tasks
        if (window.loadedTasks && window.loadedTasks.length > 0) {
            taskData = window.loadedTasks.find(task => 
                task.intake_task_id === companyBoardId || 
                task.master_task_id === masterBoardId
            );
        }
        
        if (!taskData) {
            // Make API call to fetch task data
            const response = await fetch(`/api/task/${companyBoardId || masterBoardId}?company=${currentEmployee}`);
            if (response.ok) {
                const result = await response.json();
                taskData = result.data;
            }
        }
        
        if (taskData) {
            currentModalTaskData = {
                master_board_id: masterBoardId,
                company_board_id: companyBoardId,
                company: taskData.company || 'VEBLEN (Internal)',
                task_name: taskData.task_name || taskData.title || '',
                description: taskData.description || '',
                priority: taskData.priority || 'Medium',
                due_date: taskData.due_date || '',
                status: taskData.current_status || taskData.status || '',
                progress: taskData.progress || 0,
                assigned: taskData.assigned || []
            };
        } else {
            // Create empty task data structure
            currentModalTaskData = {
                master_board_id: masterBoardId,
                company_board_id: companyBoardId,
                company: '',
                task_name: '',
                description: '',
                priority: 'Medium',
                due_date: '',
                status: '',
                progress: 0,
                assigned: []
            };
        }
        
        // Populate the form
        populateModalEditForm(currentModalTaskData);
        
        // Show task info
        displayModalTaskInfo(currentModalTaskData);
        
        // Show the edit form
        document.getElementById('taskEditModalForm').classList.add('active');
        document.getElementById('taskInfoDisplay').classList.add('active');
        
        showToast('Task loaded successfully!', 'success');
    } catch (error) {
        console.error('Error loading task:', error);
        showToast('Failed to load task data', 'error');
    }
}

// Display task info in modal
function displayModalTaskInfo(taskData) {
    const infoGrid = document.getElementById('taskInfoGrid');
    infoGrid.innerHTML = `
        <div class="info-item">
            <span class="info-label">Master Board ID</span>
            <span class="info-value">${taskData.master_board_id || 'N/A'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Company Board ID</span>
            <span class="info-value">${taskData.company_board_id || 'N/A'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Company</span>
            <span class="info-value">${taskData.company || 'Not Set'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Current Status</span>
            <span class="info-value">${taskData.status || 'Not Set'}</span>
        </div>
    `;
}

// Populate modal edit form
function populateModalEditForm(taskData) {
    document.getElementById('editCompany').value = taskData.company || '';
    document.getElementById('editModalTaskName').value = taskData.task_name || '';
    document.getElementById('editModalDescription').value = taskData.description || '';
    document.getElementById('editPriority').value = taskData.priority || 'Medium';
    document.getElementById('editModalDueDate').value = taskData.due_date || '';
    document.getElementById('editModalStatus').value = taskData.status || '';
    document.getElementById('editModalProgress').value = taskData.progress || 0;
    
    // Update progress preview
    updateModalProgressPreview(taskData.progress || 0);
    
    // Set assigned users
    const assignedSelect = document.getElementById('editModalAssigned');
    Array.from(assignedSelect.options).forEach(option => {
        option.selected = taskData.assigned?.includes(option.value);
    });
    
    // Set update option based on whether both IDs are present
    document.getElementById('updateBothBoards').checked = 
        !!(taskData.master_board_id && taskData.company_board_id);
}

// Update modal progress preview
function updateModalProgressPreview(value) {
    const progressBar = document.getElementById('modalProgressBar');
    const progressValue = document.getElementById('modalProgressValue');
    const autoStatus = document.getElementById('modalAutoStatus');
    
    progressBar.style.width = `${value}%`;
    progressValue.textContent = `${value}%`;
    
    // Update auto status indicator
    let status = 'Project';
    let statusClass = 'status-project';
    
    if (value >= 10 && value < 100) {
        status = 'Current Project';
        statusClass = 'status-current';
    } else if (value >= 100) {
        status = 'Project Finished';
        statusClass = 'status-finished';
    }
    
    autoStatus.textContent = status;
    autoStatus.className = `status-indicator ${statusClass}`;
}

// Quick complete modal task
async function quickCompleteModalTask() {
    if (!currentModalTaskData) {
        showToast('Please load a task first', 'warning');
        return;
    }
    
    if (!confirm('Are you sure you want to mark this task as complete?')) {
        return;
    }
    
    // Set progress to 100 and update
    document.getElementById('editModalProgress').value = 100;
    updateModalProgressPreview(100);
    
    // Submit the form
    await handleModalTaskUpdate({ preventDefault: () => {} });
}

// Reset modal task editor
function resetModalTaskEditor() {
    if (document.getElementById('taskEditModalForm')) {
        document.getElementById('taskEditModalForm').reset();
        document.getElementById('taskEditModalForm').classList.remove('active');
    }
    if (document.getElementById('taskInfoDisplay')) {
        document.getElementById('taskInfoDisplay').classList.remove('active');
    }
    document.getElementById('masterBoardId').value = '';
    document.getElementById('companyBoardId').value = '';
    currentModalTaskData = null;
    updateModalProgressPreview(0);
}

// Handle modal task update
async function handleModalTaskUpdate(event) {
    event.preventDefault();
    
    if (!currentModalTaskData) {
        showToast('No task loaded', 'error');
        return;
    }
    
    // Get selected assigned users
    const assignedSelect = document.getElementById('editModalAssigned');
    const assignedTo = Array.from(assignedSelect.selectedOptions).map(option => option.value);
    
    const updateData = {
        action: 'update_details',
        master_task_id: currentModalTaskData.master_board_id,
        task_id: currentModalTaskData.company_board_id || currentModalTaskData.master_board_id,
        company: document.getElementById('editCompany').value,
        task_name: document.getElementById('editModalTaskName').value,
        description: document.getElementById('editModalDescription').value,
        priority: document.getElementById('editPriority').value,
        due_date: document.getElementById('editModalDueDate').value,
        assigned_to: assignedTo,
        progress: parseInt(document.getElementById('editModalProgress').value),
        status: document.getElementById('editModalStatus').value || null,
        update_master: document.getElementById('updateBothBoards').checked,
        employee: currentEmployee || 'Unknown',
        timestamp: new Date().toISOString()
    };
    
    try {
        showToast('Updating task...', 'info');
        
        const response = await fetch('/api/task-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        const data = await response.json();
        
        if (data.success) {
            showToast('Task updated successfully!', 'success');
            
            // Update current task data
            currentModalTaskData = {
                ...currentModalTaskData,
                ...updateData
            };
            
            // Update task info display
            displayModalTaskInfo(currentModalTaskData);
            
            // Refresh assigned tasks if visible
            if (currentEmployee) {
                loadAssignedTasks();
            }
        } else {
            showToast(data.error || 'Failed to update task', 'error');
        }
    } catch (error) {
        console.error('Error updating task:', error);
        showToast('Error updating task', 'error');
    }
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('taskEditorModal');
    if (event.target === modal) {
        closeTaskEditorModal();
    }
});
