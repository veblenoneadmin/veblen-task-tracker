// VEBLEN Task & Time Tracker Frontend JavaScript

// Configuration - UPDATE THESE WITH YOUR ACTUAL WEBHOOK URLS
const CONFIG = {
    n8nWebhookUrl: 'https://your-n8n-domain.com/webhook/veblen-task-action',
    sheetsApiUrl: 'https://your-n8n-domain.com/webhook/veblen-sheets-api'
};

// Global state
let currentEmployee = null;
let activeTask = null;
let timerInterval = null;
let timerSeconds = 0;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Load saved employee
    const savedEmployee = localStorage.getItem('veblen_employee');
    if (savedEmployee) {
        document.getElementById('employeeSelect').value = savedEmployee;
        currentEmployee = savedEmployee;
    }

    // Set today's date for report
    document.getElementById('reportDate').value = new Date().toISOString().split('T')[0];

    // Check for crashed session
    checkCrashedSession();

    // Start auto-save
    startAutoSave();
});

// Employee selection handler
document.getElementById('employeeSelect').addEventListener('change', function(e) {
    currentEmployee = e.target.value;
    localStorage.setItem('veblen_employee', currentEmployee);
    
    if (currentEmployee) {
        showMessage('Employee selected: ' + currentEmployee, 'success');
        checkActiveTask();
    }
});

// Tab switching
function switchTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabId).classList.add('active');
    
    // Add active class to clicked button
    event.target.classList.add('active');
}

// Message display
function showMessage(message, type = 'info') {
    const container = document.getElementById('messageContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    container.appendChild(messageDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

// API call wrapper
async function apiCall(action, data = {}) {
    if (!currentEmployee && action !== 'get_employee_settings') {
        showMessage('Please select an employee first', 'error');
        return null;
    }

    try {
        const response = await fetch(CONFIG.n8nWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: action,
                employee: currentEmployee,
                timestamp: new Date().toISOString(),
                ...data
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success) {
            return result;
        } else {
            throw new Error(result.message || 'Operation failed');
        }
    } catch (error) {
        console.error('API Error:', error);
        showMessage('Error: ' + error.message, 'error');
        return null;
    }
}

// Time Tracker Functions
async function startTask() {
    const taskName = document.getElementById('taskName').value;
    const company = document.getElementById('taskCompany').value;
    const taskType = document.getElementById('taskType').value;
    const description = document.getElementById('taskDescription').value;

    if (!taskName || !company || !taskType) {
        showMessage('Please fill in all required fields', 'error');
        return;
    }

    const result = await apiCall('start_task', {
        task_name: taskName,
        company: company,
        task_type: taskType,
        description: description
    });

    if (result) {
        activeTask = {
            task_id: result.data.task_id,
            task_name: taskName,
            start_time: new Date().toISOString(),
            status: 'active'
        };
        
        // Save to localStorage
        localStorage.setItem('veblen_active_task', JSON.stringify(activeTask));
        
        // Start timer
        startTimer();
        
        // Update UI
        updateTaskUI();
        
        showMessage('Task started successfully!', 'success');
        
        // Clear form
        document.getElementById('taskName').value = '';
        document.getElementById('taskDescription').value = '';
    }
}

async function pauseTask() {
    if (!activeTask) return;

    const result = await apiCall('pause_task', {
        task_id: activeTask.task_id,
        pause_reason: 'Manual pause'
    });

    if (result) {
        activeTask.status = 'paused';
        stopTimer();
        updateTaskUI();
        showMessage('Task paused', 'warning');
    }
}

async function resumeTask() {
    if (!activeTask) return;

    const result = await apiCall('start_task', {
        task_id: activeTask.task_id,
        task_name: activeTask.task_name,
        resume: true
    });

    if (result) {
        activeTask.status = 'active';
        startTimer();
        updateTaskUI();
        showMessage('Task resumed', 'success');
    }
}

async function completeTask() {
    if (!activeTask) return;

    const notes = prompt('Add completion notes (optional):');
    
    const result = await apiCall('complete_task', {
        task_id: activeTask.task_id,
        completion_notes: notes || ''
    });

    if (result) {
        stopTimer();
        activeTask = null;
        localStorage.removeItem('veblen_active_task');
        updateTaskUI();
        showMessage('Task completed!', 'success');
    }
}

// Timer functions
function startTimer() {
    if (timerInterval) return;
    
    timerInterval = setInterval(() => {
        timerSeconds++;
        updateTimerDisplay();
        
        // Save state every 10 seconds
        if (timerSeconds % 10 === 0) {
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
    const hours = Math.floor(timerSeconds / 3600);
    const minutes = Math.floor((timerSeconds % 3600) / 60);
    const seconds = timerSeconds % 60;
    
    const display = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('timerDisplay').textContent = display;
}

function updateTaskUI() {
    const newTaskForm = document.getElementById('newTaskForm');
    const activeControls = document.getElementById('activeTaskControls');
    const pausedControls = document.getElementById('pausedTaskControls');
    const taskNameDisplay = document.getElementById('currentTaskName');
    
    if (!activeTask) {
        newTaskForm.classList.remove('hidden');
        activeControls.classList.add('hidden');
        pausedControls.classList.add('hidden');
        taskNameDisplay.textContent = 'No active task';
        timerSeconds = 0;
        updateTimerDisplay();
    } else {
        newTaskForm.classList.add('hidden');
        taskNameDisplay.textContent = activeTask.task_name;
        
        if (activeTask.status === 'active') {
            activeControls.classList.remove('hidden');
            pausedControls.classList.add('hidden');
        } else {
            activeControls.classList.add('hidden');
            pausedControls.classList.remove('hidden');
        }
    }
}

// Time Clock Functions
async function timeClock(action) {
    const result = await apiCall('time_clock', {
        clock_action: action
    });

    if (result) {
        showMessage(`Time clock: ${action}`, 'success');
    }
}

// Task Management
async function loadAssignedTasks() {
    const result = await apiCall('get_assigned_tasks');
    
    if (result && result.tasks) {
        const tasksList = document.getElementById('assignedTasksList');
        
        if (result.tasks.length === 0) {
            tasksList.innerHTML = '<p class="text-muted">No assigned tasks found</p>';
            return;
        }
        
        tasksList.innerHTML = '<ul class="task-list">' + 
            result.tasks.map(task => `
                <li class="task-item">
                    <div class="task-info">
                        <h4>${task.task_name}</h4>
                        <p>${task.company} • Due: ${new Date(task.due_date).toLocaleDateString()}</p>
                    </div>
                    <div class="task-meta">
                        <span class="status-badge ${task.current_status.toLowerCase().replace(' ', '-')}">${task.current_status}</span>
                        <button class="btn btn-primary" onclick="createTaskFromAssigned('${task.intake_task_id}', '${task.task_name}', '${task.company}')">
                            ▶️ Start
                        </button>
                    </div>
                </li>
            `).join('') + 
            '</ul>';
    }
}

function createTaskFromAssigned(intakeId, taskName, company) {
    // Pre-fill the form
    document.getElementById('taskName').value = taskName;
    document.getElementById('taskCompany').value = company;
    
    // Switch to time tracker tab
    switchTab('time-tracker');
    
    // Focus on task type
    document.getElementById('taskType').focus();
}

// Daily Report
async function submitDailyReport() {
    const reportData = {
        date: document.getElementById('reportDate').value,
        work_summary: document.getElementById('workSummary').value,
        challenges: document.getElementById('challenges').value,
        tomorrow_plan: document.getElementById('tomorrowPlan').value,
        work_hours: document.getElementById('workHours').value,
        additional_notes: document.getElementById('additionalNotes').value
    };

    if (!reportData.work_summary || !reportData.work_hours) {
        showMessage('Please fill in work summary and hours worked', 'error');
        return;
    }

    const result = await apiCall('daily_report', reportData);

    if (result) {
        showMessage('Daily report submitted successfully!', 'success');
        
        // Clear form
        document.getElementById('workSummary').value = '';
        document.getElementById('challenges').value = '';
        document.getElementById('tomorrowPlan').value = '';
        document.getElementById('workHours').value = '';
        document.getElementById('additionalNotes').value = '';
    }
}

// Summary
async function loadTodaySummary() {
    const result = await apiCall('today_summary');
    
    if (result && result.summary) {
        const summary = result.summary;
        const summaryContent = document.getElementById('summaryContent');
        
        summaryContent.innerHTML = `
            <div class="summary-stats">
                <h3>📅 ${summary.date}</h3>
                <div class="stat-row">
                    <div class="stat">
                        <h4>Total Time</h4>
                        <p class="stat-value">${summary.total_time}</p>
                    </div>
                    <div class="stat">
                        <h4>Tasks Worked</h4>
                        <p class="stat-value">${summary.task_count}</p>
                    </div>
                </div>
            </div>
        `;
    }
}

// Auto-save and crash recovery
function saveTimerState() {
    if (activeTask && activeTask.status === 'active') {
        const state = {
            task: activeTask,
            seconds: timerSeconds,
            lastSave: new Date().toISOString()
        };
        localStorage.setItem('veblen_timer_state', JSON.stringify(state));
    }
}

async function checkCrashedSession() {
    const savedState = localStorage.getItem('veblen_timer_state');
    if (savedState) {
        const state = JSON.parse(savedState);
        const lastSave = new Date(state.lastSave);
        const now = new Date();
        const minutesSinceLastSave = (now - lastSave) / 1000 / 60;
        
        // If last save was within 30 minutes, offer to recover
        if (minutesSinceLastSave < 30) {
            if (confirm('Found an active session. Would you like to recover it?')) {
                activeTask = state.task;
                timerSeconds = state.seconds;
                
                // Add time elapsed since last save
                const elapsedSeconds = Math.floor((now - lastSave) / 1000);
                timerSeconds += elapsedSeconds;
                
                updateTaskUI();
                startTimer();
                showMessage('Session recovered!', 'success');
            } else {
                localStorage.removeItem('veblen_timer_state');
            }
        } else {
            localStorage.removeItem('veblen_timer_state');
        }
    }
}

async function checkActiveTask() {
    const result = await apiCall('get_active_task');
    
    if (result && result.tasks && result.tasks.length > 0) {
        const task = result.tasks[0];
        activeTask = {
            task_id: task.task_id,
            task_name: task.task_name,
            status: task.status,
            start_time: task.start_time
        };
        
        timerSeconds = task.total_seconds;
        updateTaskUI();
        
        if (task.status === 'active') {
            startTimer();
        }
    }
}

function startAutoSave() {
    // Save state before page unload
    window.addEventListener('beforeunload', saveTimerState);
    
    // Auto-save every 5 minutes
    setInterval(() => {
        if (activeTask && activeTask.status === 'active') {
            saveTimerState();
        }
    }, 5 * 60 * 1000);
}

// Add CSS for summary stats
const style = document.createElement('style');
style.textContent = `
.summary-stats {
    text-align: center;
}

.stat-row {
    display: flex;
    justify-content: center;
    gap: 40px;
    margin-top: 20px;
}

.stat {
    background-color: var(--dark-bg);
    padding: 20px 30px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
}

.stat h4 {
    color: var(--muted-text);
    font-size: 14px;
    margin-bottom: 10px;
}

.stat-value {
    font-size: 2rem;
    font-weight: bold;
    color: var(--primary-color);
}

.hidden {
    display: none !important;
}
`;
document.head.appendChild(style);
