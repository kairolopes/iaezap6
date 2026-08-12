#!/bin/bash

# FINAL SOLUTION: Load env vars, then call Node.js DIRECTLY with Next.js entry point
set -a
source .env.production
set +a

echo "[start-production.sh] Environment loaded from .env.production"
if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "[start-production.sh] ✓ SUPABASE_SERVICE_ROLE_KEY is set: ${SUPABASE_SERVICE_ROLE_KEY:0:20}..."
fi

# Call Node.js DIRECTLY with Next.js entry point (not via wrapper script)
# This ensures env vars are properly inherited
exec node node_modules/next/dist/bin/next.js start
