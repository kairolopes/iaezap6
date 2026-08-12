#!/bin/bash

# This script is used by package.json start command
# PM2 manages environment loading via ecosystem.config.js (env_file: .env.production)
# Simply delegate to PM2 or run next start directly
exec node_modules/.bin/next start
