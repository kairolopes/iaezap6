#!/bin/bash

# IAeZap6 Deployment Script
# Usage: ./deploy.sh [environment]
# Example: ./deploy.sh production

set -e  # Exit on error

ENV=${1:-production}
APP_DIR="/root/iaezap6"
BRANCH="main"

echo "🚀 Starting IAeZap6 deployment..."
echo "📍 Environment: $ENV"
echo "📂 App Directory: $APP_DIR"
echo "🔀 Branch: $BRANCH"
echo ""

cd $APP_DIR

# Step 1: Fetch latest code
echo "📥 Step 1: Fetching latest code from GitHub..."
git fetch origin
git reset --hard origin/$BRANCH
echo "✅ Latest code fetched"
echo ""

# Step 2: Install dependencies
echo "📦 Step 2: Installing dependencies..."
npm ci 2>&1 | tail -3
echo "✅ Dependencies installed"
echo ""

# Step 3: Build
echo "🔨 Step 3: Building Next.js application..."
npm run build 2>&1 | tail -5
echo "✅ Build completed"
echo ""

# Step 4: Restart PM2
echo "♻️  Step 4: Restarting PM2 processes..."
pm2 restart all --update-env
pm2 save
echo "✅ PM2 processes restarted"
echo ""

# Step 5: Verify deployment
echo "✔️  Step 5: Verifying deployment..."
sleep 2
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Application is running"
else
    echo "⚠️  Application may not be responding"
fi
echo ""

echo "✨ Deployment completed successfully!"
echo "🌐 Check status: pm2 status"
echo "📊 Check logs: pm2 logs"
