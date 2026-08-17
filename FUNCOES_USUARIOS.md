# 👥 Guia de Funções de Usuários no IAeZap

## Hierarquia de Permissões (do maior para menor)

### 👑 **OWNER** (Proprietário)
- **Acesso:** Completo ao sistema
- **Pode fazer:**
  - Gerenciar todos os usuários (criar, editar, deletar)
  - Mudar funções de outros usuários
  - Acessar todas as configurações
  - Gerenciar integrações (Z-API)
  - Visualizar e editar todas as conversas
- **Quem tem:** Apenas o proprietário da empresa

---

### 🔑 **ADMIN** (Administrador)
- **Acesso:** Quase total (sem deletar usuários/empresa)
- **Pode fazer:**
  - Gerenciar usuários (criar, editar, mas NÃO deletar)
  - Visualizar relatórios completos
  - Configurar automações
  - Gerenciar contatos
  - Editar configurações básicas
- **Quem tem:** Pessoas de confiança da empresa

---

### 👤 **MEMBER** (Membro)
- **Acesso:** Operacional
- **Pode fazer:**
  - Enviar e receber mensagens
  - Ver contatos atribuídos
  - Criar tickets/conversas
  - Ver seus próprios relatórios
  - **NÃO pode:** Gerenciar usuários, deletar dados
- **Quem tem:** Agentes, operadores, suporte

---

### 👁️ **VIEWER** (Visualizador)
- **Acesso:** Apenas leitura
- **Pode fazer:**
  - Visualizar conversas (somente leitura)
  - Ver relatórios
  - **NÃO pode:** Enviar mensagens, criar dados, gerenciar
- **Quem tem:** Supervisores, auditores

---

## ✅ Como Atribuir Funções

1. Vá para **Gerenciamento de Usuários**
2. Clique em **"Add New User"**
3. Preencha:
   - **Email:** do novo usuário
   - **Full name:** nome completo
   - **Role:** escolha a função desejada
4. Clique em **"Add User"**

---

## 🔒 Regras Importantes

- **OWNER não pode ser removido** (sempre precisa haver um)
- **Você não pode remover a si mesmo**
- **Mudanças de permissão entram em efeito imediatamente**

---

**Dúvidas?** Entre em contato com o proprietário da empresa.
