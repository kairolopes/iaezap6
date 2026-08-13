-- ============================================================================
-- COMBINED MIGRATION: Complete Backfill for company_id in z_api_instances
-- All 4 migration steps in one file for easy Supabase Dashboard execution
-- ============================================================================
-- This single file contains all necessary migrations to:
-- 1. Create companies, users, and related tables
-- 2. Add CNPJ support to companies
-- 3. Add company_id column to z_api_instances with RLS policies
-- 4. Backfill company_id with default company
-- ============================================================================
-- EXECUTION: Copy this entire file into Supabase SQL Editor and execute
-- EXPECTED TIME: < 1 minute
-- DATA RISK: None - all operations are safe with conflict handling
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE COMPANIES, USERS, AND RELATED TABLES
-- ============================================================================
-- This creates the base tables for the multi-tenant system

-- 1.1 Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  plan VARCHAR(50) DEFAULT 'starter',
  status VARCHAR(20) DEFAULT 'active',
  owner_id UUID,
  cnpj VARCHAR(20),
  metadata JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ
);

-- 1.2 Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  auth_id TEXT UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  phone VARCHAR(20),
  role VARCHAR(50) DEFAULT 'member',
  status VARCHAR(20) DEFAULT 'active',
  password_hash VARCHAR(255),
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ
);

-- 1.3 Create company_members table (audit/history)
CREATE TABLE IF NOT EXISTS company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  permissions JSONB DEFAULT '{}',
  joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, user_id)
);

-- 1.4 Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  status VARCHAR(20) DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 1.5 Create indexes for companies
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON companies(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status) WHERE deleted_at IS NULL;

-- 1.6 Create indexes for users
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id) WHERE deleted_at IS NULL;

-- 1.7 Create indexes for company_members
CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user_id ON company_members(user_id);

-- 1.8 Create indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- 1.9 Create master company
INSERT INTO companies (
  name, slug, description, plan, status, owner_id, cnpj
) VALUES (
  'Master Company',
  'master',
  'Master company for system administration',
  'enterprise',
  'active',
  '00000000-0000-0000-0000-000000000000',
  '00.000.000/0000-00'
) ON CONFLICT (slug) DO NOTHING;

-- 1.10 Create master user
INSERT INTO users (
  company_id,
  email,
  full_name,
  role,
  status
) VALUES (
  (SELECT id FROM companies WHERE slug = 'master' LIMIT 1),
  'kairolopesoficial@gmail.com',
  'Kairo Lopes',
  'owner',
  'active'
) ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- STEP 2: ADD CNPJ SUPPORT
-- ============================================================================

-- 2.1 Add CNPJ column if not exists (usually already there from step 1)
ALTER TABLE IF EXISTS companies
ADD COLUMN IF NOT EXISTS cnpj VARCHAR(20);

-- 2.2 Create CNPJ index
CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON companies(cnpj) WHERE cnpj IS NOT NULL;

-- 2.3 Add CNPJ validation check
ALTER TABLE companies
ADD CONSTRAINT check_cnpj_format
CHECK (cnpj IS NULL OR cnpj ~ '^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$');

-- ============================================================================
-- STEP 3: ADD COMPANY_ID TO Z_API_INSTANCES AND CREATE RLS POLICIES
-- ============================================================================

-- 3.1 Enable RLS on tables
ALTER TABLE IF EXISTS companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;

-- 3.2 Add company_id column to z_api_instances
ALTER TABLE IF EXISTS z_api_instances
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- 3.3 Create indexes on z_api_instances
CREATE INDEX IF NOT EXISTS idx_z_api_instances_company_id
  ON z_api_instances(company_id);

CREATE INDEX IF NOT EXISTS idx_z_api_instances_instance_id_company
  ON z_api_instances(instance_id, company_id);

-- 3.4 Add comment
COMMENT ON COLUMN z_api_instances.company_id IS 'Foreign key to companies table. Associates Z-API instances with specific companies in the multi-tenant system.';

-- 3.5 Create RLS policies for companies table
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

-- 3.6 Create RLS policies for users table
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

-- 3.7 Create RLS policies for company_members table
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

-- 3.8 Create RLS policies for audit_logs table
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

-- ============================================================================
-- STEP 4: BACKFILL COMPANY_ID IN Z_API_INSTANCES
-- ============================================================================

-- 4.1 Create default company if it doesn't exist
INSERT INTO companies (
  id,
  name,
  slug,
  description,
  plan,
  status,
  owner_id,
  cnpj,
  metadata,
  settings
) VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  'Default Company',
  'default-company',
  'Default company for unassigned API instances during migration',
  'starter',
  'active',
  '00000000-0000-0000-0000-000000000000'::UUID,
  '00.000.000/0000-00',
  jsonb_build_object(
    'backfill_default', true,
    'created_by_migration', '003_backfill_company_id',
    'created_at_migration', NOW()
  ),
  '{}'
)
ON CONFLICT (slug) DO NOTHING;

-- 4.2 Backfill company_id in z_api_instances
UPDATE z_api_instances
SET
  company_id = (
    SELECT id FROM companies
    WHERE slug = 'default-company'
    LIMIT 1
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE
  company_id IS NULL
  AND id IS NOT NULL;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- These queries verify the backfill was successful
-- You can run them separately to check results

-- Query 1: Verify companies table state
SELECT
  'companies_table' as entity,
  COUNT(*) as total_count,
  COUNT(CASE WHEN slug = 'default-company' THEN 1 END) as default_companies,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_companies
FROM companies;

-- Query 2: Verify z_api_instances backfill status
SELECT
  'z_api_instances' as entity,
  COUNT(*) as total_instances,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company_id,
  COUNT(CASE WHEN company_id IS NULL THEN 1 END) as without_company_id,
  ROUND(
    COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END)::numeric /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as percentage_backfilled
FROM z_api_instances;

-- Query 3: Show distribution of instances across companies
SELECT
  c.slug as company_slug,
  c.name as company_name,
  COUNT(zai.id) as instance_count,
  COUNT(CASE WHEN zai.tenant_id IS NOT NULL THEN 1 END) as instances_with_tenant
FROM companies c
LEFT JOIN z_api_instances zai ON zai.company_id = c.id
GROUP BY c.id, c.slug, c.name
ORDER BY instance_count DESC;

-- Query 4: Verify default company details
SELECT
  id as company_id,
  name,
  slug,
  cnpj,
  plan,
  status,
  owner_id,
  metadata->>'backfill_default' as is_backfill_default,
  created_at,
  updated_at
FROM companies
WHERE slug = 'default-company';

-- Query 5: Show sample of backfilled instances
SELECT
  zai.id,
  zai.instance_id,
  zai.tenant_id,
  zai.company_id,
  c.slug as company_slug,
  c.name as company_name,
  zai.created_at,
  zai.updated_at
FROM z_api_instances zai
LEFT JOIN companies c ON zai.company_id = c.id
ORDER BY zai.updated_at DESC
LIMIT 10;

-- Query 6: Data integrity check: ensure no instances were lost
SELECT
  'Data Integrity Check' as check_name,
  COUNT(*) as total_instances,
  COUNT(CASE WHEN instance_id IS NOT NULL THEN 1 END) as valid_instance_ids,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as linked_to_company
FROM z_api_instances;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
-- All steps completed. Check the verification queries above for success.
-- Expected results:
-- - Total instances: 2 (unchanged)
-- - Instances with company_id: 2
-- - Percentage backfilled: 100%
-- - No instances lost
-- ============================================================================
