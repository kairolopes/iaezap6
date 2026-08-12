#!/bin/bash

# FINAL SOLUTION: Pure bash wrapper to load env vars BEFORE any Node.js code
# set -a exports all variables, set +a stops exporting

set -a
source .env.production
set +a

echo "[start-production.sh] Environment loaded from .env.production"
if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "[start-production.sh] ✓ SUPABASE_SERVICE_ROLE_KEY is set"
fi

# NOW execute next start with full environment
exec node_modules/.bin/next start
