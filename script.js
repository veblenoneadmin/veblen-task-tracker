// Global variables
let currentTimer = null;
let startTime = null;
let pausedTime = 0;
let currentEmployee = null;
let currentTaskId = null;
let activeTaskData = null;

// Configuration - UPDATE THESE URLs
const CONFIG = {
    n8nWebhookUrl: 'https://your-n8n-instance.com/webhook/veblen-task-action',
    apiBase: 'https://your-n8n-instance.com/webhook'
};

// DOM Elements
const employeeSelect = document.getElementById('employeeSelect');
const activeTaskSection = document.getElementById('activeTaskSection');
const currentTaskName = document.getElementById('currentTaskName');
const taskDetails = document.getElementById('taskDetails');
const timer = document.getElementById('timer');
const taskStatus = document.getElementById('taskStatus');
const todaySummary = document.getElementById('todaySummary');
const loadingOverlay = document.getElementById('loadingOverlay');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 VEBLEN Task Tracker loaded');
    
    // Load saved employee from localStorage
    const savedEmployee = localStorage.getItem('veblen_current_employee');
    if (savedEmployee) {
        employeeSelect.value = savedEmployee;
        loadEmployeeData();
    }
});

// Employee selection handler
function loadEmployeeData() {
    currentEmployee = employeeSelect.value;
    
    if (!currentEmployee) {
        hideActiveTask();
        todaySummary.innerHTML = 'Select an employee to see progress';
        return;
    }

    // Save to localStorage
    localStorage.setItem('veblen_current_employee', currentEmployee);
    
    showLoading(true);
    
    // Check for active tasks
    makeApiCall('get_active_task', { employee: currentEmployee })
        .then(data => {
            if (data.active_task) {
                showActiveTask(data.active_task);
                if (data.active_task.status === 'active') {
                    resumeTimer(data.active_task);
                }
            } else {
                hideActiveTask();
            }
            return loadTodaySummary();
        })
        .catch(error => {
            console.error('Error loading employee data:', error);
            showNotification('Error loading data', 'error');
        })
        .finally(() => {
            showLoading(false);
        });
}

// Start new task
function startNewTask() {
    const taskName = document.getElementById('taskName').value.trim();
    const company = document.getElementById('company').value;
    const taskType = document.getElementById('taskType').value;

    // Validation
    if (!currentEmployee) {
        showNotification('Please select an employee first', 'error');
        return;
    }

    if (!taskName || !company || !taskType) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    showLoading(true);

    const taskData = {
        action: 'start_task',
        employee: currentEmployee,
        task_name: taskName,
        company: company,
        task_type: taskType,
        timestamp: new Date().toISOString()
    };

    makeApiCall('start_task', taskData)
        .then(data => {
            if (data.success) {
                currentTaskId = data.task_id;
                activeTaskData = {
                    task_id: data.task_id,
                    task_name: taskName,
                    company: company,
                    task_type: taskType,
                    status: 'active',
                    infinity_id: data.infinity_id
                };
                
                showActiveTask(activeTaskData);
                clearForm();
                startTimer();
                showNotification('Task started successfully! 🚀', 'success');
            } else {
                throw new Error(data.message || 'Failed to start task');
            }
        })
        .catch(error => {
            console.error('Error starting task:', error);
            showNotification('Failed to start task: ' + error.message, 'error');
        })
        .finally(() => {
            showLoading(false);
        });
}

// Pause task
function pauseTask() {
    if (!currentTaskId || !currentEmployee) {
        showNotification('No active task to pause', 'error');
        return;
    }

    const reason = prompt('Break reason (optional):') || 'Break';
    
    showLoading(true);

    makeApiCall('pause_task', {
        action: 'pause_task',
        employee: currentEmployee,
        task_id: currentTaskId,
        pause_reason: reason,
        timestamp: new Date().toISOString()
    })
    .then(data => {
        if (data.success) {
            pauseTimer();
            taskStatus.textContent = 'Paused - ' + reason;
            taskStatus.style.background = '#ffaa00';
            showNotification('Task paused ⏸️', 'info');
        } else {
            throw new Error(data.message || 'Failed to pause task');
        }
    })
    .catch(error => {
        console.error('Error pausing task:', error);
        showNotification('Failed to pause task: ' + error.message, 'error');
    })
    .finally(() => {
        showLoading(false);
    });
}

// Complete task
function completeTask() {
    if (!currentTaskId || !currentEmployee) {
        showNotification('No active task to complete', 'error');
        return;
    }

    const notes = prompt('Task completion notes (optional):') || '';
    
    showLoading(true);

    makeApiCall('complete_task', {
        action: 'complete_task',
        employee: currentEmployee,
        task_id: currentTaskId,
        completion_notes: notes,
        timestamp: new Date().toISOString()
    })
    .then(data => {
        if (data.success) {
            stopTimer();
            hideActiveTask();
            loadTodaySummary();
            showNotification(`Task completed! ✅ Total time: ${data.total_time_hours} hours`, 'success');
            
            // Reset current task
            currentTaskId = null;
            activeTaskData = null;
        } else {
            throw new Error(data.message || 'Failed to complete task');
        }
    })
    .catch(error => {
        console.error('Error completing task:', error);
        showNotification('Failed to complete task: ' + error.message, 'error');
    })
    .finally(() => {
        showLoading(false);
    });
}

// Timer functions
function startTimer() {
    startTime = Date.now() - pausedTime;
    currentTimer = setInterval(updateTimer, 1000);
}

function resumeTimer(taskData) {
    // Calculate time since last update
    const lastUpdate = new Date(taskData.last_update);
    const now = new Date();
    const timeSinceUpdate = now - lastUpdate;
    
    // If task was just started or resumed recently, continue timer
    if (taskData.status === 'active' && timeSinceUpdate < 300000) { // 5 minutes
        pausedTime = (taskData.total_seconds || 0) * 1000;
        startTimer();
    }
}

function updateTimer() {
    const elapsed = Date.now() - startTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    
    timer.textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function pauseTimer() {
    if (currentTimer) {
        clearInterval(currentTimer);
        pausedTime = Date.now() - startTime;
        currentTimer = null;
    }
}

function stopTimer() {
    pauseTimer();
    timer.textContent = '00:00:00';
    pausedTime = 0;
    startTime = null;
}

// UI functions
function showActiveTask(task) {
    activeTaskSection.classList.remove('hidden');
    currentTaskName.textContent = task.task_name;
    taskDetails.innerHTML = `<strong>${task.company}</strong> • ${task.task_type}`;
    taskStatus.textContent = task.status === 'active' ? 'Active' : 'Paused';
    taskStatus.style.background = task.status === 'active' ? '#00ff88' : '#ffaa00';
}

function hideActiveTask() {
    activeTaskSection.classList.add('hidden');
    stopTimer();
}

function clearForm() {
    document.getElementById('taskName').value = '';
    document.getElementById('company').value = '';
    document.getElementById('taskType').value = '';
}

function loadTodaySummary() {
    if (!currentEmployee) return Promise.resolve();

    return makeApiCall('today_summary', { employee: currentEmployee })
        .then(data => {
            todaySummary.innerHTML = `
                <div class="progress-item">
                    <div class="progress-value">${data.total_hours || '0.0'}</div>
                    <div class="progress-label">Hours Today</div>
                </div>
                <div class="progress-item">
                    <div class="progress-value">${data.completed_tasks || 0}</div>
                    <div class="progress-label">Tasks Completed</div>
                </div>
                <div class="progress-item">
                    <div class="progress-value">${data.companies_worked || 0}</div>
                    <div class="progress-label">Companies</div>
                </div>
            `;
        })
        .catch(error => {
            console.error('Error loading today summary:', error);
            todaySummary.innerHTML = 'Error loading summary';
        });
}

function showLoading(show) {
    if (show) {
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">${message}</div>
        <div style="font-size: 0.9em; opacity: 0.8;">${new Date().toLocaleTimeString()}</div>
    `;
    
    document.getElementById('notifications').appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// API call helper
async function makeApiCall(action, data) {
    try {
        const response = await fetch(CONFIG.n8nWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ...data, action })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

// Auto-save work every 5 minutes (in case of browser crash)
setInterval(() => {
    if (currentTaskId && currentEmployee && currentTimer) {
        makeApiCall('auto_save', {
            action: 'auto_save',
            employee: currentEmployee,
            task_id: currentTaskId,
            timestamp: new Date().toISOString()
        }).catch(error => {
            console.warn('Auto-save failed:', error);
        });
    }
}, 5 * 60 * 1000); // 5 minutes
