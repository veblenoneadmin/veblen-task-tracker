const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve main dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'VEBLEN Task Tracker'
    });
});

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

// Handle all other routes by serving the main app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
});
