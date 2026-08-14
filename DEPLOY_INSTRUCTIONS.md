# 🚀 INSTRUÇÕES DE DEPLOY - IAeZap em jotaonline.com.br

## 📍 RESUMO
Este guia mostra como colocar o IAeZap online em jotaonline.com.br usando o VPS da Hostinger.

**Tempo total: ~45 minutos**
**Dificuldade: Fácil (copia/cola de comandos)**

---

## 🔑 CREDENCIAIS DO SEU VPS

```
IP:            179.198.102.88
Usuário:       root
Senha:         Bate123ria@5
Sistema:       Ubuntu 24.04 LTS
```

---

## ✅ PASSO 1: CONECTAR AO VPS (2 min)

### No seu computador, abra PowerShell e execute:

```bash
ssh root@179.198.102.88
```

**Digite a senha quando pedir:**
```
Bate123ria@5
```

**Você verá algo assim:**
```
root@vps:~#
```

✅ Pronto! Você está no VPS.

---

## 📥 PASSO 2: BAIXAR E EXECUTAR O SCRIPT (40 min)

### Cole este comando (tudo de uma vez):

```bash
curl -o setup-vps.sh https://raw.githubusercontent.com/KairoLopes/iaezap/main/setup-vps.sh && chmod +x setup-vps.sh && bash setup-vps.sh
```

### O script vai fazer automaticamente:

✅ Atualizar sistema  
✅ Instalar Node.js 18  
✅ Instalar Git, Nginx, PM2  
✅ Clonar seu repositório do GitHub  
✅ Instalar dependências  
✅ Fazer build da aplicação  
✅ Iniciar com PM2  
✅ Configurar Nginx  
✅ Gerar certificado SSL  
✅ Configurar firewall  

### ⚠️ IMPORTANTE durante a execução:

**Quando aparecer:**
```
⚠️  IMPORTANTE: Edite .env.production com suas credenciais JWT
   nano /var/www/iaezap/.env.production
   Copie as chaves de: C:\Users\Kairo Lopes\OneDrive\Documentos\Kairo\claude code\iaezap6\.env.local

Pressione ENTER após editar as credenciais...
```

**Você precisa:**

1. Abrir seu arquivo `.env.local` local (no seu computador)
2. Copiar as linhas de JWT_PRIVATE_KEY e JWT_PUBLIC_KEY
3. No servidor, quando aparecer o editor `nano`:
   - Cole as chaves
   - Pressione `Ctrl+X`
   - Pressione `Y`
   - Pressione `Enter`
4. Pressione `Enter` no prompt do script

**Se não souber onde estão suas chaves JWT:**

Execute localmente:
```bash
cat .env.local
```

Procure por:
```
JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...
```

Copie exatamente como aparecem.

---

## 🌐 PASSO 3: CONFIGURAR DNS (2 min)

Enquanto o script roda, configure o DNS na Hostinger:

1. Acesse: **https://panel.hostinger.com.br**
2. Vá para: **Domínios**
3. Clique em: **jotaonline.com.br**
4. Clique em: **Gerenciar DNS**
5. Encontre o registro **A** (deve estar apontando para outro IP)
6. Edite e mude o valor para: **179.198.102.88**
7. Clique em **Salvar**

**Aguarde 15-30 minutos para DNS propagar**

---

## ✅ PASSO 4: TESTAR

### Quando o script terminar, você verá:

```
=============================="
✅ SETUP COMPLETO!
==============================

🌐 Acesse em:
   https://jotaonline.com.br/login

🔑 Credenciais:
   Email:    kairolopesoficial@gmail.com
   Senha:    jx&CL%mFvt!x*Sm0
```

### Abra no navegador:

```
https://jotaonline.com.br/login
```

**Esperado:**
- ✅ Página carrega
- ✅ Cadeado SSL verde (HTTPS)
- ✅ Formulário de login visível

### Teste o login:

```
Email:    kairolopesoficial@gmail.com
Senha:    jx&CL%mFvt!x*Sm0
```

✅ Se conseguir fazer login, **PRONTO!**

---

## 🎉 PRONTO!

Seu site está online em:
```
https://jotaonline.com.br
```

---

## 📱 COMANDOS ÚTEIS DEPOIS

Quando quiser atualizar o código (depois que fizer push no GitHub):

```bash
# SSH no VPS
ssh root@179.198.102.88

# Atualizar código e aplicação
cd /var/www/iaezap
git pull
npm install
npm run build
pm2 restart iaezap

# Ver status
pm2 status

# Ver logs
pm2 logs iaezap
```

---

## 🆘 SE ALGO FALHAR

### "npm install falha"
```bash
# Limpar cache
npm cache clean --force
npm install
```

### "Build falha"
```bash
# Ver erro
pm2 logs iaezap
# Corrigir e:
npm run build
pm2 restart iaezap
```

### "HTTPS não funciona"
```bash
# Renovar certificado
certbot renew --force-renewal
systemctl restart nginx
```

### "DNS não funciona"
```bash
# Verificar
nslookup jotaonline.com.br
# Se não retornar seu IP, aguardar propagação (até 30 min)
```

### "Aplicação offline"
```bash
pm2 restart iaezap
pm2 status
pm2 logs iaezap
```

---

## 📊 RESUMO FINAL

| O Que | Onde | Quando |
|-------|------|--------|
| Conectar VPS | PowerShell: `ssh root@179.198.102.88` | Agora |
| Executar setup | No VPS: comando `curl \| bash` | Agora |
| Configurar DNS | Painel Hostinger | Durante setup |
| Testar acesso | https://jotaonline.com.br/login | Após 15-30 min |
| Atualizar código | `git pull && npm run build && pm2 restart` | Depois (quando precisar) |

---

**Bom deploy!** 🚀

Se ficar preso em alguma etapa, execute:
```bash
pm2 logs iaezap
```

E veja a mensagem de erro para diagnosticar.

