#!/bin/bash

# ==============================================================================
# IAeZap - VPS Setup Script for Hostinger
# Execute this script on your VPS via SSH or Web Console
# ==============================================================================

set -e

echo "🚀 IAeZap VPS Setup"
echo "===================="
echo ""

# ==============================================================================
# PASSO 1: Atualizar Sistema
# ==============================================================================
echo "📍 PASSO 1: Atualizando sistema..."
apt update && apt upgrade -y
echo "✅ Sistema atualizado"
echo ""

# ==============================================================================
# PASSO 2: Instalar Node.js
# ==============================================================================
echo "📍 PASSO 2: Instalando Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs
echo "✅ Node.js $(node --version) instalado"
echo "✅ npm $(npm --version) instalado"
echo ""

# ==============================================================================
# PASSO 3: Instalar ferramentas
# ==============================================================================
echo "📍 PASSO 3: Instalando Git, Nginx, PM2..."
apt install -y git nginx certbot python3-certbot-nginx ufw
npm install -g pm2
echo "✅ Todas as ferramentas instaladas"
echo ""

# ==============================================================================
# PASSO 4: Clonar repositório
# ==============================================================================
echo "📍 PASSO 4: Clonando repositório do GitHub..."
cd /var/www
rm -rf iaezap 2>/dev/null || true
git clone https://github.com/KairoLopes/iaezap.git
cd iaezap
echo "✅ Repositório clonado em /var/www/iaezap"
echo ""

# ==============================================================================
# PASSO 5: Criar .env.production
# ==============================================================================
echo "📍 PASSO 5: Criando .env.production..."
cat > .env.production << 'EOF'
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://gqromcfhiosfppqlottz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxcm9tY2ZoaW9zZnBwcWxvdHR6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5NzAwMDAwMCwiZXhwIjoxODI4NjMyMDAwfQ.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# JWT - Replace with your actual keys from .env.production.example
JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYour_Private_Key_Here\n-----END PRIVATE KEY-----
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\nYour_Public_Key_Here\n-----END PUBLIC KEY-----

JWT_ISSUER=iaezap
JWT_AUDIENCE=iaezap-api
JWT_ACCESS_TOKEN_EXPIRY=3600
JWT_REFRESH_TOKEN_EXPIRY=604800

BCRYPT_ROUNDS=12
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_URL=https://jotaonline.com.br
EOF

echo "⚠️  IMPORTANTE: Edite .env.production com suas credenciais JWT"
echo "   nano /var/www/iaezap/.env.production"
echo "   Copie as chaves de: C:\Users\Kairo Lopes\OneDrive\Documentos\Kairo\claude code\iaezap6\.env.local"
echo ""
read -p "Pressione ENTER após editar as credenciais..."
echo ""

# ==============================================================================
# PASSO 6: Instalar dependências e fazer build
# ==============================================================================
echo "📍 PASSO 6: Instalando dependências e fazendo build..."
npm install
npm run build
echo "✅ Build completo"
echo ""

# ==============================================================================
# PASSO 7: Iniciar com PM2
# ==============================================================================
echo "📍 PASSO 7: Iniciando com PM2..."
pm2 delete iaezap 2>/dev/null || true
pm2 start npm --name "iaezap" -- start
pm2 startup
pm2 save
echo "✅ PM2 iniciado e configurado para auto-restart"
pm2 status
echo ""

# ==============================================================================
# PASSO 8: Configurar Nginx
# ==============================================================================
echo "📍 PASSO 8: Configurando Nginx..."
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

ln -sf /etc/nginx/sites-available/jotaonline.com.br /etc/nginx/sites-enabled/ 2>/dev/null || true
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t
systemctl restart nginx
echo "✅ Nginx configurado"
echo ""

# ==============================================================================
# PASSO 9: Gerar certificado SSL
# ==============================================================================
echo "📍 PASSO 9: Gerando certificado SSL com Certbot..."
certbot certonly --standalone --non-interactive --agree-tos -m kairo@zapbaratinho.com.br \
  -d jotaonline.com.br -d www.jotaonline.com.br
systemctl restart nginx
echo "✅ Certificado SSL gerado (auto-renovação ativa)"
echo ""

# ==============================================================================
# PASSO 10: Configurar Firewall
# ==============================================================================
echo "📍 PASSO 10: Configurando Firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "✅ Firewall configurado"
echo ""

# ==============================================================================
# RESUMO
# ==============================================================================
echo "=============================="
echo "✅ SETUP COMPLETO!"
echo "=============================="
echo ""
echo "🌐 Acesse em:"
echo "   https://jotaonline.com.br/login"
echo ""
echo "🔑 Credenciais:"
echo "   Email:    kairolopesoficial@gmail.com"
echo "   Senha:    jx&CL%mFvt!x*Sm0"
echo ""
echo "📊 Status da Aplicação:"
pm2 status
echo ""
echo "📋 Comandos Úteis:"
echo "   Ver logs:              pm2 logs iaezap"
echo "   Reiniciar app:         pm2 restart iaezap"
echo "   Status PM2:            pm2 status"
echo "   Atualizar código:      cd /var/www/iaezap && git pull && npm run build && pm2 restart iaezap"
echo ""
echo "⏱️  Aguarde 2-5 minutos para DNS propagar"
echo "   (Verifique em: https://jotaonline.com.br)"
echo ""
echo "✅ Sistema PRONTO PARA PRODUÇÃO!"
echo ""
