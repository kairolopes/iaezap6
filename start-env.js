#!/usr/bin/env node
const { createServer } = require('http');
const fs = require('fs');
const path = require('path');

// Load .env.production BEFORE importing Next.js
const envPath = path.join(__dirname, '.env.production');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        const value = valueParts.join('=').trim();
        if (value) {
          process.env[key.trim()] = value;
          // Debug: log SERVICE_ROLE_KEY if loading
          if (key.includes('SERVICE_ROLE')) {
            console.log(`[Env Loaded] ${key.substring(0, 20)}... = ${value.substring(0, 20)}...`);
          }
        }
      }
    }
  });
  console.log('[Env Loader] Successfully loaded .env.production');
} else {
  console.warn('[Env Loader] .env.production not found');
}

// Ensure NODE_ENV is set to production
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// NOW import and start Next.js
const { default: next } = require('next');
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(3000, '0.0.0.0', () => {
    console.log('[Server] Next.js started on port 3000');
  });
}).catch(err => {
  console.error('[Server Error]', err);
  process.exit(1);
});
