# 🚀 Phase 2: Fluxo Integrado de Criação de Empresa + Usuários

## O Problema Original

Antes você tinha que fazer em 2 passos:
```
POST /api/admin/companies → Cria empresa vazia
POST /api/admin/companies/{id}/users → Adiciona usuários depois
```

## A Solução: Endpoint Integrado ✨

Agora tudo é feito em UM passo:

```
POST /api/admin/companies/with-users → Cria empresa + usuários + gera senhas
```

---

## Como Usar

### Request:

```bash
curl -X POST https://jotaonline.com.br/api/admin/companies/with-users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {SEU_TOKEN}" \
  -d '{
    "name": "Tech Solutions Brasil",
    "slug": "tech-solutions-br",
    "cnpj": "12.345.678/0001-90",
    "description": "Empresa de soluções tecnológicas",
    "plan": "professional",
    "users": [
      {
        "email": "admin@techsolutions.com.br",
        "fullName": "João Silva",
        "role": "admin"
      },
      {
        "email": "agente1@techsolutions.com.br",
        "fullName": "Maria Santos",
        "role": "member"
      },
      {
        "email": "supervisor@techsolutions.com.br",
        "fullName": "Carlos Mendes",
        "role": "viewer"
      }
    ]
  }'
```

### Response (201 Created):

```json
{
  "success": true,
  "data": {
    "company": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Tech Solutions Brasil",
      "slug": "tech-solutions-br",
      "cnpj": "12.345.678/0001-90",
      "plan": "professional",
      "status": "active",
      "owner_id": "def4f37b-a401-451f-9fe2-238747a4e670",
      "created_at": "2026-08-17T10:00:00Z",
      "updated_at": "2026-08-17T10:00:00Z"
    },
    "users": [
      {
        "id": "a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6",
        "company_id": "550e8400-e29b-41d4-a716-446655440001",
        "email": "admin@techsolutions.com.br",
        "full_name": "João Silva",
        "role": "admin",
        "status": "active",
        "created_at": "2026-08-17T10:00:00Z"
      },
      {
        "id": "b2c3d4e5-f6a7-48b9-c0d1-e2f3a4b5c6d7",
        "company_id": "550e8400-e29b-41d4-a716-446655440001",
        "email": "agente1@techsolutions.com.br",
        "full_name": "Maria Santos",
        "role": "member",
        "status": "active",
        "created_at": "2026-08-17T10:00:00Z"
      },
      {
        "id": "c3d4e5f6-a7b8-49ca-d1e2-f3a4b5c6d7e8",
        "company_id": "550e8400-e29b-41d4-a716-446655440001",
        "email": "supervisor@techsolutions.com.br",
        "full_name": "Carlos Mendes",
        "role": "viewer",
        "status": "active",
        "created_at": "2026-08-17T10:00:00Z"
      }
    ],
    "credentials": [
      {
        "email": "admin@techsolutions.com.br",
        "password": "X9$mK2@pL7!qR5vW3"
      },
      {
        "email": "agente1@techsolutions.com.br",
        "password": "Z4%nF8&tH6#jQ9sBx"
      },
      {
        "email": "supervisor@techsolutions.com.br",
        "password": "Y2*oG5!dE1@cK7uF4"
      }
    ]
  },
  "timestamp": "2026-08-17T10:00:00Z"
}
```

---

## O que Acontece Automaticamente

✅ **Validação Completa**
- Nome da empresa (2-255 caracteres)
- Slug único (a-z, 0-9, hífens)
- CNPJ válido (format: XX.XXX.XXX/XXXX-XX)
- Plano válido (starter, professional, enterprise)
- Pelo menos 1 usuário
- Emails únicos por empresa
- Roles válidas (owner, admin, member, viewer)

✅ **Criação de Empresa**
- UUID gerado automaticamente
- Criada com status "active"
- Owner setado como o usuário autenticado

✅ **Criação de Usuários**
- UUIDs gerados para cada usuário
- **Senhas aleatórias seguras** geradas (16 caracteres)
  - Mínimo 1 maiúscula
  - Mínimo 1 minúscula
  - Mínimo 1 número
  - Mínimo 1 caractere especial
- Senhas hasheadas com bcrypt (10 salt rounds)
- Status "active" por padrão

✅ **Retorno de Credenciais**
- Senhas em plaintext APENAS no response (você copia e envia)
- As senhas hasheadas são salvas no banco (não recuperáveis)
- Cada usuário recebe sua senha única

---

## Fluxo de Ativação (próximo passo: Z-API)

1. **Empresa criada** com usuários ✅
2. **Você envia as credenciais** para cada usuário por email
3. **Usuários fazem login** com email + senha gerada
4. **Z-API aparece** para cada usuário no dashboard
5. **Usuários configuram** a Z-API com seus números

---

## Tratamento de Erros

### 400 - Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "cnpj": ["Invalid CNPJ format. Expected: XX.XXX.XXX/XXXX-XX"],
      "users": ["At least one user is required"]
    }
  }
}
```

### 401 - Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authorization token"
  }
}
```

### 409 - Conflict (slug já existe)
```json
{
  "success": false,
  "error": {
    "code": "SLUG_CONFLICT",
    "message": "Company slug already exists"
  }
}
```

### 500 - Server Error
```json
{
  "success": false,
  "error": {
    "code": "COMPANY_CREATE_ERROR",
    "message": "Company created but failed to add users"
  }
}
```

---

## Exemplo de Caso de Uso Real

```bash
# 1. Empresa de RH cria 3 equipes em um request
curl -X POST https://jotaonline.com.br/api/admin/companies/with-users \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "RH Solutions",
    "slug": "rh-solutions",
    "cnpj": "88.777.666/0001-55",
    "plan": "enterprise",
    "users": [
      {"email": "gerente@rhsolutions.com", "fullName": "Gerente", "role": "admin"},
      {"email": "recruiter1@rhsolutions.com", "fullName": "Recrutador 1", "role": "member"},
      {"email": "recruiter2@rhsolutions.com", "fullName": "Recrutador 2", "role": "member"},
      {"email": "diretor@rhsolutions.com", "fullName": "Diretor", "role": "viewer"}
    ]
  }'

# 2. Resposta com senhas geradas
# {
#   "credentials": [
#     {"email": "gerente@rhsolutions.com", "password": "G7k9Q..."},
#     {"email": "recruiter1@rhsolutions.com", "password": "M3x5T..."},
#     {"email": "recruiter2@rhsolutions.com", "password": "F8j2P..."},
#     {"email": "diretor@rhsolutions.com", "password": "L4n6V..."}
#   ]
# }

# 3. Você copia as credenciais e envia por email para cada pessoa
# 4. Eles fazem login
# 5. Z-API aparece para cada um
# 6. Eles configuram seus números WhatsApp
```

---

## Próximos Passos

### ✅ Implementado
- [x] Endpoint integrado `/api/admin/companies/with-users`
- [x] Validação completa com Zod
- [x] Geração de senhas aleatórias seguras
- [x] Hash bcrypt (10 rounds)
- [x] Transação atômica (tudo ou nada)
- [x] Retorno de credenciais

### ⏳ Próximo: Z-API Setup
- [ ] UI para gerenciar Z-API por empresa
- [ ] Integração com webhook Z-API
- [ ] Número instantiation flow
- [ ] QR Code para conectar

---

## Código-Fonte

📁 **Novo Endpoint:** `src/app/api/admin/companies/with-users/route.ts`
📁 **Função DB:** `src/lib/admin/database.ts` → `companyOperations.createWithUsers()`
📁 **Tipos:** `src/types/admin.ts` → `CreateCompanyWithUsersRequest`

---

## Deploy

```bash
# Commit
git commit -m "feat: integrated company creation with users endpoint"

# Push
git push origin main

# No VPS:
cd /root/iaezap6
git pull
npm run build
pm2 restart all
```

---

**Status:** ✅ Pronto para usar no domínio após deployment
