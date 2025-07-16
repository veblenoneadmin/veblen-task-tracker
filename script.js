// Global variables
let currentTimer = null;
let startTime = null;
let pausedTime = 0;
let currentEmployee = null;
let currentTaskId = null;
let activeTaskData = null;
let selectedTaskForStatus = null;

// Configuration - UPDATE THESE URLs
const CONFIG = {
    n8nWebhookUrl: 'https://your-n8n-instance.com/webhook/veblen-task-action',
    // Google Sheets endpoints (handled by n8n)
    sheetsApiUrl: 'https://your-n8n-instance.com/webhook/veblen-sheets-api'
};

// Status configuration with your exact IDs
const STATUS_CONFIG = {
    'CROWN REALITY': {
        'Project': { id: '9240e88c-81ac-4cc6-b6b4-8f0fc6fd4cb6', icon: '📋', color: '#1976d2' },
        'Priority Project': { id: '8d17a65a-8fe6-4335-9121-52aaa35aa804', icon: '🔥', color: '#f57c00' },
        'Current Project': { id: 'd3742519-e50d-4c58-a162-86de57374955', icon: '🚀', color: '#388e3c' },
        'Rejected': { id: '9e3d844c-4aa5-4808-ab9e-981253936381', icon: '❌', color: '#d32f2f' },
        'Revision': { id: '3d984503-a1c9-4a19-b802-0969de3a5ed7', icon: '🔄', color: '#f9a825' },
        'Waiting Approval': { id: '517a684d-dbd0-46b4-a616-3ce7be040214', icon: '⏳', color: '#7b1fa2' },
        'Project Finished': { id: 'b4b210de-54c4-4ab2-a156-ed489114d2b4', icon: '✅', color: '#00695c' }
    },
    'LCMB GROUP': {
        'Project': { id: '9240e88c-81ac-4cc6-b6b4-8f0fc6fd4cb6', icon: '📋', color: '#1976d2' },
        'Priority Project': { id: '8d17a65a-8fe6-4335-9121-52aaa35aa804', icon: '🔥', color: '#f57c00' },
        'Current Project': { id: 'd3742519-e50d-4c58-a162-86de57374955', icon: '🚀', color: '#388e3c' },
        'Rejected': { id: '9e3d844c-4aa5-4808-ab9e-981253936381', icon: '❌', color: '#d32f2f' },
        'Revision': { id: '3d984503-a1c9-4a19-b802-0969de3a5ed7', icon: '🔄', color: '#f9a825' },
        'Waiting Approval': { id: '517a684d-dbd0-46b4-a616-3ce7be040214', icon: '⏳', color: '#7b1fa2' },
        'Project Finished': { id: 'b4b210de-54c4-4ab2-a156-ed489114d2b4', icon: '✅', color: '#00695c' }
    },
    'NEWTECH TRAILERS': {
        'Project': { id: '9240e88c-81ac-4cc6-b6b4-8f0fc6fd4cb6', icon: '📋', color: '#1976d2' },
        'Priority Project': { id: '8d17a65a-8fe6-4335-9121-52aaa35aa804', icon: '🔥', color: '#f57c00' },
        'Current Project': { id: 'd3742519-e50d-4c58-a162-86de57374955', icon: '🚀', color: '#388e3c' },
        'Rejected': { id: '9e3d844c-4aa5-4808-ab9e-981253936381', icon: '❌', color: '#d32f2f' },
        'Revision': { id: '3d984503-a1c9-4a19-b802-0969de3a5ed7', icon: '🔄', color: '#f9a825' },
        'Waiting Approval': { id: '517a684d-dbd0-46b4-a616-3ce7be040214', icon: '⏳', color: '#7b1fa2' },
        'Project Finished': { id: 'b4b210de-54c4-4ab2-a156-ed489114d2b4', icon: '✅', color: '#00695c' }
    },
    'FLECK GROUP': {
        'Project': { id: '9240e88c-81ac-4cc6-b6b4-8f0fc6fd4cb6', icon: '📋', color: '#1976d2' },
        'Priority Project': { id: '8d17a65a-8fe6-4335-9121-52aaa35aa804', icon: '🔥', color: '#f57c00' },
        'Current Project': { id: 'd3742519-e50d-4c58-a162-86de57374955', icon: '🚀', color: '#388e3c' },
        'Rejected': { id: '9e3d844c-4aa5-4808-ab9e-981253936381', icon: '❌', color: '#d32f2f' },
        'Revision': { id: '3d984503-a1c9-4a19-b802-0969de3a5ed7', icon: '🔄', color: '#f9a825' },
        'Waiting Approval': { id: '517a684d-dbd0-46b4-a616-3ce7be040214', icon: '⏳', color: '#7b1fa2' },
        'Project Finished': { id: 'b4b210de-54c4-4ab2-a156-ed489114d2b4', icon: '✅', color: '#00695c' }
    },
    'VEBLEN (Internal)': {
        'Project': { id: 'a457b89b-0693-4b59-8504-2d8e91183094', icon: '📋', color: '#1976d2' },
        'Priority Project': { id: '4a66cec6-cc39-437f-983f-603c75f319ae', icon: '🔥', color: '#f57c00' },
        'Current Project': { id: '48ad4ee5-9518-4b05-a1b3-14a1dcbcae09', icon: '🚀', color: '#388e3c' },
        'Rejected': { id: '874ec4f2-8cff-4c8f-b6db-09179bc0195c', icon: '❌', color: '#d32f2f' },
        'Revision': { id: 'd23b1ed5-d12c-4777-832f-f9714fed06a3', icon: '🔄', color: '#f9a825' },
        'Waiting Approval': { id: 'b376ae38-c0f9-429f-ac1a-f0b4d828e01c', icon: '⏳', color: '#7b1fa2' },
        'Project Finished': { id: 'd12f90cd-44f9-4370-96ac-46c7a85e8383', icon: '✅', color: '#00695c' }
    }
};

// DOM Elements
const employeeSelect = document.getElementById('employeeSelect');
const activeTaskSection = document.getElementById('activeTaskSection');
const newTaskSection = document.getElementById('newTaskSection');
const assignedTasksSection = document.getElementById('assignedTasksSection');
const currentTaskName = document.getElementById('currentTaskName');
const taskDetails = document.getElementById('taskDetails');
const timer = document.getElementById('timer');
const taskStatus = document.getElementById('taskStatus');
const todaySummary = document.getElementById('todaySummary');
const loadingOverlay = document.getElementById('loadingOverlay');
const assignedTasksList = document.getElementById('assignedTasksList');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 VEBLEN Task Tracker loaded');
    
    // Update time display
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    
    // Load saved employee from localStorage
    const savedEmployee = localStorage.getItem('veblen_current_employee');
    if (savedEmployee) {
        employeeSelect.value = savedEmployee;
        loadEmployeeData();
    }
    
    // Crash recovery - check for active tasks on page load
    if (savedEmployee) {
        recoverActiveTask();
    }
    
    // Auto-save timer state every 10 seconds
    setInterval(saveTimerState, 10000);
    
    // Save timer state before page unload
    window.addEventListener('beforeunload', saveTimerState);
});

// Time display
function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('currentTime').textContent = timeString;
    
    // Update time clock modal if open
    const timeClockDisplay = document.getElementById('timeClockDisplay');
    if (timeClockDisplay) {
        timeClockDisplay.textContent = now.toLocaleTimeString('en-US', { 
            hour12: true,
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    const timeClockDate = document.getElementById('timeClockDate');
    if (timeClockDate) {
        timeClockDate.textContent = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

// Employee selection handler
function loadEmployeeData() {
    currentEmployee = employeeSelect.value;
    
    if (!currentEmployee) {
        hideActiveTask();
        updateTodayProgress({ total_hours: '0.0', completed_tasks: 0, companies_worked: 0 });
        assignedTasksList.innerHTML = '<p class="empty-state">Select an employee to see assigned tasks</p>';
        return;
    }

    // Save to localStorage
    localStorage.setItem('veblen_current_employee', currentEmployee);
    showNotification(`Switched to ${currentEmployee}`, 'success');
    
    showLoading(true);
    
    Promise.all([
        // Check for active tasks
        makeApiCall('get_active_task', { employee: currentEmployee }),
        // Get today's summary
        makeApiCall('today_summary', { employee: currentEmployee }),
        // Get assigned tasks from intake system
        makeApiCall('get_assigned_tasks', { employee: currentEmployee })
    ])
    .then(([activeTaskData, summaryData, assignedTasksData]) => {
        // Handle active task
        if (activeTaskData.active_task) {
            showActiveTask(activeTaskData.active_task);
            if (activeTaskData.active_task.status === 'active') {
                resumeTimer(activeTaskData.active_task);
            }
        } else {
            hideActiveTask();
        }
        
        // Update today's progress
        updateTodayProgress(summaryData);
        
        // Update assigned tasks
        updateAssignedTasks(assignedTasksData);
    })
    .catch(error => {
        console.error('Error loading employee data:', error);
        showNotification('Error loading data', 'error');
    })
    .finally(() => {
        showLoading(false);
    });
}

// Toggle new task form
function toggleNewTaskForm() {
    if (!currentEmployee) {
        showNotification('Please select an employee first', 'error');
        return;
    }
    
    newTaskSection.classList.toggle('hidden');
    if (!newTaskSection.classList.contains('hidden')) {
        document.getElementById('taskName').focus();
    }
}

// Start new task
function startNewTask() {
    const taskName = document.getElementById('taskName').value.trim();
    const company = document.getElementById('company').value;
    const taskType = document.getElementById('taskType').value;
    const description = document.getElementById('taskDescription').value.trim();

    // Validation
    if (!currentEmployee) {
        showNotification('Please select an employee first', 'error');
        return;
    }

    if (!taskName || !company || !taskType) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    showLoading(true);

    const taskData = {
        action: 'start_task',
        employee: currentEmployee,
        task_name: taskName,
        company: company,
        task_type: taskType,
        description: description,
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
                newTaskSection.classList.add('hidden');
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

// Start timing an existing task from intake system
function startTaskTiming(taskId, taskName, company, masterId, companyId) {
    if (!currentEmployee) {
        showNotification('Please select an employee first', 'error');
        return;
    }

    showLoading(true);

    makeApiCall('start_existing_task', {
        employee: currentEmployee,
        task_id: taskId,
        task_name: taskName,
        company: company,
        master_id: masterId,
        company_id: companyId,
        timestamp: new Date().toISOString()
    })
    .then(data => {
        if (data.success) {
            showNotification('Task timer started! ⏱️', 'success');
            loadEmployeeData(); // Refresh to show active task
        } else {
            throw new Error(data.message || 'Failed to start task timer');
        }
    })
    .catch(error => {
        console.error('Error starting task timer:', error);
        showNotification('Failed to start task timer', 'error');
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
            
            // Refresh assigned tasks to show updated status
            loadEmployeeData();
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

// Update assigned tasks display
function updateAssignedTasks(data) {
    if (!data.tasks || data.tasks.length === 0) {
        assignedTasksList.innerHTML = '<p class="empty-state">No assigned tasks found</p>';
        return;
    }
    
    const tasksHtml = data.tasks.map(task => {
        const statusClass = getStatusClass(task.current_status);
        const statusBadge = getStatusBadge(task.current_status, task.company);
        const priorityClass = task.current_status === 'Priority Project' ? 'priority' : 
                            task.current_status === 'Current Project' ? 'current' : '';
        
        return `
            <div class="task-item ${priorityClass}" data-task-id="${task.id}">
                <div class="task-item-header">
                    <div class="task-item-info">
                        <div class="task-item-title">${task.name}</div>
                        <div class="task-item-meta">
                            <strong>${task.company}</strong> • Due: ${task.due_date || 'No deadline'}
                        </div>
                    </div>
                    <div class="task-status-badge ${statusClass}">
                        ${statusBadge}
                    </div>
                </div>
                
                <div class="task-item-actions">
                    <button class="btn-small btn-primary" onclick="startTaskTiming('${task.id}', '${task.name}', '${task.company}', '${task.master_id}', '${task.company_id}')">
                        ⏱️ Start Timer
                    </button>
                    <button class="btn-small btn-secondary" onclick="openStatusModal('${task.id}', '${task.name}', '${task.company}', '${task.current_status}', '${task.master_id}', '${task.company_id}')">
                        🔄 Update Status
                    </button>
                    <button class="btn-small btn-info" onclick="showTaskDetails('${task.id}')">
                        👁️ Details
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    assignedTasksList.innerHTML = tasksHtml;
}

// Status management functions
function openStatusModal(taskId, taskName, company, currentStatus, masterId, companyId) {
    selectedTaskForStatus = {
        id: taskId,
        name: taskName,
        company: company,
        currentStatus: currentStatus,
        masterId: masterId,
        companyId: companyId
    };

    document.getElementById('statusTaskName').textContent = taskName;
    document.getElementById('statusTaskCompany').textContent = company;
    document.getElementById('statusCurrentStatus').textContent = currentStatus;

    // Populate status options
    const statusOptions = document.getElementById('statusOptions');
    const companyStatuses = STATUS_CONFIG[company] || STATUS_CONFIG['VEBLEN (Internal)'];
    
    statusOptions.innerHTML = Object.entries(companyStatuses).map(([statusName, config]) => `
        <div class="status-option ${currentStatus === statusName ? 'selected' : ''}" 
             data-status="${statusName}" data-status-id="${config.id}"
             onclick="selectStatus('${statusName}', '${config.id}')">
            <div class="status-icon" style="background-color: ${config.color}40; border: 2px solid ${config.color};">
                <span style="font-size: 12px;">${config.icon}</span>
            </div>
            <span>${statusName}</span>
        </div>
    `).join('');

    document.getElementById('statusModal').classList.remove('hidden');
}

function closeStatusModal() {
    document.getElementById('statusModal').classList.add('hidden');
    selectedTaskForStatus = null;
}

function selectStatus(statusName, statusId) {
    document.querySelectorAll('.status-option').forEach(option => {
        option.classList.remove('selected');
    });
    document.querySelector(`[data-status="${statusName}"]`).classList.add('selected');
}

function updateTaskStatus() {
    if (!selectedTaskForStatus) return;

    const selectedOption = document.querySelector('.status-option.selected');
    if (!selectedOption) {
        showNotification('Please select a status', 'warning');
        return;
    }

    const newStatus = selectedOption.dataset.status;
    const newStatusId = selectedOption.dataset.statusId;

    showLoading(true);

    makeApiCall('update_task_status', {
        employee: currentEmployee,
        task_id: selectedTaskForStatus.id,
        master_id: selectedTaskForStatus.masterId,
        company_id: selectedTaskForStatus.companyId,
        new_status: newStatus,
        new_status_id: newStatusId,
        company: selectedTaskForStatus.company,
        timestamp: new Date().toISOString()
    })
    .then(data => {
        if (data.success) {
            showNotification(`Status updated to "${newStatus}" ✅`, 'success');
            closeStatusModal();
            loadEmployeeData(); // Refresh task list
        } else {
            throw new Error(data.message || 'Failed to update status');
        }
    })
    .catch(error => {
        console.error('Error updating task status:', error);
        showNotification('Failed to update status', 'error');
    })
    .finally(() => {
        showLoading(false);
    });
}

// Helper functions for task status
function getStatusClass(status) {
    const statusMap = {
        'Project': 'status-project',
        'Priority Project': 'status-priority',
        'Current Project': 'status-current',
        'Revision': 'status-revision',
        'Waiting Approval': 'status-waiting',
        'Rejected': 'status-rejected',
        'Project Finished': 'status-finished'
    };
    return statusMap[status] || 'status-project';
}

function getStatusBadge(status, company) {
    const companyStatuses = STATUS_CONFIG[company] || STATUS_CONFIG['VEBLEN (Internal)'];
    const statusConfig = companyStatuses[status];
    return statusConfig ? `${statusConfig.icon} ${status}` : status;
}

function showTaskDetails(taskId) {
                    showNotification('Task details coming soon! 📋', 'info');
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
    document.getElementById('taskDescription').value = '';
}

function updateTodayProgress(data) {
    const progressItems = todaySummary.querySelectorAll('.progress-item');
    progressItems[0].querySelector('.progress-value').textContent = data.total_hours || '0.0';
    progressItems[1].querySelector('.progress-value').textContent = data.completed_tasks || '0';
    progressItems[2].querySelector('.progress-value').textContent = data.companies_worked || '0';
}

function loadTodaySummary() {
    if (!currentEmployee) return Promise.resolve();

    return makeApiCall('today_summary', { employee: currentEmployee })
        .then(data => {
            updateTodayProgress(data);
        })
        .catch(error => {
            console.error('Error loading today summary:', error);
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

// Crash recovery functions
function saveTimerState() {
    if (currentTaskId && currentEmployee && startTime) {
        const timerState = {
            employee: currentEmployee,
            taskId: currentTaskId,
            taskData: activeTaskData,
            startTime: startTime,
            pausedTime: pausedTime,
            isRunning: currentTimer !== null,
            lastSaved: Date.now()
        };
        localStorage.setItem('veblen_timer_state', JSON.stringify(timerState));
    } else {
        // Clear saved state if no active task
        localStorage.removeItem('veblen_timer_state');
    }
}

function recoverActiveTask() {
    const savedTimerState = localStorage.getItem('veblen_timer_state');
    if (!savedTimerState) return;
    
    try {
        const timerState = JSON.parse(savedTimerState);
        const timeSinceLastSave = Date.now() - timerState.lastSaved;
        
        // Only recover if saved within last 10 minutes (crash recovery)
        if (timeSinceLastSave < 10 * 60 * 1000 && timerState.employee === currentEmployee) {
            console.log('🔄 Recovering active task from crash...');
            
            // Restore task data
            currentTaskId = timerState.taskId;
            activeTaskData = timerState.taskData;
            
            // Show task recovery notification
            showNotification('⚡ Recovered active task from crash! Syncing with server...', 'info');
            
            // Verify with server and restore timer
            makeApiCall('get_active_task', { employee: currentEmployee })
                .then(data => {
                    if (data.active_task && data.active_task.task_id === currentTaskId) {
                        showActiveTask(data.active_task);
                        
                        if (data.active_task.status === 'active' && timerState.isRunning) {
                            // Calculate time that should have elapsed
                            const serverTime = (data.active_task.total_seconds || 0) * 1000;
                            pausedTime = serverTime;
                            startTimer();
                            showNotification('✅ Task timer recovered and synced!', 'success');
                        } else {
                            showNotification('⏸️ Task recovered in paused state', 'info');
                        }
                    } else {
                        // Task no longer active on server, clear local state
                        localStorage.removeItem('veblen_timer_state');
                        showNotification('ℹ️ Previous task was completed on another device', 'info');
                    }
                })
                .catch(error => {
                    console.error('Error recovering task:', error);
                    showNotification('⚠️ Could not verify task with server', 'warning');
                });
        } else {
            // Clear old saved state
            localStorage.removeItem('veblen_timer_state');
        }
    } catch (error) {
        console.error('Error parsing saved timer state:', error);
        localStorage.removeItem('veblen_timer_state');
    }
}

// Enhanced timer functions with crash protection
function startTimer() {
    startTime = Date.now() - pausedTime;
    currentTimer = setInterval(() => {
        updateTimer();
        // Save state every 10 timer updates (10 seconds)
        if (Math.floor((Date.now() - startTime) / 1000) % 10 === 0) {
            saveTimerState();
        }
    }, 1000);
    saveTimerState();
}

function stopTimer() {
    pauseTimer();
    timer.textContent = '00:00:00';
    pausedTime = 0;
    startTime = null;
    localStorage.removeItem('veblen_timer_state');
}

// Close modal when clicking outside
document.getElementById('statusModal').addEventListener('click', function(event) {
    if (event.target === this) {
        closeStatusModal();
    }
});

document.getElementById('timeClockModal').addEventListener('click', function(event) {
    if (event.target === this) {
        closeTimeClockModal();
    }
});

document.getElementById('dailyReportModal').addEventListener('click', function(event) {
    if (event.target === this) {
        closeDailyReportModal();
    }
});
