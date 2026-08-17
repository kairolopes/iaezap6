# ⚡ EXECUTE ESTE COMANDO NO VPS

## Copie e execute NO TERMINAL do seu VPS:

```bash
ssh root@179.198.102.88
```

Ou direto em uma linha:

```bash
ssh root@179.198.102.88 "cd /root/iaezap6 && git fetch origin && git reset --hard origin/main && npm ci && npm run build && pm2 restart all && pm2 save && echo '✅ DEPLOYMENT COMPLETE'"
```

---

## O que este comando faz:

1. ✅ Conecta ao VPS
2. ✅ Vai para a pasta do app
3. ✅ Puxa o código mais recente do GitHub
4. ✅ Instala dependências
5. ✅ Faz build do Next.js
6. ✅ Reinicia PM2
7. ✅ Salva estado do PM2

---

## Alternativa: Usar o script bash

```bash
ssh root@179.198.102.88 "cd /root/iaezap6 && chmod +x deploy.sh && ./deploy.sh"
```

---

## Teste após deployment:

```bash
curl -X POST https://jotaonline.com.br/api/admin/companies/with-users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test Company",
    "slug": "test-co",
    "cnpj": "12.345.678/0001-90",
    "plan": "professional",
    "users": [
      {
        "email": "admin@test.com",
        "fullName": "Admin Test",
        "role": "admin"
      }
    ]
  }'
```

---

## ⚠️ Se der erro de permissão SSH:

Você pode ter que configurar a chave SSH primeiro:

```bash
# Copy your public key to VPS
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@179.198.102.88

# Then try the deployment command again
```

---

**Só falta isso! Todo o código está pronto.** 🚀
