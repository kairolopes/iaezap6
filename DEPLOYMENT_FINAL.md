# 🚀 IAeZap - DEPLOYMENT FINAL PARA jotaonline.com.br

**Seu sistema está pronto para produção!**

---

## 📍 INFORMAÇÕES DO VPS

```
IP:            179.198.102.88
Usuário:       root
Senha:         Bate123ria@5
Sistema:       Ubuntu 24.04 LTS
Status:        🟢 Ativo (confirmado no painel Hostinger)
```

---

## ⚡ MÉTODO RÁPIDO (10 min) - Copiar/Colar Comandos

### 1️⃣ Conectar ao VPS

Abra PowerShell e execute:

```powershell
ssh root@179.198.102.88
```

Quando pedir senha, digite: `Bate123ria@5`

Você verá:
```
root@vps:~#
```

---

### 2️⃣ Executar Deployment (Copiar/Colar cada linha)

```bash
# Ir para /var/www
cd /var/www

# Remover qualquer instalação anterior
rm -rf iaezap

# Clonar repositório
git clone https://github.com/KairoLopes/iaezap.git iaezap
cd iaezap

# Atualizar sistema
apt-get update
apt-get upgrade -y

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Instalar ferramentas
apt-get install -y git nginx certbot python3-certbot-nginx ufw
npm install -g pm2
```

---

### 3️⃣ Criar arquivo de configuração

```bash
nano .env.production
```

Cole exatamente isto (não remova as quebras de linha):

```env
NEXT_PUBLIC_SUPABASE_URL=https://gqromcfhiosfppqlottz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ

JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDhOnHJPMZyKNqr\nfmSrye2sb9BQkZMIGZEjhRseN115q3mpX0V7sj+1pKhAugFU4M95G9O8RgXDCa8l\naMENVxX1KF2LCyTVbwcrKHTLGQ7BNBf/qOGEpGtss270VTHdcZiKxZQV07NvAZOb\nxR5qqXeM8qXJGg5gy7dHoJv+nM/fr7qCZaRGL6g2fcdM7+P5Fh/cKye+GVpZcoDf\nDV5QIQJz/t/h8zoHA+z2UnDAHP+Ba/AROJNG9I66yoEW/QTJFjnQE2a6Q4XIVFz+\nIz6Y0SEyL94WWIa6KXBwHimtS6Iiq894Z046QkPJFav+E6DGpclaPekZbGjaVLLJ\nvrv7MFm1AgMBAAECggEAMhhmgiDJL8+b8Yx7lkUj3tiA4Ea8yg6rvFeJBFPCsAL+\nnLhC02Q+bOeqf7kPfkJBi1mv4t69PdgL05mE5PNzgBOiGMDaCLn5AXWuYpUYdcsh\nMl1tCaxrc2JGocRIQs2XJPiUuzUa4iwa2YkCvq0iWOCIlN39iDSPd7hGsh9NUh5Q\nKyaKgL8IWJKc7fm9AFSSuP75AsH0mbnW9Kzch6zzywMWNjax/NOg4UDaFN5vG/Bb\nkgpQhjEQGRLgrbzpdyLo0S59pBdyRFkGYt1vSPY2xjpoAFmtSbRN/OaJqpOVkVNz\nSMrpcNrGjwpgh/pr7Q7YPq7Q6g9sPQpKTjK20dxiWQKBgQD/ddi6vKNmghY09fwq\nBw8vQdujPSruxTlc2XgktqjTfIOfXMnR/Iodhqdqamfat8iSEyKYoiG4Zo13PKQ6\nRdi0D7zcBy3tn3FDwkG3FzXxPGEJJ3IAauBhx7sO2iHQvRLBLeyiGvo80zXDzSgJ\nJF9mcXmyYVa2tMfqCFwquQaD+QKBgQDhtD+TCLF7h+TUZxs5Y4jnWKV+SFZytwB3\n+SttNtTj+yiQsNcxs/rZdAB6AkKtj1zoStfxneOtvqlXGSkwg12Oh+Rfej0Cx3XB\nqo+qMYbj2vg+a6eppIAAbKPYwhjmDBZcO28HZamauA6IjeC+tK4GQmGHq325jL/Y\nO3kJt2M6nQKBgHgtiYL34WsFActyeWmQHp2dvuUBjqP7VmwOxo2G/M9ZQVaEQVGv\nG46eXT4bxrXHRe0qYVkq1PA6Fo0kkyHy3+p9iNx96CZkntVAmse2fKL7Q68ZxnDZ\n1qtJWf+3sLbRa/RDVZJBXL2moyF070O1v8ei1JyNXEzhqTa5LhrPJniJAoGANCCN\nDkhTtVQNZYDqqLZ0R/oRPrk2PghF8294uCCRypWXKNOu36vRo6dG9ObQv4T80Cl4\n9jShAN+n/JWzDaFJWkHIXMS+koW+jJv30jbeEIHiE4iJkISNi4uLy+QIHBlukJ6p\nZev03+bidGdQILtZ9dge7laNEu2O4UHbEoNoR4ECgYAYdTuVWO9g2AaeQ9WmN0V8\n9rcsBBhcCHJ2aBdTN8ftdbT2ldyKhT2/rJrNdN1ETQ0wcIudbPqpcF3iJUor2Ul/\ncOw+1088yJ/j7/+2/v9Cy1f5FQ3XTiU7ggGLWxUCz8dozJMu9flgWgrJTaWD6ZF9\nLqg3gwBz7xh+gidoxTMQ0g=="

JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4TpxyTzGcijaq35kq8nt\nrG/QUJGTCBmRI4UbHjddeat5qV9Fe7I/taSoQLoBVODPeRvTvEYFwwmvJWjBDVcV\n9Shdiwsk1W8HKyh0yxkOwTQX/6jhhKRrbLNu9FUx3XGYisWUFdOzbwGTm8Ueaql3\njPKlyRoOYMu3R6Cb/pzP36+6gmWkRi+oNn3HTO/j+RYf3CsnvhlaWXKA3w1eUCEC\nc/7f4fM6BwPs9lJwwBz/gWvwETiTRvSOusqBFv0EyRY50BNmukOFyFRc/iM+mNEh\nMi/eFliGuilwcB4prUuiIqvPeGdOOkJDyRWr/hOgxqXJWj3pGWxo2lSyyb67+zBZ\ntQIDAQAB\n-----END PUBLIC KEY-----"

JWT_ISSUER=iaezap
JWT_AUDIENCE=iaezap-api
JWT_ACCESS_TOKEN_EXPIRY=3600
JWT_REFRESH_TOKEN_EXPIRY=604800
BCRYPT_ROUNDS=12
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_URL=https://jotaonline.com.br
```

Salve: Pressione `Ctrl+X` → `Y` → `ENTER`

---

### 4️⃣ npm install e build

```bash
npm install
npm run build

pm2 start npm --name "iaezap" -- start
pm2 startup
pm2 save
```

---

### 5️⃣ Configurar Nginx

```bash
nano /etc/nginx/sites-available/jotaonline.com.br
```

Cole isto:

```nginx
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
```

Salve: `Ctrl+X` → `Y` → `ENTER`

Ative:

```bash
ln -sf /etc/nginx/sites-available/jotaonline.com.br /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

---

### 6️⃣ Gerar certificado SSL

```bash
apt-get install -y certbot python3-certbot-nginx
certbot certonly --standalone --non-interactive --agree-tos -m kairo@zapbaratinho.com.br -d jotaonline.com.br -d www.jotaonline.com.br
systemctl restart nginx
```

---

### 7️⃣ Firewall

```bash
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

---

### 8️⃣ Verificar

```bash
pm2 status
pm2 logs iaezap
```

Deve mostrar: **online** ✅

---

## 🌐 Configurar DNS

1. Acesse: https://panel.hostinger.com.br
2. Vá para: **Domínios → jotaonline.com.br → Gerenciar DNS**
3. Encontre o registro **A** (tipo A)
4. Edite e mude o valor para: **179.198.102.88**
5. Clique **Salvar**

---

## ⏱️ Aguarde 15-30 minutos

DNS pode levar até 30 minutos para propagar. Você pode checar com:

```bash
nslookup jotaonline.com.br
```

Deve retornar: `179.198.102.88`

---

## 🎉 Teste seu Sistema

Abra no navegador:

```
https://jotaonline.com.br/login
```

**Esperado:**
- ✅ Página carrega
- ✅ Cadeado SSL verde
- ✅ Formulário de login visível

**Login com:**
```
Email:    kairolopesoficial@gmail.com
Senha:    jx&CL%mFvt!x*Sm0
```

---

## 📱 Comandos Úteis Depois

```bash
# Ver status
ssh root@179.198.102.88
pm2 status

# Ver logs
pm2 logs iaezap

# Reiniciar app
pm2 restart iaezap

# Atualizar código (após push no GitHub)
cd /var/www/iaezap
git pull
npm install
npm run build
pm2 restart iaezap
```

---

## ✅ RESUMO

| Passo | O Quê | Status |
|-------|-------|--------|
| 1 | VPS fornecido | ✅ 179.198.102.88 |
| 2 | Conectar SSH | ⏳ Execute agora |
| 3 | Clone + build | ⏳ Execute agora |
| 4 | .env.production | ⏳ Configure agora |
| 5 | npm install | ⏳ Execute agora |
| 6 | npm run build | ⏳ Execute agora |
| 7 | PM2 startup | ⏳ Execute agora |
| 8 | Nginx config | ⏳ Execute agora |
| 9 | SSL certificate | ⏳ Execute agora |
| 10 | DNS config | ⏳ Hostinger painel |
| 11 | Aguardar propagação | ⏳ 15-30 min |
| 12 | Testar login | ⏳ Verificar |

---

## 🆘 Se Algo Falhar

### "npm install error"
```bash
npm cache clean --force
npm install
```

### "Build fails"
```bash
pm2 logs iaezap
# Ver erro específico e corrigir
npm run build
pm2 restart iaezap
```

### "HTTPS não funciona"
```bash
certbot renew --force-renewal
systemctl restart nginx
```

### "Application offline"
```bash
pm2 restart iaezap
pm2 logs iaezap
```

---

**Bom deployment!** 🚀

Se ficar travado, me avise com a mensagem de erro exato que receber.

