#!/bin/bash

# ==============================================================================
# IAeZap - IMMEDIATE DEPLOYMENT TO VPS
# Execute via: bash deploy-vps-now.sh
# ==============================================================================

set -e

VPS_IP="179.198.102.88"
VPS_USER="root"
VPS_PASSWORD="Bate123ria@5"

DOMAIN="jotaonline.com.br"
EMAIL="kairo@zapbaratinho.com.br"

# Supabase Credentials
SUPABASE_URL="https://gqromcfhiosfppqlottz.supabase.co"
SUPABASE_KEY="sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ"

# JWT Keys (from .env.local)
JWT_PRIVATE=$(cat << 'JWTVPRIVKEY'
-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDhOnHJPMZyKNqr
fmSrye2sb9BQkZMIGZEjhRseN115q3mpX0V7sj+1pKhAugFU4M95G9O8RgXDCa8l
aMENVxX1KF2LCyTVbwcrKHTLGQ7BNBf/qOGEpGtss270VTHdcZiKxZQV07NvAZOb
xR5qqXeM8qXJGg5gy7dHoJv+nM/fr7qCZaRGL6g2fcdM7+P5Fh/cKye+GVpZcoDf
DV5QIQJz/t/h8zoHA+z2UnDAHP+Ba/AROJNG9I66yoEW/QTJFjnQE2a6Q4XIVFz+
Iz6Y0SEyL94WWIa6KXBwHimtS6Iiq894Z046QkPJFav+E6DGpclaPekZbGjaVLLJ
vrv7MFm1AgMBAAECggEAMhhmgiDJL8+b8Yx7lkUj3tiA4Ea8yg6rvFeJBFPCsAL+
nLhC02Q+bOeqf7kPfkJBi1mv4t69PdgL05mE5PNzgBOiGMDaCLn5AXWuYpUYdcsh
Ml1tCaxrc2JGocRIQs2XJPiUuzUa4iwa2YkCvq0iWOCIlN39iDSPd7hGsh9NUh5Q
KyaKgL8IWJKc7fm9AFSSuP75AsH0mbnW9Kzch6zzywMWNjax/NOg4UDaFN5vG/Bb
kgpQhjEQGRLgrbzpdyLo0S59pBdyRFkGYt1vSPY2xjpoAFmtSbRN/OaJqpOVkVNz
SMrpcNrGjwpgh/pr7Q7YPq7Q6g9sPQpKTjK20dxiWQKBgQD/ddi6vKNmghY09fwq
Bw8vQdujPSruxTlc2XgktqjTfIOfXMnR/Iodhqdqamfat8iSEyKYoiG4Zo13PKQ6
Rdi0D7zcBy3tn3FDwkG3FzXxPGEJJ3IAauBhx7sO2iHQvRLBLeyiGvo80zXDzSgJ
JF9mcXmyYVa2tMfqCFwquQaD+QKBgQDhtD+TCLF7h+TUZxs5Y4jnWKV+SFZytwB3
+SttNtTj+yiQsNcxs/rZdAB6AkKtj1zoStfxneOtvqlXGSkwg12Oh+Rfej0Cx3XB
qo+qMYbj2vg+a6eppIAAbKPYwhjmDBZcO28HZamauA6IjeC+tK4GQmGHq325jL/Y
O3kJt2M6nQKBgHgtiYL34WsFActyeWmQHp2dvuUBjqP7VmwOxo2G/M9ZQVaEQVGv
G46eXT4bxrXHRe0qYVkq1PA6Fo0kkyHy3+p9iNx96CZkntVAmse2fKL7Q68ZxnDZ
1qtJWf+3sLbRa/RDVZJBXL2moyF070O1v8ei1JyNXEzhqTa5LhrPJniJAoGANCCN
DkhTtVQNZYDqqLZ0R/oRPrk2PghF8294uCCRypWXKNOu36vRo6dG9ObQv4T80Cl4
9jShAN+n/JWzDaFJWkHIXMS+koW+jJv30jbeEIHiE4iJkISNi4uLy+QIHBlukJ6p
Zev03+bidGdQILtZ9dge7laNEu2O4UHbEoNoR4ECgYAYdTuVWO9g2AaeQ9WmN0V8
9rcsBBhcCHJ2aBdTN8ftdbT2ldyKhT2/rJrNdN1ETQ0wcIudbPqpcF3iJUor2Ul/
cOw+1088yJ/j7/+2/v9Cy1f5FQ3XTiU7ggGLWxUCz8dozJMu9flgWgrJTaWD6ZF9
Lqg3gwBz7xh+gidoxTMQ0g==
-----END PRIVATE KEY-----
JWTVPRIVKEY
)

JWT_PUBLIC=$(cat << 'JWTVPUBKEY'
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4TpxyTzGcijaq35kq8nt
rG/QUJGTCBmRI4UbHjddeat5qV9Fe7I/taSoQLoBVODPeRvTvEYFwwmvJWjBDVcV
9Shdiwsk1W8HKyh0yxkOwTQX/6jhhKRrbLNu9FUx3XGYisWUFdOzbwGTm8Ueaql3
jPKlyRoOYMu3R6Cb/pzP36+6gmWkRi+oNn3HTO/j+RYf3CsnvhlaWXKA3w1eUCEC
c/7f4fM6BwPs9lJwwBz/gWvwETiTRvSOusqBFv0EyRY50BNmukOFyFRc/iM+mNEh
Mi/eFliGuilwcB4prUuiIqvPeGdOOkJDyRWr/hOgxqXJWj3pGWxo2lSyyb67+zBZ
tQIDAQAB
-----END PUBLIC KEY-----
JWTVPUBKEY
)

echo ""
echo "🚀 IAeZap - VPS Deployment via SSH"
echo "========================================="
echo ""
echo "Connecting to VPS: $VPS_IP..."
echo ""

# Execute deployment script on VPS
ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" << DEPLOY_EOF
#!/bin/bash
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
echo "✅ Node.js \$(node --version) installed"
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

cat > .env.production << 'ENVEOF'
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_KEY

JWT_PRIVATE_KEY="$JWT_PRIVATE"
JWT_PUBLIC_KEY="$JWT_PUBLIC"

JWT_ISSUER=iaezap
JWT_AUDIENCE=iaezap-api
JWT_ACCESS_TOKEN_EXPIRY=3600
JWT_REFRESH_TOKEN_EXPIRY=604800

BCRYPT_ROUNDS=12
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_URL=https://$DOMAIN
ENVEOF

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

cat > /etc/nginx/sites-available/$DOMAIN << 'NGINXEOF'
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /_next/static {
        alias /var/www/iaezap/.next/static;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
echo "✅ Nginx configured"
echo ""

# ==============================================================================
# STEP 10: SSL Certificate
# ==============================================================================

echo "📍 STEP 10/11: Generating SSL certificate..."
certbot certonly --standalone --non-interactive --agree-tos -m $EMAIL -d $DOMAIN -d www.$DOMAIN
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
echo "   https://$DOMAIN/login"
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

DEPLOY_EOF

echo "✅ DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo ""
echo "Next steps:"
echo "1. Configure DNS in Hostinger panel to point to VPS IP: 179.198.102.88"
echo "2. Wait 15-30 minutes for DNS propagation"
echo "3. Access https://jotaonline.com.br/login"
echo ""
