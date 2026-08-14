# ✅ IAEZAP - CHECKLIST DE DEPLOYMENT NA HOSTINGER

## 🎯 OBJETIVO FINAL
Colocar IAeZap em produção em jotaonline.com.br na Hostinger

---

## 📋 PRÉ-DEPLOYMENT (Local)

### Preparação do Código
- [ ] Código testado localmente (`npm run dev` funcionando)
- [ ] Variáveis de ambiente (.env.local) corretas
- [ ] Build local funciona (`npm run build`)
- [ ] Sem erros no console
- [ ] Repositório Git criado (GitHub/GitLab)
- [ ] Código commitado e pusheado para `main` branch

### Verificações Finais
- [ ] Supabase credenciais confirmadas
- [ ] JWT keys privada/pública geradas
- [ ] Banco de dados migrado
- [ ] Master user criado
- [ ] Z-API configurado (opcional para launch)

---

## 🔧 PASSO 1: HOSTINGER SETUP

### Contratação VPS
- [ ] VPS 2GB RAM contratada
- [ ] Ubuntu 22.04 LTS selecionado
- [ ] IP do servidor recebido via email
- [ ] Senha root recebida

### Primeiro Acesso
- [ ] SSH funcionando
- [ ] Conectado ao servidor
- [ ] Comando `whoami` retorna `root`

---

## 2️⃣ PASSO 2: PREPARAR SERVIDOR

### Atualizar Sistema
```bash
apt update && apt upgrade -y
```
- [ ] Comando executado com sucesso

### Instalar Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```
- [ ] Node.js v18+ instalado
- [ ] npm 9+ instalado
- [ ] Comando `node --version` funciona

### Instalar Git
```bash
apt install git -y
```
- [ ] Git instalado
- [ ] Comando `git --version` funciona

### Instalar PM2
```bash
npm install -g pm2
```
- [ ] PM2 instalado globalmente
- [ ] Comando `pm2 --version` funciona

### Instalar Nginx
```bash
apt install nginx -y
systemctl start nginx
```
- [ ] Nginx instalado
- [ ] Nginx rodando

---

## 3️⃣ PASSO 3: CLONAR E CONFIGURAR APP

### Clonar Repositório
```bash
cd /var/www
git clone https://github.com/seu-usuario/iaezap.git
cd iaezap
```
- [ ] Repositório clonado
- [ ] Pasta `/var/www/iaezap` existe
- [ ] Arquivo `package.json` visible

### Instalar Dependências
```bash
npm install
```
- [ ] `npm install` completado
- [ ] Pasta `node_modules` criada
- [ ] Sem erros críticos

### Criar .env.production
```bash
nano .env.production
# Cole as variáveis do .env.production.example
```
- [ ] Arquivo `.env.production` criado
- [ ] Supabase URL preenchida
- [ ] JWT keys preenchidas
- [ ] NODE_ENV=production definido

### Build da Aplicação
```bash
npm run build
```
- [ ] Build completa com sucesso
- [ ] Pasta `.next` criada
- [ ] Sem erros de compilação

---

## 4️⃣ PASSO 4: CONFIGURAR PM2

### Iniciar com PM2
```bash
pm2 start npm --name "iaezap" -- start
```
- [ ] PM2 inicia aplicação
- [ ] Comando `pm2 status` mostra status "online"

### Configurar Startup
```bash
pm2 startup
pm2 save
```
- [ ] Comando `pm2 startup` executado
- [ ] Comando `pm2 save` executado
- [ ] App reinicia automaticamente ao reboot

### Verificar Logs
```bash
pm2 logs iaezap
```
- [ ] Logs mostram app rodando
- [ ] Listening on port 3000
- [ ] Sem erros críticos

---

## 5️⃣ PASSO 5: CONFIGURAR NGINX

### Criar Config Nginx
```bash
nano /etc/nginx/sites-available/jotaonline.com.br
```
- [ ] Arquivo criado com config do guia HOSTINGER_DEPLOYMENT.md
- [ ] Server names corretos: jotaonline.com.br www.jotaonline.com.br
- [ ] Proxy pass para localhost:3000

### Ativar Site
```bash
ln -s /etc/nginx/sites-available/jotaonline.com.br /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```
- [ ] Link simbólico criado
- [ ] `nginx -t` retorna "ok"
- [ ] Nginx reiniciado com sucesso

---

## 6️⃣ PASSO 6: CERTIFICADO SSL

### Instalar Certbot
```bash
apt install certbot python3-certbot-nginx -y
```
- [ ] Certbot instalado

### Gerar Certificado
```bash
certbot certonly --standalone -d jotaonline.com.br -d www.jotaonline.com.br
```
- [ ] Email: seu@email.com preenchido
- [ ] Termos aceitos
- [ ] Certificado gerado em `/etc/letsencrypt/live/jotaonline.com.br/`

### Verificar Auto-Renovação
```bash
systemctl status certbot.timer
```
- [ ] Certbot timer está ativo
- [ ] Auto-renovação configurada

---

## 7️⃣ PASSO 7: CONFIGURAR DNS

### Na Painel Hostinger
1. Acesse: https://panel.hostinger.com.br
2. Domínios → jotaonline.com.br
3. Gerenciar DNS

### Registros DNS
- [ ] Registro A (raiz): @ → SEU_IP
- [ ] Registro A (www): www → SEU_IP
- [ ] TTL: 3600 ou menor para propagação rápida

### Verificar Propagação
```bash
# No seu computador
nslookup jotaonline.com.br
# Deve retornar seu IP
```
- [ ] DNS propaga para seu IP
- [ ] Propagação completa (15-30 min)

---

## 8️⃣ PASSO 8: FIREWALL

### Configurar UFW
```bash
apt install ufw -y
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```
- [ ] UFW instalado
- [ ] Portas SSH (22), HTTP (80), HTTPS (443) liberadas
- [ ] Firewall ativado

---

## 9️⃣ PASSO 9: TESTAR

### No Servidor
```bash
# Verifique se app está rodando
pm2 status
# Acesse localmente
curl http://localhost:3000
```
- [ ] PM2 mostra "online"
- [ ] Curl retorna HTML (não erro)

### No Navegador
```
https://jotaonline.com.br
```
- [ ] Página carrega
- [ ] Cadeado SSL verde
- [ ] Sem erros no console (F12)
- [ ] Redirecionamento HTTP→HTTPS funciona

### Login Test
```
https://jotaonline.com.br/login
```
- [ ] Página de login carrega
- [ ] Formulário visível
- [ ] Credentials funcionam:
  - Email: kairolopesoficial@gmail.com
  - Senha: jx&CL%mFvt!x*Sm0

### API Test
```bash
curl -X POST https://jotaonline.com.br/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"kairolopesoficial@gmail.com",
    "password":"jx&CL%mFvt!x*Sm0"
  }'
```
- [ ] Retorna `"success": true`
- [ ] Access token gerado
- [ ] Sem erros de conexão

---

## 🔟 PASSO 10: MONITORAMENTO

### Verificar Status Regular
```bash
# SSH no servidor
ssh root@jotaonline.com.br
pm2 status
pm2 logs iaezap
```
- [ ] PM2 sempre online
- [ ] Sem erros nos logs

### Configurar Auto-Deploy
```bash
# Criar script de deploy automático
nano deploy.sh
# Copiar conteúdo de deploy.sh
chmod +x deploy.sh
```
- [ ] Script deploy.sh criado
- [ ] Executável

---

## ✅ PÓS-DEPLOYMENT

### Backups
- [ ] Backup inicial do banco de dados feito
- [ ] Backup automático agendado (cron)

### Monitoramento Externo
- [ ] Uptime Robot configurado (uptimerobot.com)
- [ ] Alertas de downtime ativados
- [ ] Email de notificação testado

### Logging
- [ ] PM2 logs configurados
- [ ] Rotação de logs habilitada
- [ ] Sem avisos no espaço em disco

### Documentação
- [ ] IP do servidor anotado
- [ ] Senha root guardada em local seguro
- [ ] Credenciais Supabase confirmadas
- [ ] JWT keys backup em local seguro

---

## 📊 CHECKLIST RESUMIDO

**Antes de Hostinger:**
- [ ] Código testado localmente
- [ ] Repositório Git pusheado
- [ ] Credenciais preparadas

**Hostinger Setup:**
- [ ] VPS contratada (2GB RAM)
- [ ] SSH funcionando
- [ ] Node.js, npm, git, PM2, Nginx instalados

**Deploy:**
- [ ] Código clonado
- [ ] Dependencies instaladas
- [ ] Build completo
- [ ] PM2 iniciado
- [ ] Nginx configurado
- [ ] SSL certificado
- [ ] DNS apontando

**Testes:**
- [ ] HTTPS funcionando
- [ ] Login funciona
- [ ] API respondendo
- [ ] Sem erros críticos

**Pós-Deploy:**
- [ ] Backups configurados
- [ ] Monitoramento ativo
- [ ] Documentação completa

---

## 🆘 TROUBLESHOOTING RÁPIDO

| Problema | Solução |
|----------|---------|
| Conexão recusada | `pm2 restart iaezap` |
| HTTPS não funciona | `certbot renew --force-renewal` |
| Variáveis não lidas | Verificar `.env.production` existe |
| Supabase erro | Testar `curl https://gqromcfhiosfppqlottz.supabase.co` |
| Aplicação lenta | Verificar `pm2 monit` e RAM disponível |
| DNS não funciona | Aguardar propagação (até 30 min) |

---

## 📈 DEPOIS DE DEPLOY

**Dentro de 1 Semana:**
- [ ] Testar Z-API webhooks
- [ ] Testar criar novos usuários
- [ ] Testar criar novas empresas
- [ ] Documentar qualquer issue

**Dentro de 1 Mês:**
- [ ] Performance monitoring
- [ ] Planejar backup strategy
- [ ] Planejar scaling (se necessário)

---

## 🎉 STATUS FINAL

Quando todo checklist ✅, você terá:

✅ **jotaonline.com.br em produção**
✅ **HTTPS seguro com certificado SSL**
✅ **Auto-deploy scripts prontos**
✅ **Monitoramento ativo**
✅ **Backups automáticos**
✅ **100% operacional**

---

**Tempo Total:** 45-60 minutos
**Dificuldade:** Intermediária
**Status:** Pronto para Produção

**Bom deploy!** 🚀
