/**
 * AlgoLab — Express Backend
 * Handles API routes and serves static files
 */

const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const runRoute     = require('./api/run');
const compareRoute = require('./api/compare');
const historyRoute = require('./api/history');
const suggestRoute = require('./api/suggest');
const authRoute    = require('./api/auth');
const adminRoute   = require('./api/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/run',     runRoute);
app.use('/api/compare', compareRoute);
app.use('/api/history', historyRoute);
app.use('/api/suggest', suggestRoute);
app.use('/api/auth',    authRoute);
app.use('/api/admin',   adminRoute);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0', timestamp: new Date().toISOString() });
});

// Catch-all: serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🧠 AlgoLab running at http://localhost:${PORT}`);
  console.log(`📡 API endpoints ready at /api/*`);
  console.log(`🗄  MongoDB: ${process.env.MONGODB_URI ? 'Connected' : 'Not configured (history disabled)'}\n`);
});

module.exports = app;
