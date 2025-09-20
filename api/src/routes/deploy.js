const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const router = express.Router();

// Stream endpoint for deployment
router.get('/stream', (req, res) => {
  // Only allow on localhost
  const host = req.hostname;
  const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1';

  if (!isLocalhost) {
    return res.status(403).json({
      success: false,
      message: 'Deploy streaming is disabled in production'
    });
  }

  // Set up SSE headers with CORS
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
    'X-Accel-Buffering': 'no'
  });

  // Send initial message
  res.write('data: Starting deployment...\n\n');

  // Path to SECURE deploy script - go up to project root
  const scriptPath = path.join(__dirname, '..', '..', '..', 'deploy', 'scripts', 'deploy-secure.sh');

  // NO hardcoded passwords! The script reads from .env.local
  // Make sure .env.local exists with proper credentials

  // Spawn the deploy script WITHOUT --quick to ensure fresh build
  // Quitamos --quick para que siempre haga build completo del frontend
  const child = spawn('bash', [scriptPath], {
    env: process.env, // Use existing environment, script will read .env.local
    cwd: path.join(__dirname, '..', '..', '..') // Run from project root
  });

  // Handle stdout
  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        // Remove ANSI color codes for cleaner output
        const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
        res.write(`data: ${cleanLine}\n\n`);
      }
    });
  });

  // Handle stderr
  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim() && !line.includes('Warning:')) {
        const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
        res.write(`data: [error] ${cleanLine}\n\n`);
      }
    });
  });

  // Handle process completion
  child.on('close', (code) => {
    const success = code === 0;
    res.write(`event: done\n`);
    res.write(`data: ${JSON.stringify({ success, code })}\n\n`);
    res.end();
  });

  // Handle errors
  child.on('error', (error) => {
    res.write(`data: [error] ${error.message}\n\n`);
    res.write(`event: done\n`);
    res.write(`data: ${JSON.stringify({ success: false, error: error.message })}\n\n`);
    res.end();
  });

  // Clean up on client disconnect
  req.on('close', () => {
    child.kill();
  });
});

module.exports = router;