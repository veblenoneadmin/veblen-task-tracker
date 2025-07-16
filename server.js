const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Serve main dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint for monitoring
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'VEBLEN Task Tracker',
    version: '2.0.0',
    database: 'Google Sheets'
  });
});

// API status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    service: 'VEBLEN Unified Task Tracker',
    version: '2.0.0',
    features: [
      'Task Management',
      'Time Tracking', 
      'Google Sheets Database',
      'Status Updates',
      'Daily Reports',
      'Time Clock',
      'Crash Recovery'
    ],
    database: 'Google Sheets Integration',
    lastUpdated: new Date().toISOString()
  });
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    availableEndpoints: [
      'GET / - Main dashboard',
      'GET /health - Health check',
      'GET /api/status - API status'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 VEBLEN Task Tracker running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
  console.log(`⚙️ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Database: Google Sheets Integration`);
  console.log(`✨ Features: Unified Task & Time Tracking`);
});
