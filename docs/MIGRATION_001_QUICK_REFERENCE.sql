-- ============================================================================
-- QUICK REFERENCE: Essential SQL Statements from Migration 001
-- ============================================================================
-- Use this file for quick copy-paste execution of key statements
-- See MIGRATION_001_README.md for full documentation
-- ============================================================================

-- ============================================================================
-- ENUM: user_role
-- ============================================================================
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'viewer');


-- ============================================================================
-- TABLE: companies
-- ============================================================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  plan VARCHAR(50) NOT NULL DEFAULT 'starter'
    CHECK (plan IN ('starter', 'professional', 'enterprise')),
  status VARCHAR(50) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'suspended', 'cancelled')),
  owner_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Companies Indexes
CREATE INDEX idx_companies_slug ON companies(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_owner_id ON companies(owner_id);
CREATE INDEX idx_companies_status ON companies(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_plan ON companies(plan);
CREATE INDEX idx_companies_created_at ON companies(created_at DESC);
CREATE INDEX idx_companies_status_plan ON companies(status, plan) WHERE deleted_at IS NULL;


-- ============================================================================
-- TABLE: users
-- ============================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  display_name VARCHAR(100),
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'member',
  auth_id UUID UNIQUE,
  password_hash VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'invited', 'suspended')),
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP WITH TIME ZONE,
  last_login_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  preferences JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT users_email_company_unique
    UNIQUE (company_id, email) DEFERRABLE INITIALLY DEFERRED
);

-- Users Indexes
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_company_email ON users(company_id, email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_company_id ON users(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_auth_id ON users(auth_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_company_role ON users(company_id, role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_last_activity_at ON users(last_activity_at DESC) WHERE deleted_at IS NULL;


-- ============================================================================
-- TABLE: company_members (Optional)
-- ============================================================================
CREATE TABLE company_members (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  invite_accepted_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (user_id, company_id)
);

-- Company Members Indexes
CREATE INDEX idx_company_members_user_id ON company_members(user_id);
CREATE INDEX idx_company_members_company_id ON company_members(company_id);
CREATE INDEX idx_company_members_role ON company_members(role);
CREATE INDEX idx_company_members_invited_by ON company_members(invited_by);
CREATE INDEX idx_company_members_joined_at ON company_members(joined_at DESC);


-- ============================================================================
-- TABLE: audit_logs
-- ============================================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs Indexes
CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);


-- ============================================================================
-- FUNCTION: update_updated_at_column()
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER companies_update_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER users_update_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- FUNCTION: get_user_companies(user_id)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_companies(p_user_id UUID)
RETURNS TABLE(
  company_id UUID,
  company_name VARCHAR,
  company_slug VARCHAR,
  role user_role,
  plan VARCHAR,
  status VARCHAR,
  joined_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.slug,
    u.role,
    c.plan,
    c.status,
    u.created_at
  FROM companies c
  INNER JOIN users u ON u.company_id = c.id
  WHERE u.id = p_user_id
    AND u.deleted_at IS NULL
    AND c.deleted_at IS NULL
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: user_has_company_role()
-- ============================================================================
CREATE OR REPLACE FUNCTION user_has_company_role(
  p_user_id UUID,
  p_company_id UUID,
  p_required_role user_role
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_role user_role;
BEGIN
  SELECT role INTO v_user_role
  FROM users
  WHERE id = p_user_id
    AND company_id = p_company_id
    AND deleted_at IS NULL;

  IF v_user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  CASE v_user_role
    WHEN 'owner' THEN RETURN TRUE;
    WHEN 'admin' THEN
      RETURN p_required_role IN ('admin', 'member', 'viewer');
    WHEN 'member' THEN
      RETURN p_required_role IN ('member', 'viewer');
    WHEN 'viewer' THEN
      RETURN p_required_role = 'viewer';
    ELSE RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: get_company_users()
-- ============================================================================
CREATE OR REPLACE FUNCTION get_company_users(p_company_id UUID)
RETURNS TABLE(
  user_id UUID,
  email VARCHAR,
  full_name VARCHAR,
  role user_role,
  status VARCHAR,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email,
    u.full_name,
    u.role,
    u.status,
    u.last_login_at,
    u.created_at
  FROM users u
  WHERE u.company_id = p_company_id
    AND u.deleted_at IS NULL
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: create_audit_log()
-- ============================================================================
CREATE OR REPLACE FUNCTION create_audit_log(
  p_company_id UUID,
  p_user_id UUID,
  p_action VARCHAR,
  p_entity_type VARCHAR,
  p_entity_id UUID,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_ip_address VARCHAR DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO audit_logs (
    company_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    ip_address,
    user_agent
  ) VALUES (
    p_company_id,
    p_user_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_values,
    p_new_values,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify enum type
SELECT * FROM pg_type WHERE typname = 'user_role';

-- Verify tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('companies', 'users', 'company_members', 'audit_logs')
ORDER BY table_name;

-- Verify indexes
SELECT tablename, indexname FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('companies', 'users', 'company_members', 'audit_logs')
ORDER BY tablename, indexname;

-- Verify functions
SELECT proname, oid FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND (proname LIKE 'get_%' OR proname LIKE 'user_%' OR proname LIKE 'create_%' OR proname LIKE 'update_%')
ORDER BY proname;

-- Verify triggers
SELECT trigger_name, event_object_table FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND event_object_table IN ('companies', 'users')
ORDER BY event_object_table, trigger_name;


-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get all companies
SELECT id, name, slug, plan, status, created_at
FROM companies
WHERE deleted_at IS NULL
ORDER BY created_at DESC;

-- Get all users in a company
SELECT * FROM get_company_users('550e8400-e29b-41d4-a716-446655440000'::UUID);

-- Get all companies for a user
SELECT * FROM get_user_companies('550e8400-e29b-41d4-a716-446655440111'::UUID);

-- Check user role
SELECT user_has_company_role(
  '550e8400-e29b-41d4-a716-446655440111'::UUID,
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'admin'::user_role
);

-- Get recent audit logs for a company
SELECT
  created_at,
  action,
  entity_type,
  (SELECT full_name FROM users WHERE id = audit_logs.user_id) as performed_by,
  ip_address
FROM audit_logs
WHERE company_id = '550e8400-e29b-41d4-a716-446655440000'::UUID
ORDER BY created_at DESC
LIMIT 50;
