-- ============================================================================
-- IAeZap Multi-Tenant System - Complete Migration Bundle
-- Version: 1.0
-- Date: 2026-08-13
-- ============================================================================
-- This is the complete, combined migration for the IAeZap multi-tenant system
-- It includes:
--   1. Company, User, and Role management tables
--   2. CNPJ field for Brazilian business support
--   3. RLS policies for security
--   4. Z-API integration
--   5. Master user creation
-- ============================================================================

-- ============================================================================
-- MIGRATION 001: Create Companies, Users, and User Roles Tables
-- ============================================================================

-- CREATE ENUM TYPE user_role
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'owner',      -- Full access, can manage company and all users
    'admin',      -- Administrative access, can manage most settings and users
    'member',     -- Regular member with standard permissions
    'viewer'      -- Read-only access to company data
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CREATE companies TABLE
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic company information
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,

  -- Plan and status tracking
  plan VARCHAR(50) NOT NULL DEFAULT 'starter'
    CHECK (plan IN ('starter', 'professional', 'enterprise')),
  status VARCHAR(50) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'suspended', 'cancelled')),

  -- Ownership
  owner_id UUID NOT NULL,

  -- Settings and metadata
  metadata JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',

  -- Audit timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- CREATE INDEXES FOR companies TABLE
CREATE INDEX IF NOT EXISTS idx_companies_slug
  ON companies(slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_companies_owner_id
  ON companies(owner_id);

CREATE INDEX IF NOT EXISTS idx_companies_status
  ON companies(status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_companies_plan
  ON companies(plan);

CREATE INDEX IF NOT EXISTS idx_companies_created_at
  ON companies(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_companies_status_plan
  ON companies(status, plan)
  WHERE deleted_at IS NULL;

-- CREATE users TABLE
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Company association (tenant)
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- User information
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  display_name VARCHAR(100),
  avatar_url TEXT,

  -- Role and permissions
  role user_role NOT NULL DEFAULT 'member',

  -- Authentication
  auth_id UUID UNIQUE,  -- Reference to auth service
  password_hash VARCHAR(255),  -- Optional if using external auth

  -- Status and verification
  status VARCHAR(50) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'invited', 'suspended')),
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP WITH TIME ZONE,

  -- Last activity tracking
  last_login_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,

  -- Settings and metadata
  preferences JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',

  -- Audit timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT users_email_company_unique
    UNIQUE (company_id, email)
    DEFERRABLE INITIALLY DEFERRED
);

-- CREATE INDEXES FOR users TABLE
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_company_email
  ON users(company_id, email)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_company_id
  ON users(company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_auth_id
  ON users(auth_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_company_role
  ON users(company_id, role)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_status
  ON users(status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_last_activity_at
  ON users(last_activity_at DESC)
  WHERE deleted_at IS NULL;

-- CREATE company_members TABLE
CREATE TABLE IF NOT EXISTS company_members (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  invite_accepted_at TIMESTAMP WITH TIME ZONE,

  PRIMARY KEY (user_id, company_id)
);

-- CREATE INDEXES FOR company_members TABLE
CREATE INDEX IF NOT EXISTS idx_company_members_user_id
  ON company_members(user_id);

CREATE INDEX IF NOT EXISTS idx_company_members_company_id
  ON company_members(company_id);

CREATE INDEX IF NOT EXISTS idx_company_members_role
  ON company_members(role);

CREATE INDEX IF NOT EXISTS idx_company_members_invited_by
  ON company_members(invited_by);

CREATE INDEX IF NOT EXISTS idx_company_members_joined_at
  ON company_members(joined_at DESC);

-- CREATE audit_logs TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Action details
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,

  -- Change tracking
  old_values JSONB,
  new_values JSONB,
  changes JSONB,

  -- Context
  ip_address VARCHAR(45),
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CREATE INDEXES FOR audit_logs TABLE
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id
  ON audit_logs(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
  ON audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs(created_at DESC);

-- CREATE HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- CREATE TRIGGERS
DROP TRIGGER IF EXISTS companies_update_updated_at ON companies;
CREATE TRIGGER companies_update_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS users_update_updated_at ON users;
CREATE TRIGGER users_update_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- CREATE UTILITY FUNCTIONS
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

  -- Role hierarchy: owner > admin > member > viewer
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
-- MIGRATION 002: Add CNPJ field to Companies table
-- ============================================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS cnpj VARCHAR(18) UNIQUE DEFAULT '';

-- CREATE INDEXES FOR CNPJ
CREATE INDEX IF NOT EXISTS idx_companies_cnpj
  ON companies(cnpj)
  WHERE deleted_at IS NULL AND cnpj != '';

CREATE INDEX IF NOT EXISTS idx_companies_owner_id_active
  ON companies(owner_id)
  WHERE deleted_at IS NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_companies_status_created_at
  ON companies(status, created_at DESC)
  WHERE deleted_at IS NULL;

-- CREATE CNPJ VALIDATION FUNCTION
CREATE OR REPLACE FUNCTION validate_cnpj()
RETURNS TRIGGER AS $$
BEGIN
  -- CNPJ format: XX.XXX.XXX/XXXX-XX or allow empty
  IF NEW.cnpj IS NOT NULL AND NEW.cnpj != '' AND NEW.cnpj !~ '^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Invalid CNPJ format. Expected: XX.XXX.XXX/XXXX-XX';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- CREATE CNPJ VALIDATION TRIGGER
DROP TRIGGER IF EXISTS companies_validate_cnpj ON companies;
CREATE TRIGGER companies_validate_cnpj
  BEFORE INSERT OR UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION validate_cnpj();

-- ============================================================================
-- MIGRATION 003: Complete Multi-Tenant System with RLS and API Integration
-- ============================================================================

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE IF EXISTS companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES FOR COMPANIES
DROP POLICY IF EXISTS "users_can_view_own_companies" ON companies;
CREATE POLICY "users_can_view_own_companies" ON companies
  FOR SELECT USING (
    id IN (
      SELECT company_id FROM users
      WHERE users.deleted_at IS NULL
      AND (
        (auth.uid()::TEXT = users.auth_id::TEXT) OR
        (auth.jwt() ->> 'user_id' = users.id::TEXT)
      )
    )
    OR owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "owners_can_update_companies" ON companies;
CREATE POLICY "owners_can_update_companies" ON companies
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "admin_can_insert_companies" ON companies;
CREATE POLICY "admin_can_insert_companies" ON companies
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.company_id = companies.id
      AND users.role = 'owner'
      AND users.deleted_at IS NULL
    )
  );

-- RLS POLICIES FOR USERS
DROP POLICY IF EXISTS "users_can_view_company_members" ON users;
CREATE POLICY "users_can_view_company_members" ON users
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM users AS u
      WHERE u.deleted_at IS NULL
      AND (
        (auth.uid()::TEXT = u.auth_id::TEXT) OR
        (auth.jwt() ->> 'user_id' = u.id::TEXT)
      )
    )
  );

DROP POLICY IF EXISTS "admins_can_update_users" ON users;
CREATE POLICY "admins_can_update_users" ON users
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM users AS requester
      WHERE requester.deleted_at IS NULL
      AND requester.role IN ('owner', 'admin')
      AND (
        (auth.uid()::TEXT = requester.auth_id::TEXT) OR
        (auth.jwt() ->> 'user_id' = requester.id::TEXT)
      )
    )
  );

DROP POLICY IF EXISTS "users_can_update_own_profile" ON users;
CREATE POLICY "users_can_update_own_profile" ON users
  FOR UPDATE USING (
    (auth.uid()::TEXT = auth_id::TEXT) OR
    (auth.jwt() ->> 'user_id' = id::TEXT)
  );

-- RLS POLICIES FOR COMPANY_MEMBERS
DROP POLICY IF EXISTS "users_can_view_members" ON company_members;
CREATE POLICY "users_can_view_members" ON company_members
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM users
      WHERE users.deleted_at IS NULL
      AND (
        (auth.uid()::TEXT = users.auth_id::TEXT) OR
        (auth.jwt() ->> 'user_id' = users.id::TEXT)
      )
    )
  );

DROP POLICY IF EXISTS "admins_can_manage_members" ON company_members;
CREATE POLICY "admins_can_manage_members" ON company_members
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM users
      WHERE users.deleted_at IS NULL
      AND users.role IN ('owner', 'admin')
      AND (
        (auth.uid()::TEXT = users.auth_id::TEXT) OR
        (auth.jwt() ->> 'user_id' = users.id::TEXT)
      )
    )
  );

-- RLS POLICIES FOR AUDIT_LOGS
DROP POLICY IF EXISTS "users_can_view_audit_logs" ON audit_logs;
CREATE POLICY "users_can_view_audit_logs" ON audit_logs
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM users
      WHERE users.deleted_at IS NULL
      AND (
        (auth.uid()::TEXT = users.auth_id::TEXT) OR
        (auth.jwt() ->> 'user_id' = users.id::TEXT)
      )
    )
  );

DROP POLICY IF EXISTS "system_can_insert_audit_logs" ON audit_logs;
CREATE POLICY "system_can_insert_audit_logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- MODIFY Z_API_INSTANCES TABLE
ALTER TABLE IF EXISTS z_api_instances
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- CREATE INDEXES FOR Z_API_INSTANCES
CREATE INDEX IF NOT EXISTS idx_z_api_instances_company_id
  ON z_api_instances(company_id);

CREATE INDEX IF NOT EXISTS idx_z_api_instances_instance_id_company
  ON z_api_instances(instance_id, company_id);

-- ============================================================================
-- CREATE MASTER USER AND COMPANY
-- ============================================================================

-- Create or update master company
INSERT INTO companies (id, name, slug, plan, status, owner_id, metadata, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  'Master Company',
  'master',
  'enterprise',
  'active',
  '00000000-0000-0000-0000-000000000002'::UUID,
  '{"type": "master", "internal": true}',
  '{"master_account": true}'
)
ON CONFLICT (slug) DO UPDATE SET
  updated_at = CURRENT_TIMESTAMP;

-- Create or update master user
INSERT INTO users (
  id,
  company_id,
  email,
  full_name,
  role,
  status,
  email_verified,
  email_verified_at,
  password_hash,
  auth_id,
  preferences,
  metadata
)
VALUES (
  '00000000-0000-0000-0000-000000000002'::UUID,
  '00000000-0000-0000-0000-000000000001'::UUID,
  'kairolopesoficial@gmail.com',
  'Master Admin',
  'owner',
  'active',
  true,
  CURRENT_TIMESTAMP,
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/e1e',
  '00000000-0000-0000-0000-000000000002'::UUID,
  '{"master_user": true, "preferences": {"language": "pt-BR", "timezone": "America/Sao_Paulo"}}',
  '{"internal": true, "created_by": "system"}'
)
ON CONFLICT (email) DO UPDATE SET
  updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- ADD COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE companies IS 'Top-level organization entity in the multi-tenant system';
COMMENT ON TABLE users IS 'Individual users within a company with role-based access';
COMMENT ON TABLE company_members IS 'Junction table for user membership in companies';
COMMENT ON TABLE audit_logs IS 'Audit trail for all changes';

COMMENT ON COLUMN companies.slug IS 'URL-friendly identifier for the company';
COMMENT ON COLUMN companies.cnpj IS 'Brazilian business tax identification number. Format: XX.XXX.XXX/XXXX-XX';
COMMENT ON COLUMN users.company_id IS 'Foreign key to companies - each user belongs to exactly one company';
COMMENT ON COLUMN users.role IS 'Role-based access control in the company';
COMMENT ON COLUMN z_api_instances.company_id IS 'Foreign key to companies - associates Z-API instances with companies';

-- ============================================================================
-- MIGRATION VERIFICATION
-- ============================================================================

-- Display summary of created objects
