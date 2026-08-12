#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Load environment variables from .env.production
const envPath = path.join(__dirname, '.env.production');
const env = { ...process.env };

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim();
      if (key && value) {
        env[key.trim()] = value;
      }
    }
  });
}

// Start Next.js with loaded environment variables
const nextStart = spawn('node', [path.join(__dirname, 'node_modules/.bin/next'), 'start'], {
  env,
  stdio: 'inherit',
  cwd: __dirname,
});

process.on('SIGTERM', () => {
  nextStart.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  nextStart.kill('SIGINT');
  process.exit(0);
});
