#!/bin/bash

# ==============================================================================
# IAeZap - Automated Deployment Script for Hostinger
# ==============================================================================
# Usage: bash deploy.sh
# Run this script after SSH into your Hostinger VPS

set -e  # Exit on error

echo "🚀 IAeZap Deployment Script"
echo "============================"
echo ""

# ==============================================================================
# 1. VERIFY SSH CONNECTION
# ==============================================================================
echo "📍 Checking system..."
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "Git: $(git --version)"
echo ""

# ==============================================================================
# 2. NAVIGATE TO PROJECT DIRECTORY
# ==============================================================================
cd /var/www/iaezap || {
  echo "❌ Directory /var/www/iaezap not found!"
  exit 1
}

echo "📍 Current directory: $(pwd)"
echo ""

# ==============================================================================
# 3. UPDATE CODE
# ==============================================================================
echo "📍 Updating code from Git..."
git fetch origin
git reset --hard origin/main
echo "✅ Code updated"
echo ""

# ==============================================================================
# 4. INSTALL DEPENDENCIES
# ==============================================================================
echo "📍 Installing dependencies..."
npm install --production
echo "✅ Dependencies installed"
echo ""

# ==============================================================================
# 5. BUILD APPLICATION
# ==============================================================================
echo "📍 Building application..."
npm run build
echo "✅ Build completed"
echo ""

# ==============================================================================
# 6. RESTART APPLICATION
# ==============================================================================
echo "📍 Restarting application with PM2..."
pm2 restart iaezap --update-env
echo "✅ Application restarted"
echo ""

# ==============================================================================
# 7. VERIFY DEPLOYMENT
# ==============================================================================
echo "📍 Verifying deployment..."
pm2 status

echo ""
echo "============================"
echo "✅ Deployment completed!"
echo "============================"
echo ""
echo "📊 Application Status:"
pm2 status iaezap
echo ""
echo "📊 Recent Logs:"
pm2 logs iaezap --lines 5
echo ""
echo "🌐 Access your application at:"
echo "   https://jotaonline.com.br"
echo ""
