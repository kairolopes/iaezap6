-- ============================================================================
-- MULTI-TENANT COMPANY MIGRATION STRATEGY
-- ============================================================================
-- Safe migration plan to add company-level multi-tenant support to IAeZap
-- WITHOUT altering existing conversations/messages/message_rules data
--
-- Timeline: Execute in phases with verification between each step
-- Rollback: Each step can be rolled back independently (see section 9)
-- ============================================================================

-- ============================================================================
-- PHASE 1: CREATE NEW COMPANY-LEVEL INFRASTRUCTURE TABLES
-- ============================================================================
-- These tables will support the company tier of multi-tenancy
-- Existing tenant tables remain unchanged

-- 1.1 COMPANIES TABLE
-- Root entity for company-level organization
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  plan VARCHAR(50) NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'professional', 'enterprise')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  owner_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT companies_owner_fkey
    FOREIGN KEY (owner_id)
    REFERENCES auth.users(id) ON DELETE RESTRICT
);

-- 1.2 CREATE INDEXES FOR COMPANIES TABLE
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_plan ON companies(plan);
CREATE INDEX IF NOT EXISTS idx_companies_created_at ON companies(created_at);

-- 1.3 COMPANY_MEMBERS TABLE
-- Junction table for company-level user association with roles
CREATE TABLE IF NOT EXISTS company_members (
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, company_id)
);

-- 1.4 CREATE INDEXES FOR COMPANY_MEMBERS TABLE
CREATE INDEX IF NOT EXISTS idx_company_members_user_id ON company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_role ON company_members(role);
CREATE INDEX IF NOT EXISTS idx_company_members_joined_at ON company_members(joined_at);

-- 1.5 COMPANY_TENANTS TABLE
-- Maps tenants (workspace) to companies (organization)
-- This creates the company -> tenant hierarchy
CREATE TABLE IF NOT EXISTS company_tenants (
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id, tenant_id)
);

-- 1.6 CREATE INDEXES FOR COMPANY_TENANTS TABLE
CREATE INDEX IF NOT EXISTS idx_company_tenants_company_id ON company_tenants(company_id);
CREATE INDEX IF NOT EXISTS idx_company_tenants_tenant_id ON company_tenants(tenant_id);

-- 1.7 COMPANY_SETTINGS TABLE
-- Tenant-like settings but at company level
CREATE TABLE IF NOT EXISTS company_settings (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  api_key_prefix VARCHAR(50),
  webhook_url TEXT,
  timezone VARCHAR(50) DEFAULT 'UTC',
  notification_email VARCHAR(255),
  advanced_settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1.8 CREATE INDEX FOR COMPANY_SETTINGS
CREATE INDEX IF NOT EXISTS idx_company_settings_company_id ON company_settings(company_id);

-- ============================================================================
-- PHASE 2: ENABLE RLS ON NEW COMPANY TABLES (OPTIONAL)
-- ============================================================================
-- Only enable if you want row-level security on company data
-- For MVP, can be disabled - rely on application-level authorization

-- ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE company_tenants ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PHASE 3: ADD COMPANY_ID COLUMN TO EXISTING TABLES
-- ============================================================================
-- Add company_id as NULLABLE to all relevant tables
-- This allows existing data to remain unchanged during migration

-- 3.1 ADD company_id TO z_api_instances TABLE
-- (Keep existing data intact, company_id starts as NULL)
ALTER TABLE z_api_instances
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- 3.2 CREATE INDEX FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_z_api_instances_company_id ON z_api_instances(company_id);

-- 3.3 ADD company_id TO message_rules TABLE
-- (Rules are tenant-scoped, also track company for billing)
ALTER TABLE message_rules
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- 3.4 CREATE INDEX FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_message_rules_company_id ON message_rules(company_id);

-- 3.5 ADD company_id TO audit_logs TABLE
-- (Audit trail at company level)
ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- 3.6 CREATE INDEX FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);

-- 3.7 ADD company_id TO conversations TABLE
-- (Conversations span across tenants in a company)
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- 3.8 CREATE INDEX FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_conversations_company_id ON conversations(company_id);

-- ============================================================================
-- PHASE 4: CREATE MASTER USER (SERVICE ACCOUNT)
-- ============================================================================
-- This is a special system account for company creation and initial setup
-- Usually created through Supabase Auth directly, but we'll create the user_id here

-- Note: In actual deployment, you'll create this via Supabase Auth Dashboard
-- For now, we just prepare a placeholder approach

-- 4.1 FUNCTION TO CREATE OR GET MASTER USER
-- (In production, use Supabase Auth API)
CREATE OR REPLACE FUNCTION ensure_master_user()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  master_user_id UUID;
BEGIN
  -- Check if master user exists in auth.users
  -- Note: This query assumes a 'service_account' role or similar identifier
  -- In production, you'd check a specific email or custom claim

  -- For now, return a well-known UUID for the system
  -- Replace with actual logic based on your auth setup
  RETURN '00000000-0000-0000-0000-000000000000'::UUID;
END;
$$;

-- 4.2 PLACEHOLDER: Track master user ID
-- In production deployment:
-- 1. Create user via Supabase Auth: kairo@zapbaratinho.com.br (as master/admin)
-- 2. Get the UUID from auth.users table
-- 3. Reference it in company creation

-- ============================================================================
-- PHASE 5: BACKFILL COMPANY_ID FROM EXISTING TENANT_ID DATA
-- ============================================================================
-- Create a company for each existing tenant, then link them
-- This maintains data integrity during transition

-- 5.1 FUNCTION TO MIGRATE EXISTING TENANTS TO COMPANIES
CREATE OR REPLACE FUNCTION migrate_tenants_to_companies()
RETURNS TABLE(
  created_companies INT,
  created_mappings INT,
  updated_instances INT,
  status TEXT
) AS $$
DECLARE
  v_tenant_id UUID;
  v_company_id UUID;
  v_company_count INT := 0;
  v_mapping_count INT := 0;
  v_instance_count INT := 0;
  v_master_user UUID := '00000000-0000-0000-0000-000000000000'::UUID;
BEGIN
  -- Start transaction
  BEGIN
    -- 5.1.1 Create companies for each existing tenant
    -- Migration strategy: 1 tenant = 1 company initially
    INSERT INTO companies (name, slug, owner_id, metadata)
    SELECT
      t.name,
      t.slug,
      v_master_user,
      jsonb_build_object(
        'migrated_from_tenant', t.id,
        'migration_date', NOW(),
        'migration_version', '1.0'
      )
    FROM tenants t
    WHERE NOT EXISTS (
      SELECT 1 FROM companies c
      WHERE c.metadata->>'migrated_from_tenant' = t.id::text
    )
    ON CONFLICT (slug) DO NOTHING;

    GET DIAGNOSTICS v_company_count = ROW_COUNT;

    -- 5.1.2 Create company_tenants mappings
    INSERT INTO company_tenants (company_id, tenant_id)
    SELECT
      c.id,
      (c.metadata->>'migrated_from_tenant')::UUID
    FROM companies c
    WHERE c.metadata->>'migrated_from_tenant' IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM company_tenants ct
      WHERE ct.company_id = c.id
      AND ct.tenant_id = (c.metadata->>'migrated_from_tenant')::UUID
    )
    ON CONFLICT (company_id, tenant_id) DO NOTHING;

    GET DIAGNOSTICS v_mapping_count = ROW_COUNT;

    -- 5.1.3 Backfill company_id in z_api_instances
    -- Link instances to company based on tenant_id
    UPDATE z_api_instances zai
    SET company_id = c.id
    FROM companies c
    WHERE zai.tenant_id::UUID = (c.metadata->>'migrated_from_tenant')::UUID
    AND zai.company_id IS NULL;

    GET DIAGNOSTICS v_instance_count = ROW_COUNT;

    RETURN QUERY SELECT
      v_company_count::INT,
      v_mapping_count::INT,
      v_instance_count::INT,
      'SUCCESS'::TEXT;

  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      0::INT,
      0::INT,
      0::INT,
      'ERROR: ' || SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql;

-- 5.2 EXECUTE MIGRATION (RUN AFTER VERIFICATION)
-- SELECT * FROM migrate_tenants_to_companies();
-- Uncomment above after you've verified the schema is correct

-- ============================================================================
-- PHASE 6: ADD TRIGGERS FOR UPDATED_AT COLUMNS
-- ============================================================================
-- Auto-update timestamp columns on modification

-- 6.1 FUNCTION FOR TIMESTAMP UPDATE
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6.2 TRIGGERS FOR NEW TABLES
CREATE TRIGGER companies_update_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER company_settings_update_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PHASE 7: CREATE HELPER FUNCTIONS FOR COMPANY OPERATIONS
-- ============================================================================

-- 7.1 GET COMPANY BY USER (user must be company member)
CREATE OR REPLACE FUNCTION get_user_companies(p_user_id UUID)
RETURNS TABLE(
  company_id UUID,
  company_name VARCHAR,
  role VARCHAR,
  plan VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    cm.role,
    c.plan
  FROM companies c
  INNER JOIN company_members cm ON cm.company_id = c.id
  WHERE cm.user_id = p_user_id
  ORDER BY cm.joined_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 7.2 CHECK USER PERMISSION IN COMPANY
CREATE OR REPLACE FUNCTION user_has_company_role(
  p_user_id UUID,
  p_company_id UUID,
  p_required_role VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_role VARCHAR;
BEGIN
  SELECT cm.role INTO v_user_role
  FROM company_members cm
  WHERE cm.user_id = p_user_id
  AND cm.company_id = p_company_id;

  -- Role hierarchy: owner > admin > member > viewer
  CASE
    WHEN v_user_role = 'owner' THEN RETURN TRUE;
    WHEN v_user_role = 'admin' AND p_required_role IN ('admin', 'member', 'viewer') THEN RETURN TRUE;
    WHEN v_user_role = 'member' AND p_required_role IN ('member', 'viewer') THEN RETURN TRUE;
    WHEN v_user_role = 'viewer' AND p_required_role = 'viewer' THEN RETURN TRUE;
    ELSE RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- 7.3 GET ALL TENANTS FOR COMPANY
CREATE OR REPLACE FUNCTION get_company_tenants(p_company_id UUID)
RETURNS TABLE(
  tenant_id UUID,
  tenant_name VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.created_at
  FROM tenants t
  INNER JOIN company_tenants ct ON ct.tenant_id = t.id
  WHERE ct.company_id = p_company_id
  ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 8: CREATE MIGRATION VERIFICATION QUERIES
-- ============================================================================
-- Use these queries to verify each phase completed successfully

-- 8.1 VERIFY NEW TABLES EXIST
SELECT 'companies' as table_name, COUNT(*) as row_count FROM companies
UNION ALL
SELECT 'company_members', COUNT(*) FROM company_members
UNION ALL
SELECT 'company_tenants', COUNT(*) FROM company_tenants
UNION ALL
SELECT 'company_settings', COUNT(*) FROM company_settings;

-- 8.2 VERIFY COLUMNS ADDED
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN (
  'z_api_instances',
  'message_rules',
  'audit_logs',
  'conversations'
)
AND column_name = 'company_id'
ORDER BY table_name;

-- 8.3 VERIFY COMPANY-TENANT MAPPING
SELECT
  c.id,
  c.name,
  COUNT(ct.tenant_id) as tenant_count,
  COUNT(DISTINCT zai.id) as instance_count
FROM companies c
LEFT JOIN company_tenants ct ON ct.company_id = c.id
LEFT JOIN z_api_instances zai ON zai.company_id = c.id
GROUP BY c.id, c.name;

-- 8.4 VERIFY DATA INTEGRITY (No data lost)
SELECT
  'conversations' as entity,
  COUNT(*) as total_records,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as has_company_id,
  COUNT(CASE WHEN company_id IS NULL THEN 1 END) as null_company_id
FROM conversations
UNION ALL
SELECT 'messages', COUNT(*), 0, COUNT(*) FROM messages
UNION ALL
SELECT 'message_rules', COUNT(*), COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END), COUNT(CASE WHEN company_id IS NULL THEN 1 END) FROM message_rules;

-- ============================================================================
-- PHASE 9: OPTIONAL - ADD CONSTRAINTS AFTER VERIFICATION
-- ============================================================================
-- Only add NOT NULL constraints after backfill is complete and verified
-- Uncomment these after Phase 8 verification passes

-- 9.1 MAKE company_id NOT NULL IN z_api_instances
-- ALTER TABLE z_api_instances
-- ALTER COLUMN company_id SET NOT NULL;

-- 9.2 MAKE company_id NOT NULL IN message_rules
-- ALTER TABLE message_rules
-- ALTER COLUMN company_id SET NOT NULL;

-- 9.3 ADD UNIQUE CONSTRAINT FOR z_api_instances
-- Each instance belongs to exactly one company
-- ALTER TABLE z_api_instances
-- ADD CONSTRAINT z_api_instances_company_instance_unique
-- UNIQUE (company_id, instance_id);

-- ============================================================================
-- PHASE 10: ROLLBACK PROCEDURES
-- ============================================================================
-- If migration needs to be rolled back, execute these in REVERSE order

-- 10.1 ROLLBACK CONSTRAINTS (Phase 9)
-- ALTER TABLE z_api_instances
-- ALTER COLUMN company_id DROP NOT NULL;
--
-- ALTER TABLE message_rules
-- ALTER COLUMN company_id DROP NOT NULL;
--
-- ALTER TABLE z_api_instances
-- DROP CONSTRAINT IF EXISTS z_api_instances_company_instance_unique;

-- 10.2 ROLLBACK NEW COLUMNS (Phase 3)
-- ALTER TABLE z_api_instances DROP COLUMN IF EXISTS company_id CASCADE;
-- ALTER TABLE message_rules DROP COLUMN IF EXISTS company_id CASCADE;
-- ALTER TABLE audit_logs DROP COLUMN IF EXISTS company_id CASCADE;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS company_id CASCADE;

-- 10.3 ROLLBACK NEW TABLES (Phase 1)
-- DROP TABLE IF EXISTS company_settings CASCADE;
-- DROP TABLE IF EXISTS company_tenants CASCADE;
-- DROP TABLE IF EXISTS company_members CASCADE;
-- DROP TABLE IF EXISTS companies CASCADE;

-- 10.4 ROLLBACK FUNCTIONS (Phase 7)
-- DROP FUNCTION IF EXISTS get_user_companies(UUID) CASCADE;
-- DROP FUNCTION IF EXISTS user_has_company_role(UUID, UUID, VARCHAR) CASCADE;
-- DROP FUNCTION IF EXISTS get_company_tenants(UUID) CASCADE;
-- DROP FUNCTION IF EXISTS migrate_tenants_to_companies() CASCADE;
-- DROP FUNCTION IF EXISTS ensure_master_user() CASCADE;

-- ============================================================================
-- END OF MULTI-TENANT COMPANY MIGRATION SCRIPT
-- ============================================================================
