-- ============================================================================
-- MIGRATION: Create Companies, Users, and User Roles Tables
-- Version: 001
-- Description: Initial multi-tenant system setup with companies, users, and role management
-- Date: 2026-08-13
-- ============================================================================
-- This migration creates the foundational tables for the IAeZap multi-tenant system:
-- 1. user_role enum type for role-based access control
-- 2. companies table as the top-level organization entity
-- 3. users table with company association
-- 4. Proper indexes and constraints for performance and data integrity
-- ============================================================================

-- ============================================================================
-- PHASE 1: CREATE ENUM TYPES
-- ============================================================================

-- 1.1 CREATE user_role ENUM TYPE
-- Defines the available roles for users within a company
CREATE TYPE user_role AS ENUM (
  'owner',      -- Full access, can manage company and all users
  'admin',      -- Administrative access, can manage most settings and users
  'member',     -- Regular member with standard permissions
  'viewer'      -- Read-only access to company data
);

-- ============================================================================
-- PHASE 2: CREATE COMPANIES TABLE
-- ============================================================================

-- 2.1 CREATE companies TABLE
-- Root entity representing a company/organization in the multi-tenant system
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

-- 2.2 CREATE INDEXES FOR companies TABLE
-- Index for quick slug lookups (common for URL routing)
CREATE INDEX IF NOT EXISTS idx_companies_slug
  ON companies(slug)
  WHERE deleted_at IS NULL;

-- Index for owner lookups
CREATE INDEX IF NOT EXISTS idx_companies_owner_id
  ON companies(owner_id);

-- Index for status and plan filtering
CREATE INDEX IF NOT EXISTS idx_companies_status
  ON companies(status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_companies_plan
  ON companies(plan);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_companies_created_at
  ON companies(created_at DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_companies_status_plan
  ON companies(status, plan)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- PHASE 3: CREATE USERS TABLE
-- ============================================================================

-- 3.1 CREATE users TABLE
-- Represents individual users in the system with company association
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
  auth_id UUID UNIQUE,  -- Reference to auth service (e.g., Supabase auth.users.id)
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

-- 3.2 CREATE INDEXES FOR users TABLE
-- Index for email lookups (authentication)
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email)
  WHERE deleted_at IS NULL;

-- Composite index for company + email lookups (most common query)
CREATE INDEX IF NOT EXISTS idx_users_company_email
  ON users(company_id, email)
  WHERE deleted_at IS NULL;

-- Index for company membership queries
CREATE INDEX IF NOT EXISTS idx_users_company_id
  ON users(company_id)
  WHERE deleted_at IS NULL;

-- Index for auth_id lookups (external auth integration)
CREATE INDEX IF NOT EXISTS idx_users_auth_id
  ON users(auth_id)
  WHERE deleted_at IS NULL;

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_company_role
  ON users(company_id, role)
  WHERE deleted_at IS NULL;

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_users_status
  ON users(status)
  WHERE deleted_at IS NULL;

-- Index for activity tracking
CREATE INDEX IF NOT EXISTS idx_users_last_activity_at
  ON users(last_activity_at DESC)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- PHASE 4: CREATE JUNCTION/LOOKUP TABLES
-- ============================================================================

-- 4.1 CREATE company_members TABLE (optional but recommended)
-- Alternative to role column in users for managing team structures
-- Useful when a user can have multiple roles or membership states
CREATE TABLE IF NOT EXISTS company_members (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  invite_accepted_at TIMESTAMP WITH TIME ZONE,

  PRIMARY KEY (user_id, company_id)
);

-- 4.2 CREATE INDEXES FOR company_members TABLE
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

-- ============================================================================
-- PHASE 5: CREATE AUDIT LOG TABLE
-- ============================================================================

-- 5.1 CREATE audit_logs TABLE
-- Track all changes to companies and users for security and compliance
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

-- 5.2 CREATE INDEXES FOR audit_logs TABLE
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

-- ============================================================================
-- PHASE 6: CREATE HELPER FUNCTIONS
-- ============================================================================

-- 6.1 CREATE FUNCTION: update_updated_at_column()
-- Automatically updates the updated_at timestamp on record modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6.2 CREATE TRIGGER: companies_update_updated_at
-- Auto-update timestamp for companies table
CREATE TRIGGER companies_update_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6.3 CREATE TRIGGER: users_update_updated_at
-- Auto-update timestamp for users table
CREATE TRIGGER users_update_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6.4 CREATE FUNCTION: get_user_companies(user_id)
-- Get all companies a user belongs to with their roles
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

-- 6.5 CREATE FUNCTION: user_has_company_role()
-- Check if a user has a specific role in a company
-- Returns: TRUE if user has the required role or higher in hierarchy
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

-- 6.6 CREATE FUNCTION: get_company_users()
-- Get all users in a company with their roles
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

-- 6.7 CREATE FUNCTION: create_audit_log()
-- Create audit log entry when changes occur
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
-- PHASE 7: ADD COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE companies IS 'Top-level organization entity in the multi-tenant system. Each company can have multiple users and workspaces.';

COMMENT ON TABLE users IS 'Individual users within a company. Each user is scoped to a single company and has a role-based access level.';

COMMENT ON TABLE company_members IS 'Junction table for managing user membership in companies. Tracks roles, invitations, and membership timeline.';

COMMENT ON TABLE audit_logs IS 'Audit trail for all changes to companies and users. Essential for security, compliance, and debugging.';

COMMENT ON COLUMN companies.slug IS 'URL-friendly identifier for the company. Used in routing and API endpoints.';

COMMENT ON COLUMN companies.plan IS 'Subscription plan level (starter, professional, enterprise) for feature gating and billing.';

COMMENT ON COLUMN users.company_id IS 'Foreign key to companies. Every user belongs to exactly one company.';

COMMENT ON COLUMN users.role IS 'Role-based access control. Determines what actions the user can perform in their company.';

COMMENT ON COLUMN users.auth_id IS 'Reference to external authentication service (e.g., Supabase Auth). Used for SSO and external auth providers.';

COMMENT ON COLUMN audit_logs.entity_id IS 'ID of the entity that was changed (could be company_id, user_id, etc.).';

-- ============================================================================
-- PHASE 8: VERIFICATION QUERIES (FOR TESTING)
-- ============================================================================
-- Uncomment these to verify the migration completed successfully

/*
-- Verify enum type was created
SELECT * FROM pg_type WHERE typname = 'user_role';

-- Verify tables exist with correct structure
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('companies', 'users', 'company_members', 'audit_logs');

-- Verify indexes were created
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('companies', 'users', 'company_members', 'audit_logs')
ORDER BY tablename, indexname;

-- Verify functions were created
SELECT proname FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND proname LIKE '%user%' OR proname LIKE '%company%'
ORDER BY proname;
*/

-- ============================================================================
-- END OF MIGRATION: Create Companies, Users, and User Roles
-- ============================================================================
