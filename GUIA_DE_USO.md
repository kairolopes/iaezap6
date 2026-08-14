# 📱 IAeZap - Guia Completo de Uso

## Visão Geral

IAeZap é um **sistema multi-tenant de CRM para automação WhatsApp** com integração Z-API. Você pode gerenciar múltiplas empresas, criar usuários com diferentes papéis e enviar/receber mensagens WhatsApp automaticamente.

---

## 🔑 Credenciais de Acesso (Master Admin)

```
URL: https://jotaonline.com.br/login
Email: kairolopesoficial@gmail.com
Senha: jx&CL%mFvt!x*Sm0
Papel: OWNER (acesso total)
```

---

## 📋 Passo a Passo: Login e Navegação

### 1️⃣ Fazer Login

1. Acesse: **https://jotaonline.com.br/login**
2. Email já preenchido: `kairolopesoficial@gmail.com`
3. Senha já preenchida: `jx&CL%mFvt!x*Sm0`
4. Clique em **"Entrar"**
5. Você será redirecionado ao Dashboard

### 2️⃣ Dashboard Principal

Após login, você verá:
- **Bem-vindo ao IAeZap!** - Informações de sua conta
- **Token de Acesso (RS256)** - Token JWT válido por 15 minutos
- **6 módulos disponíveis:**
  - 📊 Dashboard (Pronto)
  - 👥 **Gerenciamento de Usuários** (Pronto)
  - 💬 Integração Z-API (Ativo)
  - ⚙️ Admin Panel (Disponível)
  - 📱 Webhook Receiver (Ativo)
  - 🔐 Autenticação JWT (Ativo)

---

## 👥 Como Criar Novos Usuários

### Acessar a Página de Gerenciamento de Usuários

**Opção 1:** Clicar no card "Gerenciamento de Usuários" no Dashboard
- O card agora é clicável e leva à página `/dashboard/users`

**Opção 2:** Acessar diretamente via URL
```
https://jotaonline.com.br/dashboard/users
```

### Criar um Novo Usuário

1. **Clique no botão "+ Novo Usuário"**
   - Formulário aparecerá com 4 campos:

2. **Preencha o formulário:**
   - **Nome Completo:** Ex: "João Silva"
   - **Email:** Ex: "joao@example.com"
   - **Senha:** Ex: "Senha@123Segura"
   - **Papel:** Selecione um dos 3 papéis:
     - 🔍 **Viewer** - Apenas visualização de relatórios
     - 👤 **Member** - Acesso completo a mensagens e relatórios
     - 🔧 **Admin** - Gerenciamento de usuários e configurações

3. **Clique em "Criar Usuário"**
   - ✅ Sucesso: "Usuário [Nome] criado com sucesso!"
   - ❌ Erro: Mensagem de erro será exibida

### Visualizar Usuários Criados

A tabela abaixo do formulário mostra todos os usuários da sua empresa com:
- 👤 **Nome** do usuário
- 📧 **Email**
- 🎭 **Papel** (com badge colorida)
- ✅ **Status** (Ativo/Inativo)

---

## 🎭 Papéis e Permissões

| Papel | Visualização | Criar Usuários | Alterar Papéis | Gerenciar Empresas |
|-------|--------------|----------------|----------------|--------------------|
| **Owner** | ✅ Tudo | ✅ Sim | ✅ Sim | ✅ Sim |
| **Admin** | ✅ Tudo | ✅ Sim | ✅ Sim | ❌ Não |
| **Member** | ✅ Mensagens | ❌ Não | ❌ Não | ❌ Não |
| **Viewer** | 📊 Relatórios | ❌ Não | ❌ Não | ❌ Não |

---

## 📊 Dashboard - Informações Visíveis

Quando você faz login, vê:

```
👤 Usuário
   kairolopesoficial@gmail.com

🏢 Empresa
   00000000-0000-0000-0000-000000000001

👑 Papel
   OWNER (você tem acesso total)

✅ Status
   active (sua conta está ativa)

🔐 Token
   eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
   (válido por 15 minutos)
```

---

## 🔐 Segurança e Tokens

- **Token JWT (RS256):** Válido por **15 minutos**
- **Refresh Token:** Autoriza novas requisições quando expirar
- **Logout:** Remove tokens do localStorage
- **Senhas:** Criptografadas com Bcrypt (12 rounds)

---

## 📡 API Endpoints Disponíveis

Para integração programática, use estes endpoints:

### Autenticação
```bash
POST /api/auth/login
POST /api/auth/register
GET /api/auth/profile
POST /api/auth/refresh
POST /api/auth/logout
```

### Gerenciamento de Usuários
```bash
GET /api/admin/users
POST /api/admin/users
PATCH /api/admin/users/:id/role
```

### Gerenciamento de Empresas
```bash
GET /api/admin/companies
POST /api/admin/companies
```

### Webhooks Z-API
```bash
POST /api/webhooks/z-api/receive
```

---

## 💬 Integração Z-API (WhatsApp)

### Como Funciona
1. **Z-API webhook** envia mensagens para `/api/webhooks/z-api/receive`
2. **Sistema armazena** mensagens no banco de dados
3. **Isolamento multi-tenant:** Cada empresa vê apenas suas mensagens

### Estrutura de Evento Z-API
```json
{
  "event": "message.create",
  "data": {
    "phone": "5585987654321",
    "text": "Olá, como você está?",
    "timestamp": "2026-08-14T10:30:00Z"
  }
}
```

---

## 🚀 Recursos Prontos

✅ **Autenticação:** JWT RS256 com refresh tokens
✅ **Multi-tenant:** Isolamento por empresa (CNPJ)
✅ **Row-Level Security:** RLS no Supabase
✅ **Dashboard:** Interface responsiva
✅ **Gerenciamento de Usuários:** Criar, listar, alterar papéis
✅ **WhatsApp Integration:** Z-API webhook receiver
✅ **API REST:** Endpoints autenticados
✅ **SSL/TLS:** HTTPS com Let's Encrypt

---

## ⚙️ Configuração Técnica

### Stack Tecnológico
- **Frontend:** Next.js 16.3.0 + React + Tailwind CSS
- **Backend:** Next.js API Routes
- **Banco de Dados:** Supabase PostgreSQL
- **Autenticação:** JWT RS256 (2048-bit RSA)
- **Servidor:** Nginx + PM2 + Let's Encrypt
- **VPS:** Hostinger Ubuntu 24.04 LTS

### Ambiente de Produção
```
URL: https://jotaonline.com.br
VPS IP: 179.198.102.88
Domínio: jotaonline.com.br
SSL: Let's Encrypt (válido até 2026-11-12)
```

---

## 🆘 Troubleshooting

### Problema: "Invalid email or password"
**Solução:** Verifique se usa email e senha corretos (ver credenciais no topo)

### Problema: "Token expirado"
**Solução:** Faça login novamente. O token é válido por 15 minutos.

### Problema: Não consegue criar usuário
**Solução:** 
1. Verifique se está logado como OWNER ou ADMIN
2. Valide email e senha do novo usuário
3. Confirme que o email não existe já

### Problema: Página em branco após login
**Solução:** 
1. Limpe cache do navegador (Ctrl+Shift+Delete)
2. Atualize a página (F5)
3. Faça login novamente

---

## 📞 Suporte

📧 Email: kairo@zapbaratinho.com.br
🌐 Site: jotaonline.com.br
💬 WhatsApp: Através da plataforma

---

## 📝 Notas Importantes

⚠️ **IMPORTANTE:** Não compartilhe suas credenciais master com outras pessoas
⚠️ **IMPORTANTE:** Tokens são armazenados em localStorage (seguro apenas se usar HTTPS)
⚠️ **IMPORTANTE:** Altere a senha master regularmente
⚠️ **IMPORTANTE:** Backup regular do banco de dados

---

**Desenvolvido com ❤️ para automação WhatsApp**
IAeZap © 2026 - Todos os direitos reservados
