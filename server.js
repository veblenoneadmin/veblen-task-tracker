// Add this after your existing routes and before error handling

// Mock API endpoints for testing
app.post('/api/task-action', (req, res) => {
    const { action, employee, task_name, company, task_type, timestamp } = req.body;
    
    // Mock response based on action
    const mockResponses = {
        start_task: {
            success: true,
            message: "Task started successfully",
            data: {
                task_id: `task_${Date.now()}`,
                timestamp: new Date().toISOString()
            }
        },
        pause_task: {
            success: true,
            message: "Task paused successfully",
            data: {
                timestamp: new Date().toISOString()
            }
        },
        complete_task: {
            success: true,
            message: "Task completed successfully",
            data: {
                timestamp: new Date().toISOString()
            }
        },
        get_active_task: {
            success: true,
            data: {
                active_task: null
            }
        },
        today_summary: {
            success: true,
            data: {
                total_hours: 0,
                tasks_completed: 0,
                active_tasks: []
            }
        },
        get_assigned_tasks: {
            success: true,
            data: {
                tasks: []
            }
        },
        time_clock: {
            success: true,
            message: "Time clock action recorded"
        },
        daily_report: {
            success: true,
            message: "Daily report submitted"
        },
        update_task_status: {
            success: true,
            message: "Task status updated"
        }
    };
    
    const response = mockResponses[action] || {
        success: false,
        message: "Unknown action"
    };
    
    res.json(response);
});

app.post('/api/sheets', (req, res) => {
    // Mock Google Sheets API response
    res.json({
        success: true,
        message: "Sheet operation completed",
        data: {}
    });
});

// Health check for API
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        api: 'mock',
        timestamp: new Date().toISOString()
    });
});
