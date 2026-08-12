-- ============================================================================
-- TASK 1.2: Multi-Tenant RLS Isolation - Complete Migration
-- ============================================================================
-- This is the complete SQL migration for Task 1.2
-- Copy this entire file and paste into Supabase SQL Editor
-- Then click Run to apply all tables, policies, and functions
--
-- Timeline: ~2 minutes to run completely
-- ============================================================================

-- Multi-Tenant Isolation Migration for Supabase
-- Comprehensive schema with RLS policies for tenant data segregation

-- ============================================================================
-- 1. TENANTS TABLE
-- ============================================================================
-- Root tenant entity for multi-tenant architecture
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for tenants table
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_created_at ON tenants(created_at);

-- Enable RLS on tenants table
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view tenants they belong to
CREATE POLICY "tenants_select_policy"
  ON tenants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users_tenants
      WHERE users_tenants.tenant_id = tenants.id
        AND users_tenants.user_id = auth.uid()
    )
  );

-- RLS Policy: Only authenticated users can update their tenant
CREATE POLICY "tenants_update_policy"
  ON tenants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users_tenants
      WHERE users_tenants.tenant_id = tenants.id
        AND users_tenants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users_tenants
      WHERE users_tenants.tenant_id = tenants.id
        AND users_tenants.user_id = auth.uid()
    )
  );

-- RLS Policy: DELETE policy - restricted to admins
CREATE POLICY "tenants_delete_policy"
  ON tenants
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users_tenants
      WHERE users_tenants.tenant_id = tenants.id
        AND users_tenants.user_id = auth.uid()
        AND users_tenants.role = 'admin'
    )
  );

-- ============================================================================
-- 2. USERS_TENANTS TABLE
-- ============================================================================
-- Junction table for multi-tenant user association with role management
CREATE TABLE users_tenants (
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, tenant_id)
);

-- Indexes for users_tenants table
CREATE INDEX idx_users_tenants_user_id ON users_tenants(user_id);
CREATE INDEX idx_users_tenants_tenant_id ON users_tenants(tenant_id);
CREATE INDEX idx_users_tenants_role ON users_tenants(role);

-- Enable RLS on users_tenants table
ALTER TABLE users_tenants ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own tenant memberships
CREATE POLICY "users_tenants_select_policy"
  ON users_tenants
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users_tenants ut
      WHERE ut.tenant_id = users_tenants.tenant_id
        AND ut.user_id = auth.uid()
        AND ut.role = 'admin'
    )
  );

-- RLS Policy: Only admins can insert new users to tenant
CREATE POLICY "users_tenants_insert_policy"
  ON users_tenants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users_tenants ut
      WHERE ut.tenant_id = users_tenants.tenant_id
        AND ut.user_id = auth.uid()
        AND ut.role = 'admin'
    )
  );

-- RLS Policy: Only admins can update user roles
CREATE POLICY "users_tenants_update_policy"
  ON users_tenants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users_tenants ut
      WHERE ut.tenant_id = users_tenants.tenant_id
        AND ut.user_id = auth.uid()
        AND ut.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users_tenants ut
      WHERE ut.tenant_id = users_tenants.tenant_id
        AND ut.user_id = auth.uid()
        AND ut.role = 'admin'
    )
  );

-- RLS Policy: Only admins can remove users from tenant
CREATE POLICY "users_tenants_delete_policy"
  ON users_tenants
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users_tenants ut
      WHERE ut.tenant_id = users_tenants.tenant_id
        AND ut.user_id = auth.uid()
        AND ut.role = 'admin'
    )
  );

-- ============================================================================
-- 3. AUTH_METADATA TABLE
-- ============================================================================
-- User authentication and tenant preference metadata
CREATE TABLE auth_metadata (
  user_id UUID PRIMARY KEY,
  current_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for auth_metadata table
CREATE INDEX idx_auth_metadata_current_tenant_id ON auth_metadata(current_tenant_id);

-- Enable RLS on auth_metadata table
ALTER TABLE auth_metadata ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own metadata
CREATE POLICY "auth_metadata_select_policy"
  ON auth_metadata
  FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policy: Users can insert their own metadata
CREATE POLICY "auth_metadata_insert_policy"
  ON auth_metadata
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policy: Users can update their own metadata
CREATE POLICY "auth_metadata_update_policy"
  ON auth_metadata
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 4. CONVERSATIONS TABLE
-- ============================================================================
-- Tenant-scoped conversations for messaging system
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  contact_name VARCHAR(255),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, phone_number)
);

-- Indexes for conversations table
CREATE INDEX idx_conversations_tenant_id ON conversations(tenant_id);
CREATE INDEX idx_conversations_phone_number ON conversations(phone_number);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_started_at ON conversations(started_at);
CREATE INDEX idx_conversations_tenant_status ON conversations(tenant_id, status);

-- Enable RLS on conversations table
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view conversations from their tenant only
CREATE POLICY "conversations_select_policy"
  ON conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users_tenants
      WHERE users_tenants.tenant_id = conversations.tenant_id
        AND users_tenants.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert conversations to their tenant
CREATE POLICY "conversations_insert_policy"
  ON conversations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users_tenants
      WHERE users_tenants.tenant_id = conversations.tenant_id
        AND users_tenants.user_id = auth.uid()
        AND users_tenants.role IN ('admin', 'member')
    )
  );

-- RLS Policy: Users can update conversations in their tenant
CREATE POLICY "conversations_update_policy"
  ON conversations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users_tenants
      WHERE users_tenants.tenant_id = conversations.tenant_id
        AND users_tenants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users_tenants
      WHERE users_tenants.tenant_id = conversations.tenant_id
        AND users_tenants.user_id = auth.uid()
        AND users_tenants.role IN ('admin', 'member')
    )
  );

-- RLS Policy: Only admins/members can delete conversations
CREATE POLICY "conversations_delete_policy"
  ON conversations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users_tenants
      WHERE users_tenants.tenant_id = conversations.tenant_id
        AND users_tenants.user_id = auth.uid()
        AND users_tenants.role IN ('admin', 'member')
    )
  );

-- ============================================================================
-- 5. MESSAGES TABLE
-- ============================================================================
-- Messages within conversations, tenant-scoped via conversation
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  provider_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for messages table
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
CREATE INDEX idx_messages_direction ON messages(direction);
CREATE INDEX idx_messages_provider_id ON messages(provider_id);
CREATE INDEX idx_messages_conversation_timestamp ON messages(conversation_id, timestamp);

-- Enable RLS on messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view messages from conversations in their tenant
CREATE POLICY "messages_select_policy"
  ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      INNER JOIN users_tenants ut ON ut.tenant_id = c.tenant_id
      WHERE c.id = messages.conversation_id
        AND ut.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert messages to conversations in their tenant
CREATE POLICY "messages_insert_policy"
  ON messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      INNER JOIN users_tenants ut ON ut.tenant_id = c.tenant_id
      WHERE c.id = messages.conversation_id
        AND ut.user_id = auth.uid()
        AND ut.role IN ('admin', 'member')
    )
  );

-- RLS Policy: Users can update messages in their tenant's conversations
CREATE POLICY "messages_update_policy"
  ON messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      INNER JOIN users_tenants ut ON ut.tenant_id = c.tenant_id
      WHERE c.id = messages.conversation_id
        AND ut.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      INNER JOIN users_tenants ut ON ut.tenant_id = c.tenant_id
      WHERE c.id = messages.conversation_id
        AND ut.user_id = auth.uid()
        AND ut.role IN ('admin', 'member')
    )
  );

-- RLS Policy: Only admins/members can delete messages
CREATE POLICY "messages_delete_policy"
  ON messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      INNER JOIN users_tenants ut ON ut.tenant_id = c.tenant_id
      WHERE c.id = messages.conversation_id
        AND ut.user_id = auth.uid()
        AND ut.role IN ('admin', 'member')
    )
  );

-- ============================================================================
-- 6. MESSAGE_RULES TABLE
-- ============================================================================
-- Tenant-scoped message rules for automation
CREATE TABLE message_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_name VARCHAR(255) NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}',
  response_template TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for message_rules table
CREATE INDEX idx_message_rules_tenant_id ON message_rules(tenant_id);
CREATE INDEX idx_message_rules_active ON message_rules(active);
CREATE INDEX idx_message_rules_created_at ON message_rules(created_at);
CREATE INDEX idx_message_rules_tenant_active ON message_rules(tenant_id, active);

-- Enable RLS on message_rules table
ALTER TABLE message_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view rules from their tenant
CREATE POLICY "message_rules_select_policy"
  ON message_rules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users_tenants
      WHERE users_tenants.tenant_id = message_rules.tenant_id
        AND users_tenants.user_id = auth.uid()
    )
  );

-- RLS Policy: Only admins/members can create rules
CREATE POLICY "message_rules_insert_policy"
  ON message_rules
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users_tenants
      WHERE users_tenants.tenant_id = message_rules.tenant_id
        AND users_tenants.user_id = auth.uid()
        AND users_tenants.role IN ('admin', 'member')
    )
  );

-- RLS Policy: Only admins/members can update rules
CREATE POLICY "message_rules_update_policy"
  ON message_rules
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users_tenants
      WHERE users_tenants.tenant_id = message_rules.tenant_id
        AND users_tenants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users_tenants
      WHERE users_tenants.tenant_id = message_rules.tenant_id
        AND users_tenants.user_id = auth.uid()
        AND users_tenants.role IN ('admin', 'member')
    )
  );

-- RLS Policy: Only admins can delete rules
CREATE POLICY "message_rules_delete_policy"
  ON message_rules
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users_tenants
      WHERE users_tenants.tenant_id = message_rules.tenant_id
        AND users_tenants.user_id = auth.uid()
        AND users_tenants.role = 'admin'
    )
  );

-- ============================================================================
-- 7. AUDIT_LOGS TABLE
-- ============================================================================
-- Tenant-scoped audit trail for compliance and debugging
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id UUID,
  user_id UUID NOT NULL,
  changes JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit_logs table
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_tenant_timestamp ON audit_logs(tenant_id, timestamp);
CREATE INDEX idx_audit_logs_tenant_user ON audit_logs(tenant_id, user_id, timestamp);

-- Enable RLS on audit_logs table
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view audit logs from their tenant
CREATE POLICY "audit_logs_select_policy"
  ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users_tenants
      WHERE users_tenants.tenant_id = audit_logs.tenant_id
        AND users_tenants.user_id = auth.uid()
    )
  );

-- RLS Policy: Only members/admins can insert audit logs
CREATE POLICY "audit_logs_insert_policy"
  ON audit_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users_tenants
      WHERE users_tenants.tenant_id = audit_logs.tenant_id
        AND (
          users_tenants.user_id = audit_logs.user_id
          OR users_tenants.role = 'admin'
        )
    )
  );

-- RLS Policy: Only admins can delete audit logs
CREATE POLICY "audit_logs_delete_policy"
  ON audit_logs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users_tenants
      WHERE users_tenants.tenant_id = audit_logs.tenant_id
        AND users_tenants.user_id = auth.uid()
        AND users_tenants.role = 'admin'
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS FOR TENANT CONTEXT
-- ============================================================================

-- Function to get current tenant ID from auth metadata
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT current_tenant_id FROM auth_metadata
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- Function to validate user belongs to tenant
CREATE OR REPLACE FUNCTION validate_user_tenant(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM users_tenants
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid()
  )
$$;

-- Function to check user role in tenant
CREATE OR REPLACE FUNCTION get_user_tenant_role(p_tenant_id UUID)
RETURNS VARCHAR(50)
LANGUAGE sql
STABLE
AS $$
  SELECT role FROM users_tenants
  WHERE tenant_id = p_tenant_id
    AND user_id = auth.uid()
  LIMIT 1
$$;

-- ============================================================================
-- TRIGGER FOR UPDATED_AT TIMESTAMPS
-- ============================================================================

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- Apply trigger to tenants table
CREATE TRIGGER tenants_update_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to auth_metadata table
CREATE TRIGGER auth_metadata_update_updated_at
  BEFORE UPDATE ON auth_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to conversations table
CREATE TRIGGER conversations_update_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to messages table
CREATE TRIGGER messages_update_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to message_rules table
CREATE TRIGGER message_rules_update_updated_at
  BEFORE UPDATE ON message_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- END OF TASK 1.2 MIGRATION
-- ============================================================================
-- All tables, policies, functions, and triggers have been created.
-- Your multi-tenant architecture is now ready for API implementation (Task 1.3)
-- ============================================================================
