// Configuration
const CONFIG = {
  n8nWebhookUrl: '/api/task-action'
};

// Progress attribute IDs for each company
const PROGRESS_ATTRIBUTES = {
  "CROWN REALITY": "eb943dd8-dd91-4620-a875-59bdeee59a1f",
  "LCMB GROUP": "4cff12df-fc0d-40aa-aade-e52161b37621",
  "NEWTECH TRAILERS": "f78f7f1b-ec1f-4f1b-972b-6931f6925373",
  "VEBLEN (Internal)": "05ba9fd9-6829-4049-8366-a1ec8d9281d4",
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
let workSessions = [];
let activeTaskProgress = 0;

// Store loaded tasks globally
window.loadedTasks = [];

// ─── Utilities ─────────────────────────────────────────────────────────

function fmt(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

async function sendToWebhook(payload, fileInput) {
  let opts;
  if (fileInput && fileInput.files[0]) {
    const form = new FormData();
    Object.entries(payload).forEach(([k, v]) => form.append(k, v));
    form.append(fileInput.name, fileInput.files[0]);
    opts = { method: 'POST', body: form };
  } else {
    opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    };
  }
  const res = await fetch(CONFIG.n8nWebhookUrl, opts);
  return res.json();
}

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => t.remove(), 5000);
}

// ─── Initialization ───────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('selectedEmployee');
  if (saved) {
    document.getElementById('employeeSelect').value = saved;
    currentEmployee = saved;
    loadEmployeeData();
  }

  // Event listeners
  document.getElementById('employeeSelect').addEventListener('change', handleEmployeeChange);
  document.getElementById('newTaskForm').addEventListener('submit', handleStartTask);
  document.getElementById('pauseTaskBtn').addEventListener('click', handlePauseTask);
  document.getElementById('completeTaskBtn').addEventListener('click', handleCompleteTask);
  document.getElementById('refreshTasksBtn').addEventListener('click', loadAssignedTasks);
  document.getElementById('dailyReportForm').addEventListener('submit', handleDailyReport);
  document.getElementById('statusUpdateForm').addEventListener('submit', handleStatusUpdate);
  document.getElementById('refreshSummaryBtn').addEventListener('click', loadTodaySummary);
  document.getElementById('startWorkBtn').addEventListener('click', () => handleTimeClock('🟢 START WORK'));
  document.getElementById('breakBtn').addEventListener('click',     () => handleTimeClock('☕ BREAK'));
  document.getElementById('backToWorkBtn').addEventListener('click',() => handleTimeClock('🔵 BACK TO WORK'));
  document.getElementById('endWorkBtn').addEventListener('click',    () => handleTimeClock('🔴 END WORK'));
  document.getElementById('taskImage').addEventListener('change', handleImagePreview);
  document.getElementById('screenshot').addEventListener('change', handleReportImagePreview);
  document.getElementById('reportDate').valueAsDate = new Date();

  checkForCrashedSession();
});

// ─── Employee & Data Loading ─────────────────────────────────────────

function handleEmployeeChange(e) {
  currentEmployee = e.target.value;
  localStorage.setItem('selectedEmployee', currentEmployee);
  if (currentEmployee) loadEmployeeData();
  else clearEmployeeData();
}

async function loadEmployeeData() {
  await checkActiveTask();
  await loadAssignedTasks();
  await loadTodaySummary();
}

function clearEmployeeData() {
  document.getElementById('activeTaskDisplay').style.display = 'none';
  document.getElementById('assignedTasksList').innerHTML = '<p class="loading">Select an employee to view assigned tasks...</p>';
  document.getElementById('todaySummary').innerHTML       = '<p class="loading">Select an employee to view summary...</p>';
}

// ─── Active Task Check ─────────────────────────────────────────────────

async function checkActiveTask() {
  if (!currentEmployee) return;
  try {
    const resp = await sendToWebhook({ action: 'get_active_task', employee: currentEmployee });
    if (resp.success && resp.data.active_task) {
      activeTask     = resp.data.active_task;
      workSessions   = parseWorkSessions(activeTask.description || '');
      showActiveTask();
      startTimer();
    } else hideActiveTask();
  } catch (err) {
    console.error(err);
    showToast('Error checking active task', 'error');
  }
}

function parseWorkSessions(desc) {
  const sessions = [];
  desc.split('\n').forEach(line => {
    if (line.includes('Time worked:')) {
      const dateMatch = line.match(/\[(\d{4}-\d{2}-\d{2})\]/);
      const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
      const times = line.match(/\d{2}:\d{2}/g) || [];
      for (let i = 0; i < times.length; i += 2) {
        if (times[i+1]) sessions.push({ date, start: times[i], end: times[i+1] });
      }
    }
  });
  return sessions;
}

function formatWorkSessions() {
  const byDate = {};
  workSessions.forEach(s => {
    byDate[s.date] = byDate[s.date]||[];
    byDate[s.date].push(`${s.start} to ${s.end||fmt(0)}`);
  });
  let desc = activeTask.original_description||'';
  Object.entries(byDate).forEach(([d,times]) => {
    const line = `\n[${d}] Time worked: ${times.join(', ')}`;
    const re = new RegExp(`\\[${d}\\] Time worked:.*`, 'g');
    desc = desc.match(re)? desc.replace(re, line.trim()) : desc + line;
  });
  return desc.trim();
}

// ─── Task Handlers ────────────────────────────────────────────────────

async function handleStartTask(e) {
  e.preventDefault();
  if (!currentEmployee) {
    showToast('Please select an employee first', 'warning');
    return;
  }
  // Start new task timer
  const name = document.getElementById('taskName').value;
  const comp = document.getElementById('company').value;
  const type = document.getElementById('taskType').value;
  const desc = document.getElementById('description').value;
  const fileInput = document.getElementById('taskImage');

  const payload = {
    action:      'start_task',
    employee:    currentEmployee,
    task_name:   name,
    company:     comp,
    task_type:   type,
    description: desc,
    timestamp:   new Date().toISOString()
  };

  const resp = await sendToWebhook(payload, fileInput);
  if (resp.success) {
    activeTask = {
      task_id:              resp.data.task_id,
      task_name:            name,
      company:              comp,
      task_type:            type,
      original_description: desc
    };
    workSessions = [{
      date:  new Date().toISOString().split('T')[0],
      start: new Date().toTimeString().slice(0,5),
      end:   null
    }];
    document.getElementById('newTaskForm').reset();
    document.getElementById('imagePreview').innerHTML = '';
    showActiveTask();
    startTimer();
    showToast('Task started successfully!', 'success');
  } else {
    showToast('Failed to start task', 'error');
  }
}

function handleImagePreview(e) {
  const file = e.target.files[0];
  const preview = document.getElementById('imagePreview');
  preview.innerHTML = '';
  if (file) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.style.maxWidth = '200px';
    preview.appendChild(img);
  }
}

async function handlePauseTask() {
  if (!activeTask) return;
  const now = new Date();
  const last = workSessions[workSessions.length-1];
  if (last && !last.end) last.end = now.toTimeString().slice(0,5);
  const updatedDesc = formatWorkSessions();

  const payload = {
    action:          'pause_task',
    employee:        currentEmployee,
    task_id:         activeTask.task_id,
    description:     updatedDesc,
    elapsed_seconds: elapsedSeconds,
    timestamp:       now.toISOString()
  };

  const resp = await sendToWebhook(payload);
  if (resp.success) {
    stopTimer();
    hideActiveTask();
    activeTask    = null;
    workSessions  = [];
    showToast('Task paused successfully!', 'success');
  } else {
    showToast('Failed to pause task', 'error');
  }
}

async function handleCompleteTask() {
  if (!activeTask) return;
  const note = prompt('Add completion notes (optional):') || '';
  const now  = new Date();
  const last = workSessions[workSessions.length-1];
  if (last && !last.end) last.end = now.toTimeString().slice(0,5);
  let finalDesc = formatWorkSessions();
  if (note) finalDesc += `\n\nCompletion notes: ${note}`;

  const payload = {
    action:          'complete_task',
    employee:        currentEmployee,
    task_id:         activeTask.task_id,
    description:     finalDesc,
    elapsed_seconds: elapsedSeconds,
    timestamp:       now.toISOString()
  };

  const resp = await sendToWebhook(payload);
  if (resp.success) {
    stopTimer();
    hideActiveTask();
    activeTask   = null;
    workSessions = [];
    showToast('Task completed successfully!', 'success');
    loadAssignedTasks();
    loadTodaySummary();
  } else {
    showToast('Failed to complete task', 'error');
  }
}

async function resumeTask() {
  if (!activeTask) return;
  workSessions.push({
    date:  new Date().toISOString().split('T')[0],
    start: new Date().toTimeString().slice(0,5),
    end:   null
  });
  startTimer();
}

// ─── Assigned Tasks ───────────────────────────────────────────────────

async function loadAssignedTasks() {
  if (!currentEmployee) {
    document.getElementById('assignedTasksList').innerHTML = '<p class="loading">Select an employee…</p>';
    return;
  }
  const resp = await sendToWebhook({ action: 'get_assigned_tasks', employee: currentEmployee });
  if (resp.success && resp.data.tasks) {
    window.loadedTasks = resp.data.tasks;
    displayAssignedTasks(resp.data.tasks);
  } else {
    document.getElementById('assignedTasksList').innerHTML = '<p class="loading">No assigned tasks found.</p>';
  }
}

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
        <button class="btn btn-primary btn-sm" onclick="startTaskFromAssigned('${task.intake_task_id}', '${task.task_name}', '${task.company}')">🚀 Start Working</button>
        <button class="btn btn-secondary btn-sm" onclick="openTaskEditor('${task.intake_task_id}')">✏️ Edit Task</button>
      </div>
    </div>
  `).join('');
}

async function updateTaskProgress(slider) {
  const progress = parseInt(slider.value);
  const taskId   = slider.dataset.taskId;
  const company  = slider.dataset.company;
  const card     = slider.closest('.task-card');
  const bar      = card.querySelector('.progress-bar');
  const valEl    = card.querySelector('.progress-value');

  bar.style.width    = `${progress}%`;
  valEl.textContent  = `${progress}%`;

  let newStatus = null;
  if (progress === 0) newStatus = "Project";
  else if (progress >= 10 && progress < 100) newStatus = "Current Project";
  else if (progress === 100) newStatus = "Project Finished";

  let statusChanged = false;
  if (newStatus) {
    const cur = card.querySelector('.task-status').textContent;
    if (cur !== newStatus) {
      statusChanged = true;
      showToast(`Status will change to: ${newStatus}`, 'info');
    }
  }

  const payload = {
    action:                'update_task_progress',
    employee:              currentEmployee,
    task_id:               taskId,
    company:               company,
    progress:              progress,
    new_status:            statusChanged ? newStatus : null,
    progress_attribute_id: PROGRESS_ATTRIBUTES[company],
    timestamp:             new Date().toISOString()
  };

  const resp = await sendToWebhook(payload);
  if (resp.success) {
    showToast(`Progress updated to ${progress}%`, 'success');
    if (statusChanged && newStatus) {
      const statusEl = card.querySelector('.task-status');
      statusEl.textContent = newStatus;
      statusEl.className   = `task-status ${getStatusClass(newStatus)}`;
    }
  } else {
    showToast('Failed to update progress', 'error');
    slider.value      = slider.defaultValue;
    bar.style.width   = `${slider.defaultValue}%`;
    valEl.textContent = `${slider.defaultValue}%`;
  }
}

function startTaskFromAssigned(id, name, company) {
  document.getElementById('taskName').value  = name;
  document.getElementById('company').value   = company;
  document.getElementById('taskType').focus();
  document.querySelector('.time-tracker-section').scrollIntoView({ behavior: 'smooth' });
}

function openTaskEditor(taskId) {
  const task = window.loadedTasks.find(t => t.intake_task_id === taskId);
  if (!task) return;
  const modal = `
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
            <input type="range" id="editTaskProgress" min="0" max="100" value="${task.progress || 0}" oninput="updateProgressDisplay(this.value)">
            <div class="progress-hints">
              <span class="hint">0% = Project</span>
              <span class="hint">10%+ = Current Project</span>
              <span class="hint">100% = Finished</span>
            </div>
          </div>
          <div class="form-group">
            <label for="editTaskStatus">Status (Override automatic)</label>
            <select id="editTaskStatus">
              <option value="">Automatic based on progress</option>
              <option value="Project" ${task.current_status==='Project'?'selected':''}>📋 Project</option>
              <option value="Priority Project" ${task.current_status==='Priority Project'?'selected':''}>⭐ Priority Project</option>
              <option value="Current Project" ${task.current_status==='Current Project'?'selected':''}>🔄 Current Project</option>
              <option value="Revision" ${task.current_status==='Revision'?'selected':''}>📝 Revision</option>
              <option value="Waiting Approval" ${task.current_status==='Waiting Approval'?'selected':''}>⏳ Waiting Approval</option>
              <option value="Project Finished" ${task.current_status==='Project Finished'?'selected':''}>✅ Project Finished</option>
              <option value="Rejected" ${task.current_status==='Rejected'?'selected':''}>❌ Rejected</option>
            </select>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeTaskEditor()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modal);
  document.getElementById('taskEditModal').style.display = 'block';
}

function updateProgressDisplay(val) {
  document.getElementById('progressDisplay').textContent = `${val}%`;
  document.getElementById('editProgressBar').style.width     = `${val}%`;
  const auto = val==100?'Project Finished': val>=10?'Current Project':'Project';
  const sel  = document.getElementById('editTaskStatus');
  if (!sel.value) {
    let hint = sel.parentElement.querySelector('.status-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'status-hint';
      sel.parentElement.appendChild(hint);
    }
    hint.textContent = `Auto status: ${auto}`;
  }
}

function closeTaskEditor() {
  const m = document.getElementById('taskEditModal');
  if (m) m.remove();
}

async function handleTaskEdit(e, taskId) {
  e.preventDefault();
  const task = window.loadedTasks.find(t => t.intake_task_id===taskId);
  if (!task) return;
  const progress = parseInt(document.getElementById('editTaskProgress').value);
  let status = document.getElementById('editTaskStatus').value;
  if (!status) status = progress===100?'Project Finished':progress>=10?'Current Project':'Project';
  const payload = {
    action:                'update_task_details',
    employee:              currentEmployee,
    task_id:               taskId,
    company:               task.company,
    task_name:             document.getElementById('editTaskName').value,
    description:           document.getElementById('editTaskDescription').value,
    due_date:              document.getElementById('editTaskDueDate').value,
    progress:              progress,
    status:                status,
    progress_attribute_id: PROGRESS_ATTRIBUTES[task.company],
    timestamp:             new Date().toISOString()
  };
  const resp = await sendToWebhook(payload);
  if (resp.success) {
    showToast('Task updated successfully!', 'success');
    closeTaskEditor();
    loadAssignedTasks();
  } else {
    showToast('Failed to update task', 'error');
  }
}

// ─── Status Update ────────────────────────────────────────────────────

async function handleStatusUpdate(e) {
  e.preventDefault();
  if (!currentEmployee) {
    showToast('Please select an employee first', 'warning');
    return;
  }
  const sel = document.getElementById('statusTaskSelect');
  const opt = sel.options[sel.selectedIndex];
  const payload = {
    action:      'update_task_status',
    employee:    currentEmployee,
    task_id:     sel.value,
    master_id:   opt.dataset.masterId,
    company_id:  opt.dataset.companyId,
    new_status:  document.getElementById('newStatus').value,
    company:     opt.dataset.company,
    timestamp:   new Date().toISOString()
  };
  const resp = await sendToWebhook(payload);
  if (resp.success) {
    document.getElementById('statusUpdateForm').reset();
    showToast('Task status updated successfully!', 'success');
    loadAssignedTasks();
  } else {
    showToast('Failed to update task status', 'error');
  }
}

// ─── Today's Summary ─────────────────────────────────────────────────

async function loadTodaySummary() {
  if (!currentEmployee) {
    document.getElementById('todaySummary').innerHTML = '<p class="loading">Select an employee to view summary...</p>';
    return;
  }
  const resp = await sendToWebhook({ action:'today_summary', employee:currentEmployee });
  if (resp.success && resp.data) displayTodaySummary(resp.data);
  else document.getElementById('todaySummary').innerHTML = '<p class="loading">No data available for today.</p>';
}

function displayTodaySummary(sum) {
  document.getElementById('todaySummary').innerHTML = `
    <div class="summary-stats">
      <div class="stat-item"><h4>Total Hours</h4><p class="stat-value">${sum.total_hours||0}</p></div>
      <div class="stat-item"><h4>Tasks Completed</h4><p class="stat-value">${sum.tasks_completed||0}</p></div>
      <div class="stat-item"><h4>Active Tasks</h4><p class="stat-value">${sum.active_tasks?.length||0}</p></div>
    </div>`;
}

// ─── Time Clock ──────────────────────────────────────────────────────

async function handleTimeClock(action) {
  if (!currentEmployee) {
    showToast('Please select an employee first', 'warning');
    return;
  }
  if ((action==='☕ BREAK'||action==='🔴 END WORK') && activeTask) await handlePauseTask();
  if (action==='🔵 BACK TO WORK' && activeTask) await resumeTask();
  const payload = { action:'time_clock', employee:currentEmployee, clock_action:action, timestamp:new Date().toISOString() };
  const resp    = await sendToWebhook(payload);
  if (resp.success) {
    showToast(`${action} recorded successfully!`, 'success');
    updateTimeClockStatus(action);
  } else {
    showToast('Failed to record time clock action', 'error');
  }
}

function updateTimeClockStatus(action) {
  document.getElementById('timeClockStatus').innerHTML = `Last action: ${action} at ${new Date().toLocaleTimeString()}`;
}

// ─── Daily Report ───────────────────────────────────────────────────

function handleReportImagePreview(e) {
  const file = e.target.files[0];
  if (!file) return;
  const p = document.getElementById('reportPhotoPreview');
  const r = new FileReader();
  r.onload = ev => p.innerHTML = `<img src="${ev.target.result}" style="max-width:200px;"><p>Photo ready for upload</p>`;
  r.readAsDataURL(file);
}

async function handleDailyReport(e) {
  e.preventDefault();
  if (!currentEmployee) {
    showToast('Please select an employee first', 'warning');
    return;
  }
  // auto‑fill total time spent
  document.getElementById('totalTimeSpent').value = fmt(elapsedSeconds);

  const fileInput = document.getElementById('screenshot');
  const payload = {
    action:            'daily_report',
    employee:          currentEmployee,
    company:           document.getElementById('reportCompany').value,
    date:              document.getElementById('reportDate').value,
    project_name:      document.getElementById('projectName').value,
    num_revisions:     parseInt(document.getElementById('numRevisions').value),
    total_time_spent:  document.getElementById('totalTimeSpent').value,
    notes:             document.getElementById('reportNotes').value,
    links:             document.getElementById('reportLinks').value,
    feedback_requests: document.getElementById('feedbackRequests').value,
    timestamp:         new Date().toISOString()
  };

  const resp = await sendToWebhook(payload, fileInput);
  if (resp.success) {
    document.getElementById('dailyReportForm').reset();
    document.getElementById('reportPhotoPreview').innerHTML = '';
    showToast('Daily report submitted successfully!', 'success');
  } else {
    showToast('Failed to submit daily report', 'error');
  }
}

// ─── Timer & Persistence ─────────────────────────────────────────────

function startTimer() {
  if (timerInterval) return;
  const start = Date.now() - (elapsedSeconds * 1000);
  timerInterval = setInterval(() => {
    elapsedSeconds = Math.floor((Date.now() - start) / 1000);
    document.getElementById('timerDisplay').textContent = fmt(elapsedSeconds);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function saveTimerState() {
  if (!activeTask) return;
  localStorage.setItem('timerState', JSON.stringify({
    activeTask, elapsedSeconds, workSessions,
    lastSaved: new Date().toISOString()
  }));
}

async function checkForCrashedSession() {
  const s = localStorage.getItem('timerState');
  if (!s) return;
  try {
    const st = JSON.parse(s);
    const diff = (Date.now() - new Date(st.lastSaved)) / 1000;
    if (diff > 30 && confirm('A previous session was detected. Recover it?')) {
      activeTask     = st.activeTask;
      workSessions   = st.workSessions || [];
      elapsedSeconds = st.elapsedSeconds + Math.floor(diff);
      showActiveTask();
      startTimer();
      showToast('Session recovered successfully!', 'success');
    } else {
      localStorage.removeItem('timerState');
    }
  } catch {
    localStorage.removeItem('timerState');
  }
}

window.addEventListener('beforeunload', () => {
  if (activeTask) saveTimerState();
});

// ─── Helpers ─────────────────────────────────────────────────────────

function showActiveTask() {
  document.getElementById('activeTaskDisplay').style.display = 'block';
  document.getElementById('startTaskForm').style.display       = 'none';
  document.getElementById('currentTaskName').textContent       = activeTask.task_name;
  document.getElementById('currentCompany').textContent        = activeTask.company;
  document.getElementById('currentTaskType').textContent       = activeTask.task_type;
  document.getElementById('timerDisplay').textContent          = fmt(elapsedSeconds);
}

function hideActiveTask() {
  document.getElementById('activeTaskDisplay').style.display = 'none';
  document.getElementById('startTaskForm').style.display     = 'block';
  localStorage.removeItem('timerState');
}

function getStatusClass(status) {
  const cls = {
    'Project':           'status-project',
    'Priority Project':  'status-priority',
    'Current Project':   'status-current',
    'Revision':          'status-revision',
    'Waiting Approval':  'status-waiting',
    'Project Finished':  'status-finished',
    'Rejected':          'status-rejected'
  };
  return cls[status] || 'status-default';
}
