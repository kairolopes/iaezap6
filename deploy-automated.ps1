#!/usr/bin/env pwsh

# ==============================================================================
# IAeZap - Automated VPS Deployment Script (PowerShell)
# ==============================================================================
# This script deploys IAeZap to Hostinger VPS automatically
# Execute: powershell -ExecutionPolicy Bypass -File deploy-automated.ps1

Write-Host "`n🚀 IAeZap - Deployment Automático para Hostinger" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Green
Write-Host ""

# ==============================================================================
# CONFIGURAÇÃO
# ==============================================================================

$VPS_IP = "179.198.102.88"
$VPS_USER = "root"
$VPS_PASSWORD = "Bate123ria@5"
$VPS_PORT = 22
$GITHUB_REPO = "https://github.com/KairoLopes/iaezap.git"
$DOMAIN = "jotaonline.com.br"
$EMAIL = "kairo@zapbaratinho.com.br"

# JWT Keys (from .env.local)
$JWT_PRIVATE_KEY = @"
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
"@

$JWT_PUBLIC_KEY = @"
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4TpxyTzGcijaq35kq8nt
rG/QUJGTCBmRI4UbHjddeat5qV9Fe7I/taSoQLoBVODPeRvTvEYFwwmvJWjBDVcV
9Shdiwsk1W8HKyh0yxkOwTQX/6jhhKRrbLNu9FUx3XGYisWUFdOzbwGTm8Ueaql3
jPKlyRoOYMu3R6Cb/pzP36+6gmWkRi+oNn3HTO/j+RYf3CsnvhlaWXKA3w1eUCEC
c/7f4fM6BwPs9lJwwBz/gWvwETiTRvSOusqBFv0EyRY50BNmukOFyFRc/iM+mNEh
Mi/eFliGuilwcB4prUuiIqvPeGdOOkJDyRWr/hOgxqXJWj3pGWxo2lSyyb67+zBZ
tQIDAQAB
-----END PUBLIC KEY-----
"@

$SUPABASE_URL = "https://gqromcfhiosfppqlottz.supabase.co"
$SUPABASE_SERVICE_ROLE_KEY = "sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ"

Write-Host "📍 Configurações:" -ForegroundColor Cyan
Write-Host "   VPS IP:      $VPS_IP" -ForegroundColor Gray
Write-Host "   Domínio:     $DOMAIN" -ForegroundColor Gray
Write-Host "   Email:       $EMAIL" -ForegroundColor Gray
Write-Host ""

# ==============================================================================
# FUNÇÃO: Executar comandos SSH
# ==============================================================================

function Execute-SSHCommand {
    param(
        [string]$Command,
        [string]$Description
    )

    Write-Host "📍 $Description..." -ForegroundColor Cyan

    # Escapar o comando para shell
    $EscapedCommand = $Command -replace '"', '\"'

    # Executar via SSH
    $Output = & ssh.exe -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null `
        $VPS_USER@$VPS_IP "$EscapedCommand" 2>&1

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Falha: $Description" -ForegroundColor Red
        Write-Host $Output -ForegroundColor Red
        return $false
    }

    Write-Host "✅ $Description" -ForegroundColor Green
    return $true
}

# ==============================================================================
# PASSO 1: Testar conexão SSH
# ==============================================================================

Write-Host "🔌 TESTANDO CONEXÃO SSH..." -ForegroundColor Yellow
Write-Host ""

try {
    $TestSSH = & ssh.exe -o ConnectTimeout=5 -o StrictHostKeyChecking=no `
        -o UserKnownHostsFile=/dev/null $VPS_USER@$VPS_IP "whoami" 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Conexão SSH OK" -ForegroundColor Green
        Write-Host "   Usuário: $TestSSH" -ForegroundColor Gray
    } else {
        Write-Host "❌ Conexão SSH falhou!" -ForegroundColor Red
        Write-Host "   Verifique VPS_IP e credenciais" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ SSH não disponível!" -ForegroundColor Red
    Write-Host "   Instale OpenSSH: https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🚀 INICIANDO DEPLOYMENT..." -ForegroundColor Yellow
Write-Host "=" * 60 -ForegroundColor Green
Write-Host ""

# ==============================================================================
# PASSO 2: Atualizar sistema
# ==============================================================================

Execute-SSHCommand "apt update; apt upgrade -y" "Atualizando sistema"
Write-Host ""

# ==============================================================================
# PASSO 3: Instalar Node.js
# ==============================================================================

Execute-SSHCommand "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -; apt-get install -y nodejs" `
    "Instalando Node.js 18"
Write-Host ""

# ==============================================================================
# PASSO 4: Instalar ferramentas
# ==============================================================================

Execute-SSHCommand "apt install -y git nginx certbot python3-certbot-nginx ufw; npm install -g pm2" `
    "Instalando Git, Nginx, PM2, Certbot"
Write-Host ""

# ==============================================================================
# PASSO 5: Clonar repositório
# ==============================================================================

Execute-SSHCommand "cd /var/www; rm -rf iaezap 2>/dev/null; git clone $GITHUB_REPO iaezap" `
    "Clonando repositório"
Write-Host ""

# ==============================================================================
# PASSO 6: Criar .env.production
# ==============================================================================

Write-Host "📍 Criando .env.production..." -ForegroundColor Cyan

# Escapar as chaves para múltiplas linhas
$EnvContent = @"
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

JWT_PRIVATE_KEY="$(ConvertFrom-StringData -StringData $JWT_PRIVATE_KEY | ForEach-Object { $_.Value })"
JWT_PUBLIC_KEY="$(ConvertFrom-StringData -StringData $JWT_PUBLIC_KEY | ForEach-Object { $_.Value })"

JWT_ISSUER=iaezap
JWT_AUDIENCE=iaezap-api
JWT_ACCESS_TOKEN_EXPIRY=3600
JWT_REFRESH_TOKEN_EXPIRY=604800

BCRYPT_ROUNDS=12
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_URL=https://$DOMAIN
"@

# Criar arquivo via SSH
$EnvEscaped = $EnvContent -replace '"', '\"' -replace '`', '``'
$CreateEnvCommand = "cat > /var/www/iaezap/.env.production << 'EOF_ENV'`n$EnvContent`nEOF_ENV"

& ssh.exe -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null `
    $VPS_USER@$VPS_IP $CreateEnvCommand 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Criando .env.production" -ForegroundColor Green
} else {
    Write-Host "❌ Falha ao criar .env.production" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ==============================================================================
# PASSO 7: npm install e build
# ==============================================================================

Execute-SSHCommand "cd /var/www/iaezap && npm install" "npm install"
Write-Host ""

Execute-SSHCommand "cd /var/www/iaezap && npm run build" "npm run build"
Write-Host ""

# ==============================================================================
# PASSO 8: PM2 startup
# ==============================================================================

Execute-SSHCommand "cd /var/www/iaezap && pm2 delete iaezap 2>/dev/null; pm2 start npm --name 'iaezap' -- start" `
    "Iniciando PM2"
Write-Host ""

Execute-SSHCommand "pm2 startup && pm2 save" "Configurando PM2 para auto-restart"
Write-Host ""

# ==============================================================================
# PASSO 9: Configurar Nginx
# ==============================================================================

Write-Host "📍 Configurando Nginx..." -ForegroundColor Cyan

$NginxConfig = @"
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://`$server_name`$request_uri;
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
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host `$host;
        proxy_cache_bypass `$http_upgrade;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
    }

    location /_next/static {
        alias /var/www/iaezap/.next/static;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }
}
"@

& ssh.exe -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null `
    $VPS_USER@$VPS_IP "cat > /etc/nginx/sites-available/$DOMAIN << 'EOF_NGINX'`n$NginxConfig`nEOF_NGINX" 2>&1 | Out-Null

Execute-SSHCommand "ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/ && rm -f /etc/nginx/sites-enabled/default" `
    "Habilitando site Nginx"
Write-Host ""

Execute-SSHCommand "nginx -t && systemctl restart nginx" "Testando e reiniciando Nginx"
Write-Host ""

# ==============================================================================
# PASSO 10: Gerar certificado SSL
# ==============================================================================

Execute-SSHCommand "certbot certonly --standalone --non-interactive --agree-tos -m $EMAIL -d $DOMAIN -d www.$DOMAIN" `
    "Gerando certificado SSL"
Write-Host ""

Execute-SSHCommand "systemctl restart nginx" "Reiniciando Nginx com SSL"
Write-Host ""

# ==============================================================================
# PASSO 11: Configurar Firewall
# ==============================================================================

Execute-SSHCommand "apt install -y ufw && ufw default deny incoming && ufw default allow outgoing && ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable" `
    "Configurando Firewall"
Write-Host ""

# ==============================================================================
# RESUMO
# ==============================================================================

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Green
Write-Host "✅ DEPLOYMENT COMPLETO!" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Green
Write-Host ""

Write-Host "🌐 Sua aplicação está disponível em:" -ForegroundColor Green
Write-Host "   https://$DOMAIN/login" -ForegroundColor Yellow
Write-Host ""

Write-Host "🔑 Credenciais de Login:" -ForegroundColor Green
Write-Host "   Email:    kairolopesoficial@gmail.com" -ForegroundColor Yellow
Write-Host "   Senha:    jx&CL%mFvt!x*Sm0" -ForegroundColor Yellow
Write-Host ""

Write-Host "⏱️  Aguarde 15-30 minutos para DNS propagar" -ForegroundColor Cyan
Write-Host "   (Configure em: https://panel.hostinger.com.br → Domínios → jotaonline.com.br → DNS)" -ForegroundColor Cyan
Write-Host ""

Write-Host "📊 Para checar status:" -ForegroundColor Green
Write-Host '   ssh root@' + $VPS_IP + ' "pm2 status"' -ForegroundColor Gray
Write-Host ""

Write-Host "📋 Para ver logs:" -ForegroundColor Green
Write-Host '   ssh root@' + $VPS_IP + ' "pm2 logs iaezap"' -ForegroundColor Gray
Write-Host ""

Write-Host "✅ PRONTO PARA PRODUÇÃO!" -ForegroundColor Green
Write-Host ""
