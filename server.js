#!/usr/bin/env node

// CRITICAL: Load environment variables FIRST, before any other imports
// This must be the very first line to ensure variables are available
require('dotenv').config({ path: '.env.production' });

console.log('[Server] Environment variables loaded from .env.production');
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('[Server] ✓ SUPABASE_SERVICE_ROLE_KEY is set');
}

// NOW import and start Next.js after env is definitely loaded
require('next/dist/bin/next')(['start']);
