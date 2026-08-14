# 🚀 DEPLOY RÁPIDO - Do GitHub até jotaonline.com.br Online

**Tempo total: ~1 hora**

---

## ✅ PRÉ-REQUISITOS

Você já tem:
- [x] Código no GitHub
- [x] Domínio: jotaonline.com.br
- [ ] Hospedagem Hostinger (precisa contratar)

---

## PASSO 1️⃣: CONTRATAR HOSTINGER (5 min)

**URL:** https://www.hostinger.com.br

**O que contratar:**
- ❌ NÃO: Hospedagem compartilhada
- ✅ SIM: **VPS**

**Especificações:**
```
Tipo:           VPS
RAM:            2GB (mínimo)
Sistema:        Ubuntu 22.04 LTS
Período:        12 meses
Preço:          ~R$25/mês
```

**Você vai receber por email:**
```
IP do servidor:    192.168.1.100 (exemplo)
Usuário:           root
Senha:             abc123def456
```

---

## PASSO 2️⃣: ACESSAR SERVIDOR (2 min)

**No seu computador, abra Terminal/PowerShell:**

```bash
ssh root@192.168.1.100
# Digite a senha que recebeu
```

**Pronto! Você está no servidor Hostinger**

```
root@server:~#
```

---

## PASSO 3️⃣: PREPARAR SERVIDOR (10 min)

**Cole cada comando um por um:**

```bash
# Atualizar sistema
apt update && apt upgrade -y

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Instalar Git
apt install git -y

# Instalar PM2 (mantém app rodando)
npm install -g pm2

# Instalar Nginx (proxy)
apt install nginx -y

# Testar instalações
node --version
npm --version
git --version
```

---

## PASSO 4️⃣: CLONAR REPOSITÓRIO (2 min)

```bash
# Ir para pasta de apps
cd /var/www

# Clonar seu repositório
git clone https://github.com/SEU_USUARIO/iaezap.git

# Entrar na pasta
cd iaezap

# Ver se os arquivos estão lá
ls -la
```

**Você deve ver:**
```
package.json
src/
public/
.next/ (ou será criado)
```

---

## PASSO 5️⃣: CONFIGURAR VARIÁVEIS (5 min)

**Criar arquivo .env.production:**

```bash
nano .env.production
```

**Cole isso (adapte suas credenciais):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://gqromcfhiosfppqlottz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0...
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0...

JWT_ISSUER=iaezap
JWT_AUDIENCE=iaezap-api
JWT_ACCESS_TOKEN_EXPIRY=3600
JWT_REFRESH_TOKEN_EXPIRY=604800

NODE_ENV=production
PORT=3000
```

**Para salvar:** `Ctrl+X` → `Y` → `Enter`

**Dica:** Você pode copiar do arquivo `.env.production.example` do repositório se houver

---

## PASSO 6️⃣: BUILD E INICIAR (15 min)

```bash
# Instalar dependências
npm install

# Fazer build
npm run build

# Iniciar com PM2
pm2 start npm --name "iaezap" -- start

# Verificar status
pm2 status
```

**Resultado esperado:**
```
id  │ name   │ status   │
─────┼────────┼──────────┤
0   │ iaezap │ online   │
```

---

## PASSO 7️⃣: CONFIGURAR NGINX (5 min)

**Criar arquivo de configuração:**

```bash
nano /etc/nginx/sites-available/jotaonline.com.br
```

**Cole isso:**
```nginx
server {
    listen 80;
    server_name jotaonline.com.br www.jotaonline.com.br;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
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
    }
}
```

**Salve:** `Ctrl+X` → `Y` → `Enter`

**Ativar:**
```bash
ln -s /etc/nginx/sites-available/jotaonline.com.br /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

---

## PASSO 8️⃣: CERTIFICADO SSL (5 min)

```bash
# Instalar Certbot
apt install certbot python3-certbot-nginx -y

# Gerar certificado (responda as perguntas)
certbot certonly --standalone -d jotaonline.com.br -d www.jotaonline.com.br
```

**Quando pedir:**
```
Email: seu@email.com
Aceitar termos: Y
Newsletter: N (ou Y)
```

**Resultado:**
```
Congratulations! Your certificate has been issued.
```

---

## PASSO 9️⃣: CONFIGURAR DNS (2 min)

**Na Hostinger (painel web):**

1. Vá para: **Domínios**
2. Clique em: **jotaonline.com.br**
3. Clique em: **Gerenciar DNS**
4. Encontre o registro **A** (raiz)
5. Mude o valor para seu **IP do VPS**

```
Tipo:   A
Nome:   @
Valor:  192.168.1.100 (seu IP)
TTL:    3600
```

**Salve e aguarde 15-30 minutos** (propagação DNS)

---

## PASSO 🔟: TESTAR (5 min)

**No servidor, verifique:**
```bash
pm2 status          # App online?
pm2 logs iaezap     # Sem erros?
curl http://localhost:3000  # Responde?
```

**No navegador:**
```
https://jotaonline.com.br/login
```

**Esperado:**
- ✅ Página carrega
- ✅ Cadeado SSL verde
- ✅ Sem erros

**Teste login:**
```
Email:    kairolopesoficial@gmail.com
Senha:    jx&CL%mFvt!x*Sm0
```

---

## 🎉 PRONTO!

Seu site está online em:
```
https://jotaonline.com.br
```

---

## 📱 COMANDOS ÚTEIS DEPOIS

```bash
# Ver status da app
pm2 status

# Ver logs em tempo real
pm2 logs iaezap

# Reiniciar app (após atualizar código)
pm2 restart iaezap

# Atualizar código e fazer deploy novo
cd /var/www/iaezap
git pull
npm install
npm run build
pm2 restart iaezap
```

---

## 🆘 SE ALGO FALHAR

**App não sobe:**
```bash
pm2 logs iaezap  # Ver erro
# Verificar .env.production está correto
```

**HTTPS não funciona:**
```bash
certbot renew --force-renewal
systemctl restart nginx
```

**DNS não funciona:**
```bash
# Aguardar propagação (até 30 min)
nslookup jotaonline.com.br
```

**Nginx erro:**
```bash
nginx -t          # Ver erro
systemctl restart nginx
```

---

## ✅ CHECKLIST FINAL

- [ ] VPS contratada
- [ ] SSH funcionando
- [ ] Node.js instalado
- [ ] Repositório clonado
- [ ] .env.production criado
- [ ] npm install OK
- [ ] npm run build OK
- [ ] PM2 iniciado
- [ ] Nginx configurado
- [ ] SSL certificado gerado
- [ ] DNS apontando
- [ ] HTTPS funciona
- [ ] Login funciona

---

## 🚀 RESUMO

| Passo | O Que Fazer | Tempo |
|-------|-----------|-------|
| 1 | Contratar VPS | 5 min |
| 2 | SSH no servidor | 2 min |
| 3 | Instalar ferramentas | 10 min |
| 4 | Clonar GitHub | 2 min |
| 5 | Configurar .env | 5 min |
| 6 | Build e iniciar | 15 min |
| 7 | Nginx proxy | 5 min |
| 8 | SSL certificado | 5 min |
| 9 | DNS | 2 min |
| 10 | Testes | 5 min |
| **TOTAL** | | **~60 min** |

---

**Bom deploy!** 🚀

Seu IAeZap vai estar online em jotaonline.com.br em menos de 1 hora!
