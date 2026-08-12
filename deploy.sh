#!/bin/bash

# IAeZap Deployment Script for Ubuntu 24.04 LTS
# Usage: bash deploy.sh

set -e

echo "🚀 IAeZap Deployment Started..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
REPO_URL="https://github.com/kairolopes/iaezap6.git"
PROJECT_DIR="/home/iaezap"
NODE_VERSION="20"
DOMAIN="iaezap.com.br"

# ============================================================================
# 1. Update System
# ============================================================================
echo -e "${BLUE}1. Updating system packages...${NC}"
apt update && apt upgrade -y

# ============================================================================
# 2. Install Node.js and npm
# ============================================================================
echo -e "${BLUE}2. Installing Node.js ${NODE_VERSION}...${NC}"
if ! command -v node &> /dev/null; then
    curl -sL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt install -y nodejs
else
    echo "Node.js already installed: $(node --version)"
fi

# ============================================================================
# 3. Install PM2 (Process Manager)
# ============================================================================
echo -e "${BLUE}3. Installing PM2...${NC}"
npm install -g pm2

# ============================================================================
# 4. Create project directory
# ============================================================================
echo -e "${BLUE}4. Setting up project directory...${NC}"
if [ ! -d "$PROJECT_DIR" ]; then
    mkdir -p $PROJECT_DIR
fi
cd $PROJECT_DIR

# ============================================================================
# 5. Clone/Pull repository
# ============================================================================
echo -e "${BLUE}5. Cloning/Pulling repository...${NC}"
if [ -d ".git" ]; then
    git pull origin main
else
    git clone $REPO_URL .
fi

# ============================================================================
# 6. Install dependencies
# ============================================================================
echo -e "${BLUE}6. Installing dependencies...${NC}"
npm install

# ============================================================================
# 7. Create .env.production
# ============================================================================
echo -e "${BLUE}7. Creating .env.production...${NC}"
if [ ! -f ".env.production" ]; then
    echo -e "${RED}⚠️  Please create .env.production with your secrets:${NC}"
    echo "    - NEXT_PUBLIC_SUPABASE_URL"
    echo "    - NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "    - SUPABASE_SERVICE_ROLE_KEY"
    echo "    - Z_API_INSTANCE_ID"
    echo "    - Z_API_TOKEN"
    echo "    - Z_API_CLIENT_TOKEN"
    echo ""
    echo "Copy from your .env.local file."
    read -p "Press Enter when .env.production is ready: "
fi

# ============================================================================
# 8. Build Next.js
# ============================================================================
echo -e "${BLUE}8. Building Next.js application...${NC}"
npm run build

# ============================================================================
# 9. Stop existing PM2 process
# ============================================================================
echo -e "${BLUE}9. Stopping existing PM2 processes...${NC}"
pm2 delete iaezap 2>/dev/null || true

# ============================================================================
# 10. Start with PM2
# ============================================================================
echo -e "${BLUE}10. Starting application with PM2...${NC}"
pm2 start "npm start" --name iaezap --env production
pm2 save
pm2 startup

# ============================================================================
# 11. Install Nginx (if not exists)
# ============================================================================
echo -e "${BLUE}11. Setting up Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    apt install -y nginx certbot python3-certbot-nginx
fi

# ============================================================================
# 12. Create Nginx configuration
# ============================================================================
echo -e "${BLUE}12. Configuring Nginx...${NC}"
cat > /etc/nginx/sites-available/iaezap << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/iaezap /etc/nginx/sites-enabled/iaezap
rm -f /etc/nginx/sites-enabled/default

# Test Nginx config
nginx -t

# Reload Nginx
systemctl restart nginx

# ============================================================================
# 13. Setup SSL with Let's Encrypt
# ============================================================================
echo -e "${BLUE}13. Setting up SSL...${NC}"
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email kairo@zapbaratinho.com.br || true

# ============================================================================
# 14. Verify deployment
# ============================================================================
echo -e "${BLUE}14. Verifying deployment...${NC}"
sleep 3

if curl -s http://127.0.0.1:3000 > /dev/null; then
    echo -e "${GREEN}✓ Application is running!${NC}"
else
    echo -e "${RED}✗ Application failed to start${NC}"
    pm2 logs iaezap
    exit 1
fi

# ============================================================================
# 15. Summary
# ============================================================================
echo ""
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ IAeZap Deployment Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo ""
echo "📋 Summary:"
echo "  🌐 Domain: https://$DOMAIN"
echo "  📱 API: https://$DOMAIN/api/webhooks/z-api"
echo "  📊 Project: $PROJECT_DIR"
echo ""
echo "📝 Useful Commands:"
echo "  pm2 status        - Check app status"
echo "  pm2 logs iaezap   - View application logs"
echo "  pm2 restart iaezap - Restart application"
echo "  pm2 stop iaezap   - Stop application"
echo ""
echo "🔄 To pull latest changes:"
echo "  cd $PROJECT_DIR && git pull && npm install && npm run build && pm2 restart iaezap"
echo ""
echo -e "${GREEN}Done! Your application is live 🚀${NC}"
