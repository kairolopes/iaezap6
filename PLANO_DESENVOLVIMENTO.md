# 📋 Plano de Desenvolvimento - IAeZap CRM

**Objetivo:** Transformar IAeZap em um SaaS pronto para clientes com modelo self-service

**Modelo de Negócio:** Você cadastra empresa + cria usuários. Clientes fazem o resto.

---

## 🎯 MVP (Mínimo Viável) - 4-6 semanas

### Funcionalidades críticas para launch:
1. ✅ Autenticação & Multi-tenant (já existe)
2. ✅ Gerenciamento de usuários (em progresso)
3. 🔄 Conversas/Chat (clientes ↔ empresa)
4. 🔄 CRM básico (clientes/contatos)
5. 🔄 Integração WhatsApp (conectar conta)
6. 🔄 Catálogo (manual + Z-API)
7. 🔄 Automações simples (regras básicas)

**Foco:** Fluxo core: Cliente envia mensagem → Sistema responde automaticamente (ou passa para atendente)

---

## 📅 FASE 1: Conversas & CRM (Semanas 1-2)

### 1.1 Modelo de Conversas
**Objetivo:** Permitir que clientes (via WhatsApp) conversem com a empresa

**O que implementar:**
- [ ] **Tabela `conversations`**
  - id, company_id, contact_id, status, created_at, updated_at
  - Status: "open", "pending", "resolved", "archived"
  
- [ ] **Tabela `messages`**
  - id, conversation_id, sender_type ("contact" ou "agent"), sender_id, content, media_url, created_at
  
- [ ] **Página `/dashboard/conversations`**
  - Lista de conversas
  - Filtrar por status
  - Ver última mensagem
  - Badge com mensagens não lidas

- [ ] **Página `/dashboard/conversations/[id]`**
  - Chat em tempo real
  - Input para responder
  - Histórico de mensagens
  - Botão para resolver/arquivar

**API Routes:**
- `GET /api/conversations` - Listar conversas da empresa
- `GET /api/conversations/[id]` - Conversa específica + mensagens
- `POST /api/conversations/[id]/messages` - Enviar mensagem
- `PATCH /api/conversations/[id]` - Mudar status

**Estimativa:** 1 semana

---

### 1.2 CRM - Contatos/Clientes
**Objetivo:** Gerenciar quem são os clientes

**O que implementar:**
- [ ] **Tabela `contacts`**
  - id, company_id, name, email, phone, whatsapp_number, status, created_at, updated_at
  - Relacionamento com `conversations`

- [ ] **Página `/dashboard/crm`**
  - Lista de contatos
  - Busca por nome/telefone
  - Criar novo contato
  - Editar contato

- [ ] **Página `/dashboard/crm/[id]`**
  - Perfil do cliente
  - Histórico de conversas
  - Tags/anotações
  - Botão para iniciar conversa

**API Routes:**
- `GET /api/crm/contacts` - Listar contatos
- `POST /api/crm/contacts` - Criar contato
- `GET /api/crm/contacts/[id]` - Detalhes
- `PATCH /api/crm/contacts/[id]` - Editar
- `DELETE /api/crm/contacts/[id]` - Deletar

**Estimativa:** 1 semana

---

## 📅 FASE 2: Integração WhatsApp (Semana 3)

### 2.1 Conectar Z-API
**Objetivo:** Sincronizar WhatsApp da empresa com IAeZap

**O que implementar:**
- [ ] **Tabela `whatsapp_integrations`**
  - id, company_id, instance_id, api_token, phone_number, status, connected_at
  
- [ ] **Página `/dashboard/settings/whatsapp`**
  - Botão "Conectar WhatsApp"
  - Exibir número conectado
  - Desconectar

- [ ] **Webhook receiver `/api/webhooks/whatsapp/receive`**
  - Recebe mensagens de clientes via Z-API
  - Cria nova conversa ou adiciona à existente
  - Marca como "nova mensagem"

- [ ] **Sincronização automática**
  - Respostas da empresa são enviadas via Z-API

**Estimativa:** 1 semana

---

## 📅 FASE 3: Catálogo (Semana 4)

### 3.1 Catálogo Manual + Z-API
**Objetivo:** Cliente pode adicionar produtos de 3 formas

**O que implementar:**
- [ ] **Tabela `catalog_products`**
  - id, company_id, name, description, price, image_url, created_at

- [ ] **Página `/dashboard/settings/catalog`**
  - Listar produtos
  - Botão "Adicionar Produto"
  - 3 opções:
    1. Digitar manualmente
    2. Upload XLS/CSV
    3. Sincronizar do WhatsApp

- [ ] **Import XLS/CSV**
  - Parse de arquivo
  - Validação de colunas (Nome, Preço, Descrição)
  - Importação em lote

- [ ] **Sincronização Z-API**
  - Se tem catálogo no WhatsApp, puxa automaticamente
  - Atualizações periódicas

**API Routes:**
- `GET /api/catalog/products` - Listar produtos
- `POST /api/catalog/products` - Criar produto
- `POST /api/catalog/import` - Upload de arquivo
- `POST /api/catalog/sync-whatsapp` - Sincronizar Z-API

**Estimativa:** 1 semana

---

## 📅 FASE 4: Automações (Semana 5)

### 4.1 Regras Simples
**Objetivo:** Respostas automáticas baseadas em palavras-chave

**O que implementar:**
- [ ] **Tabela `automation_rules`**
  - id, company_id, name, trigger_type, trigger_value, response, active
  - trigger_type: "keyword", "time_based", "default"

- [ ] **Página `/dashboard/automations`**
  - Listar regras
  - Criar nova regra
  - Editor visual de regras

- [ ] **Exemplos de regras:**
  - "Se mensagem contém 'preço', responder com lista de produtos"
  - "Se mensagem contém 'oi', responder com menu"
  - "Se horário fora de expediente, responder com 'Retornaremos amanhã'"
  - "Padrão: repassar para atendente humano"

- [ ] **Engine de processamento**
  - Ao receber mensagem, verificar regras em ordem
  - Se match, enviar resposta automática
  - Se não match, notificar atendente

**Estimativa:** 1 semana

---

## 📅 FASE 5: Melhorias & IA (Semana 6+)

### 5.1 Base de Conhecimento
- [ ] Upload de documentos (PDF, TXT)
- [ ] Indexação e busca
- [ ] Referência em automações

### 5.2 IA Inteligente (Integração Claude/OpenAI)
- [ ] Treinar IA com base de conhecimento
- [ ] Respostas naturais (não só keywords)
- [ ] Confiança de resposta (human handoff se baixa)

### 5.3 Kanban
- [ ] Drag-drop de conversas entre estágios
- [ ] Assignee (qual atendente está cuidando)

### 5.4 Relatórios
- [ ] Tempo médio de resposta
- [ ] Taxa de resolução
- [ ] Horários com mais picos
- [ ] Desempenho por atendente

---

## 🏗️ Arquitetura de Banco de Dados (Resumo)

```sql
-- Já existe:
companies
users
roles

-- Precisa implementar:
conversations (id, company_id, contact_id, status)
messages (id, conversation_id, sender_type, content)
contacts (id, company_id, name, phone, whatsapp_number)
whatsapp_integrations (id, company_id, instance_id, token)
catalog_products (id, company_id, name, price, image_url)
automation_rules (id, company_id, trigger_type, trigger_value, response)
```

---

## 🎯 Prioridades por Impacto

| # | Feature | Impacto | Dificuldade | Timeline |
|---|---------|---------|-------------|----------|
| 1 | Conversas + CRM | 🔴 CRÍTICO | Média | 2 semanas |
| 2 | WhatsApp Integration | 🔴 CRÍTICO | Média | 1 semana |
| 3 | Catálogo | 🟠 ALTO | Baixa | 1 semana |
| 4 | Automações Simples | 🟠 ALTO | Média | 1 semana |
| 5 | IA Inteligente | 🟡 MÉDIO | Alta | 2+ semanas |
| 6 | Kanban | 🟡 MÉDIO | Média | 1 semana |
| 7 | Relatórios | 🟡 MÉDIO | Baixa | 1 semana |

---

## 💰 Modelo de Go-to-Market

### **Fase 1 (Após MVP):**
- Ofereça para 2-3 clientes beta
- Peça feedback
- Ajuste baseado em uso real

### **Fase 2 (Após Fase 4):**
- Comece a cobrar
- 3 planos:
  - **Starter:** R$ 99/mês (até 5 conversas/dia)
  - **Pro:** R$ 299/mês (até 100 conversas/dia + automações)
  - **Enterprise:** Customizado (volume alto + IA dedicada)

---

## 📊 Estimativa Total

| Fase | Estimativa | Status |
|------|-----------|--------|
| MVP (Fases 1-4) | 4-6 semanas | 📋 Planejado |
| Melhorias (Fase 5) | 2-3 semanas | 📋 Planejado |
| **TOTAL** | **6-9 semanas** | ⏳ |

**Data esperada para launch:** ~2 meses

---

## 🚀 Próximos Passos

1. **Você aprova este plano?**
2. **Quer que eu comece pela Fase 1 (Conversas + CRM)?**
3. **Precisa de ajustes nas prioridades?**

---

**Criado:** 2026-08-16  
**Status:** 📋 Awaiting Approval
