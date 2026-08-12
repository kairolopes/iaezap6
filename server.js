#!/usr/bin/env node

// CRITICAL: Load environment variables FIRST
// Use dotenv/config which loads .env.production and .env files automatically
require('dotenv').config({ path: '.env.production' });

console.log('[Server] Environment variables loaded');
if (process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20)) {
  console.log(`[Server] ✓ SERVICE_ROLE_KEY loaded: ${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`);
}

// NOW spawn next start with env already loaded
const { spawn } = require('child_process');
const next = spawn('node_modules/.bin/next', ['start'], {
  stdio: 'inherit',
  env: process.env,
  cwd: __dirname,
});

next.on('exit', (code) => {
  console.log(`[Server] Next.js exited with code ${code}`);
  process.exit(code || 1);
});
