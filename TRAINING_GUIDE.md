# 🚀 IAeZap - Guia Completo de Uso

## ÍNDICE
1. [Começar](#1-começar)
2. [Fazer Login](#2-fazer-login)
3. [Entender o Dashboard](#3-entender-o-dashboard)
4. [Gerenciar Usuários](#4-gerenciar-usuários)
5. [Gerenciar Empresas](#5-gerenciar-empresas)
6. [Integração Z-API](#6-integração-z-api)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. COMEÇAR

### 1.1 Acessar a Aplicação

**URL de Acesso:**
```
http://localhost:3000/login
```

**Requisitos:**
- ✅ Node.js 18+
- ✅ npm ou yarn
- ✅ Servidor rodando: `npm run dev`

### 1.2 Credenciais Padrão (Master User)

```
Email:    kairolopesoficial@gmail.com
Senha:    jx&CL%mFvt!x*Sm0
Papel:    owner
Empresa:  Master Company
```

**⚠️ IMPORTANTE:** Guarde essas credenciais com segurança!

---

## 2. FAZER LOGIN

### Passo 1: Abrir a Página de Login
```
Abra seu navegador e acesse: http://localhost:3000/login
```

### Passo 2: Preencher Credenciais
```
Campo "Email":    kairolopesoficial@gmail.com
Campo "Senha":    jx&CL%mFvt!x*Sm0
```

### Passo 3: Clicar em "Entrar"
```
Clique no botão verde "Entrar"
```

### Passo 4: Aguardar Redirecionamento
```
Você será redirecionado automaticamente para o dashboard
Tempo esperado: 2-3 segundos
```

### Resposta do Login (Backend)
```json
{
  "success": true,
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "00000000-0000-0000-0000-000000000002",
    "email": "kairolopesoficial@gmail.com",
    "full_name": "Master Admin",
    "role": "owner",
    "company_id": "00000000-0000-0000-0000-000000000001",
    "status": "active"
  },
  "expires_in": 900,
  "token_type": "Bearer"
}
```

---

## 3. ENTENDER O DASHBOARD

### 3.1 Seções Principais

#### **🏠 Seção de Boas-vindas**
- Exibe seu nome e email
- Mostra informações da empresa
- Botão de logout (canto superior direito)

#### **🔐 Seção de Token**
- Mostra seu JWT access token
- Válido por 15 minutos
- Use em requisições autenticadas

#### **📊 Seções de Funcionalidades**
- Dashboard Analytics
- Gerenciamento de Usuários
- Integração Z-API
- Admin Panel
- Webhook Receiver
- Autenticação JWT

#### **📡 Seção de API Endpoints**
- Lista todos os endpoints disponíveis
- Mostra método HTTP (GET, POST, PATCH)
- Descrição do que cada endpoint faz

#### **💻 Seção de Código**
- Exemplo prático de como usar cURL
- Mostra como fazer login
- Mostra como usar o token

---

## 4. GERENCIAR USUÁRIOS

### 4.1 Listar Usuários da Sua Empresa

**Via API (cURL):**
```bash
curl -X GET http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer SEU_TOKEN"
```

**Resposta Esperada:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user-uuid",
      "email": "user@company.com",
      "full_name": "John Doe",
      "role": "member",
      "status": "active",
      "company_id": "company-uuid"
    }
  ]
}
```

### 4.2 Criar Novo Usuário

**Via API (cURL):**
```bash
curl -X POST http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "novousuario@company.com",
    "full_name": "Novo Usuário",
    "role": "member"
  }'
```

**Parâmetros:**
- `email` (string, obrigatório) - Email único do usuário
- `full_name` (string, obrigatório) - Nome completo
- `role` (string, obrigatório) - owner/admin/member/viewer

**Resposta Esperada:**
```json
{
  "success": true,
  "data": {
    "id": "new-user-uuid",
    "email": "novousuario@company.com",
    "full_name": "Novo Usuário",
    "role": "member",
    "status": "active"
  }
}
```

### 4.3 Alterar Papel do Usuário

**Via API (cURL):**
```bash
curl -X PATCH http://localhost:3000/api/admin/users/USER_ID/role \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "admin"
  }'
```

**Papéis Disponíveis:**
```
owner  → Acesso completo (criar empresas, deletar dados)
admin  → Acesso administrativo (gerenciar settings)
member → Acesso padrão (ver dados da empresa)
viewer → Acesso leitura (apenas visualizar)
```

**Hierarquia:**
```
owner > admin > member > viewer
```

---

## 5. GERENCIAR EMPRESAS

### 5.1 Listar Empresas (Apenas Master User)

**Via API (cURL):**
```bash
curl -X GET http://localhost:3000/api/admin/companies \
  -H "Authorization: Bearer SEU_TOKEN"
```

**Resposta Esperada:**
```json
{
  "success": true,
  "data": [
    {
      "id": "00000000-0000-0000-0000-000000000001",
      "name": "Master Company",
      "slug": "master",
      "cnpj": "00.000.000/0000-00",
      "plan": "enterprise",
      "status": "active",
      "owner_id": "00000000-0000-0000-0000-000000000002"
    }
  ]
}
```

### 5.2 Criar Nova Empresa

**Via API (cURL):**
```bash
curl -X POST http://localhost:3000/api/admin/companies \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Minha Empresa",
    "cnpj": "12.345.678/0001-90",
    "plan": "professional"
  }'
```

**Parâmetros:**
- `name` (string, obrigatório) - Nome da empresa
- `cnpj` (string, obrigatório) - CNPJ no formato XX.XXX.XXX/XXXX-XX
- `plan` (string, obrigatório) - starter/professional/enterprise

---

## 6. INTEGRAÇÃO Z-API

### 6.1 Como Funciona

```
Z-API Webhook
    ↓
POST /api/webhooks/z-api/receive
    ↓
Sistema valida evento
    ↓
Extrai contexto da empresa (instance_id → company_id)
    ↓
Armazena mensagem no banco de dados
    ↓
Retorna confirmação para Z-API
```

### 6.2 Configurar Webhook no Z-API

**URL do Webhook:**
```
https://seu-dominio.com/api/webhooks/z-api/receive
```

**Passos:**
1. Acesse painel Z-API
2. Vá para Configurações → Webhooks
3. Cole a URL acima
4. Selecione eventos: message.received, message.sent
5. Salve e teste

### 6.3 Estrutura do Payload Recebido

**Exemplo de Mensagem Recebida:**
```json
{
  "status": "RECEIVED",
  "text": {
    "message": "Olá! Como vai?"
  },
  "type": "ReceivedCallback",
  "timestamp": 1786720920,
  "instance_id": "seu-numero-whatsapp@s.whatsapp.net"
}
```

**Mapeamento Interno:**
```
status: "RECEIVED"        → type: "receive"
text.message              → text: "Olá! Como vai?"
timestamp                 → created_at
instance_id               → Resolvido para company_id via banco
```

### 6.4 Resposta Esperada do Sistema

**Status 200 OK:**
```json
{
  "success": true,
  "message": "Webhook recebido e processado",
  "instance_id": "seu-numero@s.whatsapp.net"
}
```

---

## 7. TROUBLESHOOTING

### Problema: "Invalid email or password"

**Causa:** Credenciais incorretas ou usuário não existe

**Solução:**
```
1. Verifique o email digitado
2. Verifique a senha (case-sensitive)
3. Use as credenciais padrão para testar:
   Email: kairolopesoficial@gmail.com
   Senha: jx&CL%mFvt!x*Sm0
```

### Problema: "Token expired"

**Causa:** Access token expirou (válido por 15 minutos)

**Solução:**
```
1. Faça login novamente para obter novo token
2. Ou use o refresh_token para obter novo access_token
```

### Problema: "Permission denied"

**Causa:** Seu usuário não tem permissão para essa ação

**Solução:**
```
1. Verifique seu papel (role)
2. Apenas 'owner' pode gerenciar empresas
3. 'admin' e 'owner' podem gerenciar usuários
4. Peça permissão elevada ao admin da empresa
```

### Problema: "User not found"

**Causa:** Banco de dados não conseguiu encontrar o usuário

**Solução:**
```
1. Verifique se o banco de dados está rodando
2. Verifique conexão Supabase
3. Confirme que o usuário foi criado (passo 4.2)
```

### Problema: Webhook não funciona

**Causa:** URL incorreta, firewall bloqueando, ou instância não configurada

**Solução:**
```
1. Confirme que a URL está correta e acessível
2. Verifique se a instância_id está no banco (linked to company)
3. Teste manualmente com cURL:
   curl -X POST http://localhost:3000/api/webhooks/z-api/receive \
     -H "Content-Type: application/json" \
     -d '{"status":"RECEIVED","text":{"message":"teste"}}'
```

---

## 📋 CHECKLIST RÁPIDO

- [ ] Servidor rodando em http://localhost:3000
- [ ] Acessei /login com as credenciais padrão
- [ ] Consegui fazer login
- [ ] Vi o dashboard com token gerado
- [ ] Listei usuários via API
- [ ] Criei um novo usuário
- [ ] Alterei papel de um usuário
- [ ] Configurei webhook Z-API
- [ ] Recebi um webhook com sucesso

---

## 🆘 CONTATO & SUPORTE

**Documentação Completa:**
- [API_REFERENCE.md](./API_REFERENCE.md) - Referência técnica completa
- [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md) - Resumo da implementação
- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) - Guia de integração

**Logs de Erro:**
```bash
# Verificar logs do servidor
npm run dev

# Verificar logs do navegador (F12 → Console)
```

**Testar API Localmente:**
```bash
# Ter o servidor rodando (npm run dev)
# Abrir terminal e usar cURL para testar endpoints
curl -X GET http://localhost:3000/api/admin/users
```

---

## 🎉 Parabéns!

Você agora sabe como usar o **IAeZap** completamente! 

**Próximos Passos:**
1. Crie sua primeira empresa
2. Adicione usuários à sua empresa
3. Configure a integração Z-API
4. Comece a receber mensagens WhatsApp automaticamente

---

**Status:** ✅ Sistema Pronto para Produção
**Versão:** 1.0.0
**Última Atualização:** 2026-08-14
