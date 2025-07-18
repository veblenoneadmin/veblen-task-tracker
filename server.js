const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Webhook URLs
const WEBHOOKS = {
    reportLogger: 'https://primary-s0q-production.up.railway.app/webhook/reportlogger',
    taskIntake: 'https://primary-s0q-production.up.railway.app/webhook/taskintake',
    timeLogger: 'https://primary-s0q-production.up.railway.app/webhook/timelogger'
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve files from root directory

// Serve main dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'VEBLEN Task Tracker'
    });
});

// API endpoint to handle all task actions
app.post('/api/task-action', async (req, res) => {
    try {
        const { action } = req.body;
        let webhookUrl;
        
        // Determine which webhook to use based on action
        switch (action) {
            case 'time_clock':
            case 'start_task':
            case 'pause_task':
            case 'complete_task':
            case 'get_active_task':
            case 'today_summary':
                webhookUrl = WEBHOOKS.timeLogger;
                break;
            case 'daily_report':
                webhookUrl = WEBHOOKS.reportLogger;
                break;
            case 'create_task':
            case 'get_assigned_tasks':
            case 'update_task_status':
            case 'update_task_details':
                webhookUrl = WEBHOOKS.taskIntake;
                break;
            default:
                // For unknown actions, try to determine based on data
                if (req.body.photo_url) {
                    webhookUrl = WEBHOOKS.reportLogger;
                } else if (req.body.clock_action) {
                    webhookUrl = WEBHOOKS.timeLogger;
                } else {
                    webhookUrl = WEBHOOKS.taskIntake;
                }
        }
        
        // Forward request to appropriate webhook
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            res.json(data);
        } else {
            res.status(response.status).json(data);
        }
    } catch (error) {
        console.error('Task action error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Task Update API endpoint
app.post('/api/task-update', async (req, res) => {
    try {
        const updateData = req.body;
        
        // Validate required fields
        if (!updateData.task_id || !updateData.company || !updateData.action) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: task_id, company, or action'
            });
        }
        
        // Forward to task intake webhook for updates
        const response = await fetch(WEBHOOKS.taskIntake, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            res.json(result);
        } else {
            res.status(response.status).json(result);
        }
    } catch (error) {
        console.error('Task update error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Get task details endpoint
app.get('/api/task/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { company } = req.query;
        
        if (!company) {
            return res.status(400).json({
                success: false,
                error: 'Company parameter is required'
            });
        }
        
        // Forward to task intake webhook
        const response = await fetch(WEBHOOKS.taskIntake, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'get_task_details',
                task_id: taskId,
                company: company
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            res.json(data);
        } else {
            res.status(response.status).json(data);
        }
    } catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Batch update endpoint
app.post('/api/tasks/batch-update', async (req, res) => {
    try {
        const { tasks, action, update_data } = req.body;
        
        if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Tasks array is required'
            });
        }
        
        // Process batch updates
        const results = [];
        for (const task of tasks) {
            try {
                const updatePayload = {
                    ...update_data,
                    task_id: task.task_id,
                    company: task.company,
                    action: action
                };
                
                const response = await fetch(WEBHOOKS.taskIntake, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(updatePayload)
                });
                
                const result = await response.json();
                results.push({
                    task_id: task.task_id,
                    success: response.ok,
                    result: result
                });
            } catch (error) {
                results.push({
                    task_id: task.task_id,
                    success: false,
                    error: error.message
                });
            }
        }
        
        res.json({
            success: true,
            results: results
        });
    } catch (error) {
        console.error('Batch update error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Health check for API
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        api: 'active',
        webhooks: WEBHOOKS,
        timestamp: new Date().toISOString()
    });
});

// Handle all other routes by serving the main app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 VEBLEN Task Tracker running on port ${PORT}`);
    console.log(`📱 Access at: http://localhost:${PORT}`);
    console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Webhooks configured:`, WEBHOOKS);
});
