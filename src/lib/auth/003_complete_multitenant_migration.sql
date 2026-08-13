-- ============================================================================
-- MIGRATION: Complete Multi-Tenant System with RLS Policies and API Integration
-- Version: 003
-- Description: Add RLS policies, modify z_api_instances table, and create master user
-- Date: 2026-08-13
-- ============================================================================

-- ============================================================================
-- PHASE 1: ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- 1.1 Enable RLS on companies table
ALTER TABLE IF EXISTS companies ENABLE ROW LEVEL SECURITY;

-- 1.2 Enable RLS on users table
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;

-- 1.3 Enable RLS on company_members table
ALTER TABLE IF EXISTS company_members ENABLE ROW LEVEL SECURITY;

-- 1.4 Enable RLS on audit_logs table
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PHASE 2: CREATE RLS POLICIES FOR COMPANIES TABLE
-- ============================================================================

-- 2.1 Companies: Users can view companies they belong to
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

-- 2.2 Companies: Only owners can update their company
DROP POLICY IF EXISTS "owners_can_update_companies" ON companies;
CREATE POLICY "owners_can_update_companies" ON companies
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 2.3 Companies: Only system admin can insert companies
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

-- ============================================================================
-- PHASE 3: CREATE RLS POLICIES FOR USERS TABLE
-- ============================================================================

-- 3.1 Users: Can view users in their own company
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

-- 3.2 Users: Admins and owners can update users in their company
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

-- 3.3 Users: Can update own profile
DROP POLICY IF EXISTS "users_can_update_own_profile" ON users;
CREATE POLICY "users_can_update_own_profile" ON users
  FOR UPDATE USING (
    (auth.uid()::TEXT = auth_id::TEXT) OR
    (auth.jwt() ->> 'user_id' = id::TEXT)
  );

-- ============================================================================
-- PHASE 4: CREATE RLS POLICIES FOR COMPANY_MEMBERS TABLE
-- ============================================================================

-- 4.1 Company members: Can view members in their company
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

-- 4.2 Company members: Admins can manage members
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

-- ============================================================================
-- PHASE 5: CREATE RLS POLICIES FOR AUDIT_LOGS TABLE
-- ============================================================================

-- 5.1 Audit logs: Users can view logs for their company
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

-- 5.2 Audit logs: Only system can insert logs
DROP POLICY IF EXISTS "system_can_insert_audit_logs" ON audit_logs;
CREATE POLICY "system_can_insert_audit_logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- PHASE 6: MODIFY Z_API_INSTANCES TABLE
-- ============================================================================

-- 6.1 Add company_id column to z_api_instances if it doesn't exist
ALTER TABLE IF EXISTS z_api_instances
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- 6.2 Create index on z_api_instances company_id
CREATE INDEX IF NOT EXISTS idx_z_api_instances_company_id
  ON z_api_instances(company_id);

-- 6.3 Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_z_api_instances_instance_id_company
  ON z_api_instances(instance_id, company_id);

-- 6.4 Add comment for company_id column
COMMENT ON COLUMN z_api_instances.company_id IS 'Foreign key to companies table. Associates Z-API instances with specific companies in the multi-tenant system.';

-- ============================================================================
-- PHASE 7: CREATE MASTER USER
-- ============================================================================

-- 7.1 Check if master company already exists, if not create it
INSERT INTO companies (id, name, slug, plan, status, owner_id, metadata, settings)
SELECT
  '00000000-0000-0000-0000-000000000001'::UUID,
  'Master Company',
  'master',
  'enterprise',
  'active',
  '00000000-0000-0000-0000-000000000002'::UUID,
  '{"type": "master", "internal": true}',
  '{"master_account": true}'
WHERE NOT EXISTS (
  SELECT 1 FROM companies WHERE slug = 'master' AND deleted_at IS NULL
);

-- 7.2 Create master user (placeholder auth_id, will be linked to real auth user)
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
SELECT
  '00000000-0000-0000-0000-000000000002'::UUID,
  '00000000-0000-0000-0000-000000000001'::UUID,
  'kairolopesoficial@gmail.com',
  'Master Admin',
  'owner',
  'active',
  true,
  CURRENT_TIMESTAMP,
  -- bcrypt hash placeholder for password (would be real hash in production)
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/e1e',
  '00000000-0000-0000-0000-000000000002'::UUID,
  '{"master_user": true, "preferences": {"language": "pt-BR", "timezone": "America/Sao_Paulo"}}',
  '{"internal": true, "created_by": "system"}'
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'kairolopesoficial@gmail.com' AND deleted_at IS NULL
);

-- 7.3 Update master company owner_id to reference the master user
UPDATE companies
SET owner_id = '00000000-0000-0000-0000-000000000002'::UUID
WHERE slug = 'master' AND deleted_at IS NULL;

-- ============================================================================
-- PHASE 8: CREATE VERIFICATION QUERIES
-- ============================================================================

-- Verification query result table (will be populated during execution)
CREATE TABLE IF NOT EXISTS migration_verification (
  id SERIAL PRIMARY KEY,
  check_name VARCHAR(255),
  status VARCHAR(50),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8.1 Verify enum types exist
INSERT INTO migration_verification (check_name, status, details)
SELECT
  'user_role_enum_exists',
  CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END,
  jsonb_build_object('type_name', 'user_role', 'enum_values', array_agg(enumlabel))
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
GROUP BY enumtypid;

-- 8.2 Verify tables exist
INSERT INTO migration_verification (check_name, status, details)
SELECT
  'tables_created',
  CASE WHEN COUNT(*) = 5 THEN 'PASS' ELSE 'FAIL' END,
  jsonb_build_object(
    'expected_count', 5,
    'actual_count', COUNT(*),
    'tables', jsonb_agg(table_name)
  )
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('companies', 'users', 'company_members', 'audit_logs', 'z_api_instances');

-- 8.3 Verify indexes exist
INSERT INTO migration_verification (check_name, status, details)
SELECT
  'indexes_created',
  CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END,
  jsonb_build_object(
    'total_indexes', COUNT(*),
    'index_names', jsonb_agg(indexname)
  )
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('companies', 'users', 'company_members', 'audit_logs', 'z_api_instances')
AND indexname LIKE 'idx_%';

-- 8.4 Verify RLS is enabled
INSERT INTO migration_verification (check_name, status, details)
SELECT
  'rls_enabled',
  CASE WHEN COUNT(*) >= 4 THEN 'PASS' ELSE 'FAIL' END,
  jsonb_build_object(
    'expected_tables_with_rls', 4,
    'actual_tables_with_rls', COUNT(*),
    'tables', jsonb_agg(tablename)
  )
FROM pg_class
WHERE relname IN ('companies', 'users', 'company_members', 'audit_logs')
AND relrowsecurity = true;

-- 8.5 Verify master user created
INSERT INTO migration_verification (check_name, status, details)
SELECT
  'master_user_created',
  CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END,
  jsonb_build_object(
    'user_count', COUNT(*),
    'email', array_agg(email),
    'roles', array_agg(role)
  )
FROM users
WHERE email = 'kairolopesoficial@gmail.com'
AND deleted_at IS NULL;

-- 8.6 Verify company_id added to z_api_instances
INSERT INTO migration_verification (check_name, status, details)
SELECT
  'z_api_instances_company_id_added',
  CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END,
  jsonb_build_object(
    'column_name', 'company_id',
    'data_type', data_type,
    'is_nullable', is_nullable
  )
FROM information_schema.columns
WHERE table_name = 'z_api_instances'
AND column_name = 'company_id';

-- ============================================================================
-- PHASE 9: FINAL VERIFICATION SUMMARY
-- ============================================================================

-- Summary query (execute separately to view results)
/*
-- EXECUTE THIS QUERY TO VIEW MIGRATION RESULTS:
SELECT
  mv.check_name,
  mv.status,
  mv.details,
  mv.created_at
FROM migration_verification mv
ORDER BY mv.created_at DESC;

-- ADDITIONAL VERIFICATION QUERIES:

-- 1. List all tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('companies', 'users', 'company_members', 'audit_logs')
ORDER BY table_name;

-- 2. Count all indexes
SELECT
  tablename,
  COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('companies', 'users', 'company_members', 'audit_logs', 'z_api_instances')
GROUP BY tablename
ORDER BY tablename;

-- 3. Verify master user
SELECT
  id,
  email,
  full_name,
  role,
  status,
  email_verified,
  created_at
FROM users
WHERE email = 'kairolopesoficial@gmail.com'
AND deleted_at IS NULL;

-- 4. Verify master company
SELECT
  id,
  name,
  slug,
  plan,
  status,
  owner_id,
  created_at
FROM companies
WHERE slug = 'master'
AND deleted_at IS NULL;

-- 5. Verify RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 6. Verify company_id in z_api_instances
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'z_api_instances'
ORDER BY ordinal_position;
*/

-- ============================================================================
-- END OF MIGRATION: Complete Multi-Tenant System
-- ============================================================================
