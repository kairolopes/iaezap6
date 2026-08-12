#!/usr/bin/env node
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

// NOW import and start Next.js
require('next/dist/bin/next')(['start']);
