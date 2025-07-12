const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api
// @desc    API root endpoint
// @access  Public
router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to FbResponse API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      health: '/health'
    },
    documentation: 'API documentation coming soon'
  });
});

// @route   GET /api/status
// @desc    Get API status
// @access  Public
router.get('/status', (req, res) => {
  res.json({
    status: 'operational',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// @route   GET /api/protected
// @desc    Test protected route
// @access  Private
router.get('/protected', authenticateToken, (req, res) => {
  res.json({
    message: 'This is a protected route',
    user: req.user.getProfile()
  });
});

// @route   GET /api/optional
// @desc    Test optional auth route
// @access  Optional
router.get('/optional', optionalAuth, (req, res) => {
  res.json({
    message: 'This route works with or without authentication',
    authenticated: !!req.user,
    user: req.user ? req.user.getProfile() : null
  });
});

// @route   POST /api/echo
// @desc    Echo back request data (for testing)
// @access  Public
router.post('/echo', (req, res) => {
  res.json({
    message: 'Echo response',
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
    query: req.query,
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 