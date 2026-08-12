#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Load .env.production
const envPath = path.join(__dirname, '.env.production');
const env = { ...process.env };

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        const value = valueParts.join('=').trim();
        if (value) {
          env[key.trim()] = value;
          if (key.includes('SERVICE_ROLE')) {
            console.log(`[Env] Loaded ${key.substring(0, 20)}...`);
          }
        }
      }
    }
  });
  console.log('[Env Loader] Environment variables loaded from .env.production');
} else {
  console.warn('[Env Loader] WARNING: .env.production not found');
}

// Ensure NODE_ENV is production
env.NODE_ENV = 'production';

// Spawn next start with full environment inheritance
const nextStart = spawn('node_modules/.bin/next', ['start'], {
  stdio: 'inherit',
  env,
  cwd: __dirname,
});

// Handle process signals
process.on('SIGTERM', () => {
  console.log('[Process] Received SIGTERM, shutting down...');
  nextStart.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Process] Received SIGINT, shutting down...');
  nextStart.kill('SIGINT');
  process.exit(0);
});

// Handle child process exit
nextStart.on('exit', (code, signal) => {
  console.log(`[Process] Next.js exited with code ${code} and signal ${signal}`);
  process.exit(code || 1);
});
