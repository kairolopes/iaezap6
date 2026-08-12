#!/bin/bash

# Load environment variables from .env.production
if [ -f .env.production ]; then
  export $(cat .env.production | grep -v '^#' | xargs)
fi

# Start Next.js server
exec node_modules/.bin/next start
