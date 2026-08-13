-- ============================================================================
-- RLS POLICY VERIFICATION SCRIPT
-- Run this in Supabase SQL Editor to verify all RLS policies
-- ============================================================================

-- Query 1: Total policy count in public schema
SELECT COUNT(*) as total_policies
FROM pg_policies
WHERE schemaname = 'public';

-- Query 2: Total policy count by expected tables
SELECT COUNT(*) as total_expected_policies
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('companies', 'users', 'company_members', 'audit_logs');

-- Query 3: RLS Status for all tables
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'companies',
  'users',
  'company_members',
  'audit_logs',
  'token_rotations',
  'password_reset_tokens'
)
ORDER BY tablename;

-- Query 4: All policies for COMPANIES table
SELECT
  'COMPANIES' as table_name,
  policyname,
  cmd as operation,
  permissive,
  CASE WHEN qual IS NOT NULL THEN 'Yes' ELSE 'No' END as has_using_clause,
  CASE WHEN with_check IS NOT NULL THEN 'Yes' ELSE 'No' END as has_with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'companies'
ORDER BY policyname;

-- Query 5: All policies for USERS table
SELECT
  'USERS' as table_name,
  policyname,
  cmd as operation,
  permissive,
  CASE WHEN qual IS NOT NULL THEN 'Yes' ELSE 'No' END as has_using_clause,
  CASE WHEN with_check IS NOT NULL THEN 'Yes' ELSE 'No' END as has_with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users'
ORDER BY policyname;

-- Query 6: All policies for COMPANY_MEMBERS table
SELECT
  'COMPANY_MEMBERS' as table_name,
  policyname,
  cmd as operation,
  permissive,
  CASE WHEN qual IS NOT NULL THEN 'Yes' ELSE 'No' END as has_using_clause,
  CASE WHEN with_check IS NOT NULL THEN 'Yes' ELSE 'No' END as has_with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'company_members'
ORDER BY policyname;

-- Query 7: All policies for AUDIT_LOGS table
SELECT
  'AUDIT_LOGS' as table_name,
  policyname,
  cmd as operation,
  permissive,
  CASE WHEN qual IS NOT NULL THEN 'Yes' ELSE 'No' END as has_using_clause,
  CASE WHEN with_check IS NOT NULL THEN 'Yes' ELSE 'No' END as has_with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'audit_logs'
ORDER BY policyname;

-- Query 8: Summary by table and operation type
SELECT
  tablename,
  cmd as operation,
  COUNT(*) as policy_count,
  STRING_AGG(policyname, ', ' ORDER BY policyname) as policy_names
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('companies', 'users', 'company_members', 'audit_logs')
GROUP BY tablename, cmd
ORDER BY tablename, cmd;

-- Query 9: Complete policy details for all tables
SELECT
  tablename,
  policyname,
  cmd as operation,
  permissive,
  qual as using_condition,
  with_check as check_condition
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('companies', 'users', 'company_members', 'audit_logs')
ORDER BY tablename, policyname;

-- Query 10: Policy count summary
SELECT
  CASE
    WHEN tablename = 'companies' THEN 'COMPANIES'
    WHEN tablename = 'users' THEN 'USERS'
    WHEN tablename = 'company_members' THEN 'COMPANY_MEMBERS'
    WHEN tablename = 'audit_logs' THEN 'AUDIT_LOGS'
  END as table_name,
  COUNT(*) as active_policies,
  CASE
    WHEN tablename = 'companies' THEN 3
    WHEN tablename = 'users' THEN 3
    WHEN tablename = 'company_members' THEN 2
    WHEN tablename = 'audit_logs' THEN 2
  END as expected_policies,
  CASE
    WHEN COUNT(*) = CASE
      WHEN tablename = 'companies' THEN 3
      WHEN tablename = 'users' THEN 3
      WHEN tablename = 'company_members' THEN 2
      WHEN tablename = 'audit_logs' THEN 2
    END THEN '✓ MATCH'
    ELSE '⚠️ MISMATCH'
  END as status
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('companies', 'users', 'company_members', 'audit_logs')
GROUP BY tablename
ORDER BY tablename;

-- Query 11: Test RLS functionality - companies
-- Replace with actual user ID to test
-- SELECT COUNT(*) as accessible_companies FROM companies;

-- Query 12: Test RLS functionality - users
-- Replace with actual user ID to test
-- SELECT COUNT(*) as accessible_users FROM users;

-- Query 13: Test RLS functionality - audit_logs
-- Replace with actual user ID to test
-- SELECT COUNT(*) as accessible_audit_logs FROM audit_logs;

-- Query 14: Check for policies with issues
SELECT
  tablename,
  policyname,
  cmd as operation,
  CASE
    WHEN qual IS NULL AND cmd IN ('SELECT', 'UPDATE', 'DELETE') THEN 'WARNING: No USING clause'
    WHEN with_check IS NULL AND cmd IN ('INSERT', 'UPDATE') THEN 'WARNING: No WITH CHECK clause'
    ELSE 'OK'
  END as validation_status
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('companies', 'users', 'company_members', 'audit_logs');

-- ============================================================================
-- END OF VERIFICATION SCRIPT
-- ============================================================================
-- Run all queries above to verify RLS policies are active and correct.
-- Expected results:
-- - Total policies: 10 (for 4 tables)
-- - companies: 3 policies
-- - users: 3 policies
-- - company_members: 2 policies
-- - audit_logs: 2 policies
-- ============================================================================
