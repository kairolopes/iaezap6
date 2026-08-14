# 🚀 IAeZap - Deploy na Hostinger (jotaonline.com.br)

## 📋 PRÉ-REQUISITOS

### ✅ O que você já tem:
- [x] Domínio: jotaonline.com.br
- [x] Hostinger conta ativa
- [x] Aplicação IAeZap pronta
- [x] Repositório Git

### ✅ O que você precisa fazer:
- [ ] Escolher tipo de hospedagem (VPS recomendado)
- [ ] Configurar DNS
- [ ] Gerar chaves SSH
- [ ] Configurar variáveis de ambiente
- [ ] Deploy da aplicação

---

## 1️⃣ PASSO 1: ESCOLHER HOSPEDAGEM NA HOSTINGER

### Opção A: VPS (Recomendado para Node.js) ✅

**Por que VPS?**
- Suporte completo a Node.js
- Mais controle sobre servidor
- Melhor performance
- Ideal para SaaS

**Como fazer:**
1. Acesse: https://www.hostinger.com.br
2. Selecione: VPS (não compartilhada)
3. Escolha plano: **VPS 2GB RAM** (mínimo)
4. Sistema operacional: **Ubuntu 22.04 LTS**
5. Período: 12 meses (melhor preço)
6. Confirme pagamento

### Opção B: Hospedagem Compartilhada com Node.js

**Procure em:** Planos que mencionem "Node.js Ready"
- Nem todos suportam Node.js
- Verificar painel de controle

---

## 2️⃣ PASSO 2: ACESSAR O SERVIDOR

### Via Terminal (SSH)

**No seu computador (Windows/Mac/Linux):**

```bash
# Abra terminal/PowerShell

# Conecte ao servidor
ssh root@IP_DO_SEU_SERVIDOR

# Digite a senha que Hostinger enviou por email
```

**Você receberá via email:**
- IP do servidor
- Senha root
- Dados de acesso

### Exemplo:
```
IP: 192.168.1.100
Usuário: root
Senha: a1b2c3d4e5f6
```

---

## 3️⃣ PASSO 3: PREPARAR O SERVIDOR

### Atualize o sistema:
```bash
apt update && apt upgrade -y
```

### Instale Node.js e npm:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Verifique as versões:
```bash
node --version  # v18.x.x
npm --version   # 9.x.x
```

### Instale Git:
```bash
apt install git -y
```

### Instale PM2 (para manter app rodando):
```bash
npm install -g pm2
```

### Instale Nginx (proxy reverso):
```bash
apt install nginx -y
```

---

## 4️⃣ PASSO 4: CLONAR REPOSITÓRIO

```bash
# Vá para diretório de aplicações
cd /var/www

# Clone seu repositório (você precisa ter no GitHub)
git clone https://github.com/seu-usuario/iaezap.git

# Entre na pasta
cd iaezap

# Instale dependências
npm install
```

---

## 5️⃣ PASSO 5: CONFIGURAR VARIÁVEIS DE AMBIENTE

```bash
# Crie arquivo .env.production
nano .env.production
```

**Cole o conteúdo:**
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://gqromcfhiosfppqlottz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=seu_key_aqui

# JWT
JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----
JWT_ISSUER=iaezap
JWT_AUDIENCE=iaezap-api

# Tokens
JWT_ACCESS_TOKEN_EXPIRY=3600
JWT_REFRESH_TOKEN_EXPIRY=604800
BCRYPT_ROUNDS=12

# Next.js
NODE_ENV=production
PORT=3000
```

**Para adicionar variáveis multi-linha no Nano:**
```
# Digite: nano .env.production
# Cole o conteúdo acima linha por linha
# Pressione: Ctrl+X > Y > Enter
```

---

## 6️⃣ PASSO 6: BUILD DA APLICAÇÃO

```bash
# Entre na pasta (se não estiver)
cd /var/www/iaezap

# Build Next.js
npm run build
```

**Saída esperada:**
```
▲ Next.js 16.3.0
  - Compiled successfully
  - Routes collected
  - Build completed
```

---

## 7️⃣ PASSO 7: INICIAR COM PM2

```bash
# Inicie a aplicação
pm2 start npm --name "iaezap" -- start

# Verifique status
pm2 status

# Ver logs
pm2 logs iaezap

# Salvar para inicializar com servidor
pm2 startup
pm2 save
```

**Saída esperada:**
```
┌──────┬────┬─────────┬──────┬─────┐
│ id   │ name  │ status  │ restarts│ uptime │
├──────┼────┼─────────┼──────┼─────┤
│ 0    │ iaezap│ online  │ 0    │ 1s    │
└──────┴────┴─────────┴──────┴─────┘
```

---

## 8️⃣ PASSO 8: CONFIGURAR NGINX

```bash
# Crie arquivo de configuração
nano /etc/nginx/sites-available/jotaonline.com.br
```

**Cole o conteúdo:**
```nginx
server {
    listen 80;
    listen [::]:80;
    
    server_name jotaonline.com.br www.jotaonline.com.br;
    
    # Redirecionar HTTP para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    server_name jotaonline.com.br www.jotaonline.com.br;
    
    # Certificado SSL (será gerado no próximo passo)
    ssl_certificate /etc/letsencrypt/live/jotaonline.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/jotaonline.com.br/privkey.pem;
    
    # Proxy para Node.js
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
    
    # Cache estático
    location /_next/static {
        alias /var/www/iaezap/.next/static;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }
}
```

**Salve:** Ctrl+X > Y > Enter

### Ative o site:
```bash
ln -s /etc/nginx/sites-available/jotaonline.com.br /etc/nginx/sites-enabled/

# Teste configuração
nginx -t

# Reinicie Nginx
systemctl restart nginx
```

---

## 9️⃣ PASSO 9: CERTIFICADO SSL GRATUITO

```bash
# Instale Certbot
apt install certbot python3-certbot-nginx -y

# Gere certificado
certbot certonly --standalone -d jotaonline.com.br -d www.jotaonline.com.br

# Email: seu@email.com
# Concorde com termos: Y
# Newsletter: N (ou Y)
```

**Certificado será gerado em:**
```
/etc/letsencrypt/live/jotaonline.com.br/
```

### Auto-renovação:
```bash
# O Certbot já configura auto-renovação
# Verifique:
systemctl status certbot.timer
```

---

## 🔟 PASSO 10: CONFIGURAR DNS

### Na Hostinger:

1. Acesse painel Hostinger
2. Vá para: Domínios → jotaonline.com.br
3. Clique: Gerenciar DNS
4. Encontre registro **A**
5. Mude para IP do seu servidor VPS

**Exemplo:**
```
Tipo: A
Nome: @
Valor: 192.168.1.100 (seu IP)
TTL: 3600
```

**Para subdomínios:**
```
Tipo: A
Nome: www
Valor: 192.168.1.100
TTL: 3600
```

**Aguarde propagação DNS (15-30 minutos)**

---

## 1️⃣1️⃣ PASSO 11: TESTAR

```bash
# SSH no servidor:
ssh root@jotaonline.com.br

# Verifique se app está rodando:
pm2 status

# Veja logs:
pm2 logs iaezap

# Teste conectividade:
curl http://localhost:3000
```

### No navegador:
```
https://jotaonline.com.br/login
```

**Esperado:**
- Página de login carregando
- SSL certificado válido (cadeado verde)
- Sem erros no console

---

## 🔐 PASSO 12: CONFIGURAR FIREWALL

```bash
# Instale UFW
apt install ufw -y

# Libere portas essenciais
ufw allow 22/tcp     # SSH
ufw allow 80/tcp     # HTTP
ufw allow 443/tcp    # HTTPS

# Ative firewall
ufw enable

# Verifique
ufw status
```

---

## 🆘 MONITORAR & MANUTENÇÃO

### Ver status da aplicação:
```bash
pm2 status
pm2 logs iaezap
```

### Reiniciar aplicação:
```bash
pm2 restart iaezap
```

### Atualizar código (novo deploy):
```bash
cd /var/www/iaezap
git pull origin main
npm install
npm run build
pm2 restart iaezap
```

### Ver espaço em disco:
```bash
df -h
```

### Ver uso de memória:
```bash
free -h
```

---

## 📊 CHECKLIST DE DEPLOY

- [ ] VPS contratada e configurada
- [ ] SSH funcionando
- [ ] Node.js instalado
- [ ] Repositório clonado
- [ ] npm install executado
- [ ] .env.production criado
- [ ] npm run build concluído
- [ ] PM2 iniciado
- [ ] Nginx configurado
- [ ] SSL certificado gerado
- [ ] DNS apontando para servidor
- [ ] HTTPS funcionando
- [ ] Login page acessível
- [ ] API respondendo corretamente

---

## 🚀 ACESSO FINAL

```
Site:       https://jotaonline.com.br
Login:      https://jotaonline.com.br/login
Dashboard:  https://jotaonline.com.br/dashboard

Email:      kairolopesoficial@gmail.com
Senha:      jx&CL%mFvt!x*Sm0
```

---

## ⚠️ ERROS COMUNS

### "Conexão recusada"
```bash
# Verifique se app está rodando
pm2 status
pm2 logs iaezap

# Reinicie
pm2 restart iaezap
```

### "Certificado inválido"
```bash
# Renove certificado manualmente
certbot renew --force-renewal
```

### "Variáveis de ambiente não lidas"
```bash
# Verifique arquivo .env.production
cat /var/www/iaezap/.env.production

# Reinicie app
pm2 restart iaezap
```

### "Conexão Supabase falha"
```bash
# Verifique credenciais no .env.production
# Teste conectividade:
curl https://gqromcfhiosfppqlottz.supabase.co
```

---

## 📞 SUPORTE HOSTINGER

- **Chat ao vivo:** Panel Hostinger > Suporte
- **Email:** support@hostinger.com.br
- **Telefone:** +55 47 3048-3900

---

## 📈 PRÓXIMOS PASSOS

### 1. Backups Automáticos
```bash
# Configure backup automático
crontab -e

# Adicione:
0 2 * * * cd /var/www/iaezap && git pull && npm run build && pm2 restart iaezap
```

### 2. Monitoramento
- Uptime Robot: https://uptimerobot.com
- New Relic: https://newrelic.com
- DataDog: https://datadoghq.com

### 3. Escalabilidade Futura
- Adicionar Load Balancer
- Múltiplas instâncias Node.js
- Cache com Redis
- CDN para arquivos estáticos

---

## ✅ STATUS

Depois de seguir todos os passos:

✅ IAeZap em produção
✅ Domínio funcionando
✅ SSL certificado
✅ Auto-renovação ativa
✅ Backups configurados
✅ Monitoramento pronto

**Sua aplicação estará 100% operacional!**

---

**Tempo esperado:** 30-45 minutos
**Dificuldade:** Intermediária
**Suporte:** Disponível 24/7 na Hostinger
