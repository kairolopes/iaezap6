#!/bin/bash

# ==============================================================================
# IAeZap - Complete Deployment Script
# Execute no VPS via: bash <(curl -s https://raw.githubusercontent.com/KairoLopes/iaezap/main/run-deployment.sh)
# ==============================================================================

set -e

echo ""
echo "🚀 IAeZap - Complete Deployment"
echo "======================================"
echo ""

# ==============================================================================
# STEP 1: Update System
# ==============================================================================

echo "📍 STEP 1/11: Updating system..."
apt-get update
apt-get upgrade -y
echo "✅ System updated"
echo ""

# ==============================================================================
# STEP 2: Install Node.js
# ==============================================================================

echo "📍 STEP 2/11: Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
echo "✅ Node.js $(node --version) installed"
echo ""

# ==============================================================================
# STEP 3: Install Tools
# ==============================================================================

echo "📍 STEP 3/11: Installing Git, Nginx, PM2, Certbot..."
apt-get install -y git nginx certbot python3-certbot-nginx ufw
npm install -g pm2
echo "✅ All tools installed"
echo ""

# ==============================================================================
# STEP 4: Clone Repository
# ==============================================================================

echo "📍 STEP 4/11: Cloning repository..."
cd /var/www
rm -rf iaezap 2>/dev/null || true
git clone https://github.com/KairoLopes/iaezap.git iaezap
cd iaezap
echo "✅ Repository cloned"
echo ""

# ==============================================================================
# STEP 5: Create .env.production
# ==============================================================================

echo "📍 STEP 5/11: Creating .env.production..."

echo "⚠️  IMPORTANTE: Configure as credenciais da Supabase e JWT em .env.production"
echo "   Copie do arquivo .env.production.example e preencha com suas credenciais reais"
echo ""
echo "   Credenciais necessárias:"
echo "   - NEXT_PUBLIC_SUPABASE_URL"
echo "   - SUPABASE_SERVICE_ROLE_KEY"
echo "   - JWT_PRIVATE_KEY"
echo "   - JWT_PUBLIC_KEY"
echo ""

# Create template file
cp .env.production.example .env.production || cat > .env.production << 'EOF'
# ⚠️  EDIT THIS FILE WITH YOUR ACTUAL CREDENTIALS
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-url.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n... PASTE YOUR PRIVATE KEY ...\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n... PASTE YOUR PUBLIC KEY ...\n-----END PUBLIC KEY-----"

JWT_ISSUER=iaezap
JWT_AUDIENCE=iaezap-api
JWT_ACCESS_TOKEN_EXPIRY=3600
JWT_REFRESH_TOKEN_EXPIRY=604800

BCRYPT_ROUNDS=12
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_URL=https://jotaonline.com.br
EOF

echo "⚠️  STOPPING: Edit .env.production with real credentials before continuing"
echo "   Type: nano .env.production"
read -p "Press ENTER after editing .env.production..."

echo "✅ .env.production created"
echo ""

# ==============================================================================
# STEP 6: npm install
# ==============================================================================

echo "📍 STEP 6/11: Running npm install..."
npm install
echo "✅ Dependencies installed"
echo ""

# ==============================================================================
# STEP 7: Build
# ==============================================================================

echo "📍 STEP 7/11: Building application..."
npm run build
echo "✅ Build completed"
echo ""

# ==============================================================================
# STEP 8: PM2 Setup
# ==============================================================================

echo "📍 STEP 8/11: Starting with PM2..."
pm2 delete iaezap 2>/dev/null || true
pm2 start npm --name "iaezap" -- start
pm2 startup
pm2 save
echo "✅ PM2 configured"
echo ""

# ==============================================================================
# STEP 9: Nginx Configuration
# ==============================================================================

echo "📍 STEP 9/11: Configuring Nginx..."

cat > /etc/nginx/sites-available/jotaonline.com.br << 'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name jotaonline.com.br www.jotaonline.com.br;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name jotaonline.com.br www.jotaonline.com.br;

    ssl_certificate /etc/letsencrypt/live/jotaonline.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/jotaonline.com.br/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /_next/static {
        alias /var/www/iaezap/.next/static;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }
}
NGINX

ln -sf /etc/nginx/sites-available/jotaonline.com.br /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
echo "✅ Nginx configured"
echo ""

# ==============================================================================
# STEP 10: SSL Certificate
# ==============================================================================

echo "📍 STEP 10/11: Generating SSL certificate..."
certbot certonly --standalone --non-interactive --agree-tos -m kairo@zapbaratinho.com.br -d jotaonline.com.br -d www.jotaonline.com.br
systemctl restart nginx
echo "✅ SSL certificate generated"
echo ""

# ==============================================================================
# STEP 11: Firewall
# ==============================================================================

echo "📍 STEP 11/11: Configuring firewall..."
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "✅ Firewall configured"
echo ""

# ==============================================================================
# Summary
# ==============================================================================

echo "======================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "======================================"
echo ""
echo "🌐 Access your application at:"
echo "   https://jotaonline.com.br/login"
echo ""
echo "🔑 Master User:"
echo "   Email:    kairolopesoficial@gmail.com"
echo "   Password: jx&CL%mFvt!x*Sm0"
echo ""
echo "📊 Application Status:"
pm2 status
echo ""
echo "📝 Useful Commands:"
echo "   View logs:     pm2 logs iaezap"
echo "   Restart app:   pm2 restart iaezap"
echo "   Check status:  pm2 status"
echo ""
echo "⏱️  Wait 15-30 minutes for DNS to propagate"
echo "   Configure DNS at: https://panel.hostinger.com.br"
echo ""
echo "✅ READY FOR PRODUCTION!"
echo ""
