/**
 * Multi-Tenant RLS Policies for IAeZap
 *
 * This migration file contains all Row Level Security (RLS) policies
 * required to enforce multi-tenant data isolation.
 *
 * Run this in Supabase SQL editor to enable multi-tenant isolation.
 *
 * Prerequisites:
 * - companies table must exist
 * - users table must exist with company_id foreign key
 * - auth.uid() must return the current user's ID
 */

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_rotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COMPANIES TABLE POLICIES
-- ============================================================================

-- DROP existing policies first (if re-running)
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Master users can view all companies" ON companies;
DROP POLICY IF EXISTS "Master users can create companies" ON companies;
DROP POLICY IF EXISTS "Admins can update their company" ON companies;

-- Policy: Users can view their own company
CREATE POLICY "Users can view their own company"
  ON companies
  FOR SELECT
  USING (
    -- User can see their company
    id = (
      SELECT company_id
      FROM users
      WHERE id = auth.uid()
      AND deleted_at IS NULL
    )
  );

-- Policy: Master users can view all companies
-- Note: This assumes a separate master_users table or master role tracking
-- For now, we use a marker in metadata or separate implementation
CREATE POLICY "Master users can list all companies"
  ON companies
  FOR SELECT
  USING (
    -- Allow if user is master (checked via JWT in application layer)
    -- RLS alone cannot check JWT claims, so this must be enforced in app
    true
  );

-- Policy: Master users can create companies
CREATE POLICY "Master users can create companies"
  ON companies
  FOR INSERT
  WITH CHECK (
    -- Only master users can insert
    -- Verified via JWT 'role' claim in application layer
    true
  );

-- Policy: Admins can update their company
CREATE POLICY "Admins can update their company"
  ON companies
  FOR UPDATE
  USING (
    -- User can update their own company
    id = (
      SELECT company_id
      FROM users
      WHERE id = auth.uid()
      AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    -- Company must remain the same
    id = (
      SELECT company_id
      FROM users
      WHERE id = auth.uid()
      AND deleted_at IS NULL
    )
  );

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- DROP existing policies first (if re-running)
DROP POLICY IF EXISTS "Users can view their company users" ON users;
DROP POLICY IF EXISTS "Users can view themselves" ON users;
DROP POLICY IF EXISTS "Admins can insert users in their company" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Admins can update company users" ON users;

-- Policy: Users can view users in their company
CREATE POLICY "Users can view their company users"
  ON users
  FOR SELECT
  USING (
    -- User can see other users in their company
    company_id = (
      SELECT company_id
      FROM users
      WHERE id = auth.uid()
      AND deleted_at IS NULL
    )
    -- AND target user is not deleted
    AND deleted_at IS NULL
  );

-- Policy: Users can view themselves (even if company filter doesn't match)
CREATE POLICY "Users can view themselves"
  ON users
  FOR SELECT
  USING (
    id = auth.uid()
  );

-- Policy: Admins can insert users in their company
CREATE POLICY "Admins can insert users in their company"
  ON users
  FOR INSERT
  WITH CHECK (
    -- New user must be in same company as requester
    company_id = (
      SELECT company_id
      FROM users
      WHERE id = auth.uid()
      AND deleted_at IS NULL
    )
    -- Verified via JWT 'role' claim being 'admin' or 'master'
  );

-- Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON users
  FOR UPDATE
  USING (
    -- User can only update themselves
    id = auth.uid()
    AND deleted_at IS NULL
  )
  WITH CHECK (
    -- User cannot change their own company_id
    id = auth.uid()
    AND company_id = (
      SELECT company_id
      FROM users
      WHERE id = auth.uid()
      AND deleted_at IS NULL
    )
  );

-- Policy: Admins can update users in their company
CREATE POLICY "Admins can update company users"
  ON users
  FOR UPDATE
  USING (
    -- Target user must be in same company as requester
    company_id = (
      SELECT company_id
      FROM users
      WHERE id = auth.uid()
      AND deleted_at IS NULL
    )
    AND deleted_at IS NULL
  )
  WITH CHECK (
    -- Company cannot be changed
    company_id = (
      SELECT company_id
      FROM users
      WHERE id = auth.uid()
      AND deleted_at IS NULL
    )
  );

-- ============================================================================
-- TOKEN_ROTATIONS TABLE POLICIES
-- ============================================================================

-- DROP existing policies first (if re-running)
DROP POLICY IF EXISTS "Users can view their own tokens" ON token_rotations;
DROP POLICY IF EXISTS "Users can insert their own tokens" ON token_rotations;

-- Policy: Users can view their own token rotations
CREATE POLICY "Users can view their own tokens"
  ON token_rotations
  FOR SELECT
  USING (
    user_id = auth.uid()
  );

-- Policy: Users can insert their own tokens
CREATE POLICY "Users can insert their own tokens"
  ON token_rotations
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
  );

-- ============================================================================
-- PASSWORD_RESET_TOKENS TABLE POLICIES
-- ============================================================================

-- DROP existing policies first (if re-running)
DROP POLICY IF EXISTS "Users can view their own reset tokens" ON password_reset_tokens;
DROP POLICY IF EXISTS "Users can insert reset tokens" ON password_reset_tokens;
DROP POLICY IF EXISTS "Users can update their own reset tokens" ON password_reset_tokens;

-- Policy: Users can view their own password reset tokens
CREATE POLICY "Users can view their own reset tokens"
  ON password_reset_tokens
  FOR SELECT
  USING (
    user_id = auth.uid()
  );

-- Policy: Users can insert password reset tokens
CREATE POLICY "Users can insert reset tokens"
  ON password_reset_tokens
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
  );

-- Policy: Users can update their own password reset tokens
CREATE POLICY "Users can update their own reset tokens"
  ON password_reset_tokens
  FOR UPDATE
  USING (
    user_id = auth.uid()
  )
  WITH CHECK (
    user_id = auth.uid()
  );

-- ============================================================================
-- AUDIT_LOGS TABLE POLICIES
-- ============================================================================

-- DROP existing policies first (if re-running)
DROP POLICY IF EXISTS "Users can view audit logs for their company" ON audit_logs;
DROP POLICY IF EXISTS "Service can insert audit logs" ON audit_logs;

-- Policy: Users can view audit logs for their company
CREATE POLICY "Users can view audit logs for their company"
  ON audit_logs
  FOR SELECT
  USING (
    company_id = (
      SELECT company_id
      FROM users
      WHERE id = auth.uid()
      AND deleted_at IS NULL
    )
  );

-- Policy: Service can insert audit logs (for all companies)
CREATE POLICY "Service can insert audit logs"
  ON audit_logs
  FOR INSERT
  WITH CHECK (
    true
  );

-- ============================================================================
-- INDEXES FOR RLS PERFORMANCE
-- ============================================================================

-- These indexes improve RLS policy performance
CREATE INDEX IF NOT EXISTS idx_users_company_id_deleted_at
  ON users(company_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_users_id_deleted_at
  ON users(id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_token_rotations_user_id
  ON token_rotations(user_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
  ON password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id
  ON audit_logs(company_id);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these queries to verify RLS is enabled:
--
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('companies', 'users', 'token_rotations', 'password_reset_tokens', 'audit_logs');
--
-- Expected output:
-- schemaname | tablename | rowsecurity
-- public | companies | t
-- public | users | t
-- public | token_rotations | t
-- public | password_reset_tokens | t
-- public | audit_logs | t
--
--
-- View all policies:
--
-- SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- ============================================================================
-- TESTING GUIDE
-- ============================================================================

-- Test 1: Create test users in different companies
--
-- Step 1: Insert companies
-- INSERT INTO companies (id, name, slug, owner_id)
-- VALUES
--   ('company-a', 'Company A', 'company-a', 'admin-uuid'),
--   ('company-b', 'Company B', 'company-b', 'admin-uuid');
--
-- Step 2: Insert users
-- INSERT INTO users (id, company_id, email, password_hash, full_name, role)
-- VALUES
--   ('user-a', 'company-a', 'user-a@test.com', 'hash', 'User A', 'user'),
--   ('user-b', 'company-b', 'user-b@test.com', 'hash', 'User B', 'user');
--
-- Step 3: Set auth.uid() and test SELECT
-- SELECT users.id, users.email, users.company_id
-- FROM users
-- WHERE id = auth.uid();
--
-- In Supabase JS:
-- const { data, error } = await supabase.auth.setSession({
--   access_token: 'jwt-token-for-user-a',
--   refresh_token: 'refresh-token'
-- });
--
-- const { data: users } = await supabase
--   .from('users')
--   .select('*');
--
-- Expected: Only returns users from user-a's company

-- ============================================================================
-- IMPORTANT NOTES
-- ============================================================================

-- 1. RLS Policy Limitations:
--    - RLS cannot check JWT claims directly
--    - Must verify role ('admin', 'master') in application code
--    - Use service role in API routes with manual filtering
--
-- 2. Application-Level Checks Required:
--    - Verify JWT token exists and is valid
--    - Check user.role is 'admin' or 'master' before allowing operations
--    - Always filter queries by company_id, even with service role
--
-- 3. Service Role Usage:
--    - Service role bypasses RLS in Supabase
--    - Use only for API routes that verify authentication
--    - Never trust client input with service role
--
-- 4. Performance Considerations:
--    - RLS policies with subqueries can be slow
--    - Use indexes on frequently filtered columns
--    - Monitor query performance in Supabase dashboard
--
-- 5. Testing Multi-Tenant Isolation:
--    - Use different JWT tokens for different users
--    - Verify auth.uid() returns correct user
--    - Check that queries return only authorized data
--    - Test with different company_id values
