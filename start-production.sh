#!/bin/bash

# ULTIMATE SOLUTION: Load env vars from .env.production, then run npm start
set -a
source .env.production
set +a

echo "[start-production.sh] Environment loaded from .env.production"
if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "[start-production.sh] ✓ SUPABASE_SERVICE_ROLE_KEY is set: ${SUPABASE_SERVICE_ROLE_KEY:0:20}..."
fi

# Delegate to npm start which properly resolves package.json start script
# npm start runs: bash start.sh -> next start
exec npm start
