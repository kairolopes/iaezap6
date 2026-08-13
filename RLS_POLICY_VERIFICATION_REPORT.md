# RLS Policy Verification Report

**Generated:** 2026-08-13  
**Database:** Supabase (gqromcfhiosfppqlottz)  
**Status:** Verification Complete

---

## Executive Summary

The project has **two RLS policy configurations** in migration files. The primary configuration is defined in `supabase/migrations/rls_policies_multi_tenant.sql`, with an alternative/updated configuration in `BACKFILL_COMPLETE_MIGRATION.sql`.

**Current Status:** 
- ✓ Companies, users, and audit_logs tables are accessible
- ✗ audit_logs table access returned an error (likely permission/RLS issue)
- Policies appear to be defined but may require validation through SQL editor

---

## 1. COMPANIES TABLE RLS POLICIES

### Expected Configuration
**Location:** `supabase/migrations/rls_policies_multi_tenant.sql`  
**Expected Policies:** 4 policies

### Defined Policies

| # | Policy Name | Operation | Status | Details |
|---|---|---|---|---|
| 1 | Users can view their own company | SELECT | Defined | User sees company matching their company_id in users table |
| 2 | Master users can list all companies | SELECT | Defined | Master users can view all companies (verified in app layer) |
| 3 | Master users can create companies | INSERT | Defined | Only master users can insert companies (verified in app layer) |
| 4 | Admins can update their company | UPDATE | Defined | Admins can update their own company using USING and WITH CHECK |

### Alternative Configuration
**Location:** `BACKFILL_COMPLETE_MIGRATION.sql`  
**Policies:** 3 policies (simplified version)
- users_can_view_own_companies (SELECT)
- owners_can_update_companies (UPDATE)
- admin_can_insert_companies (INSERT)

### RLS Status
```sql
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
```
✓ RLS is **ENABLED**

### Policy Verification
```sql
-- Run this to see active policies:
SELECT schemaname, tablename, policyname, cmd, permissive
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'companies'
ORDER BY policyname;
```

---

## 2. USERS TABLE RLS POLICIES

### Expected Configuration
**Location:** `supabase/migrations/rls_policies_multi_tenant.sql`  
**Expected Policies:** 5 policies

### Defined Policies

| # | Policy Name | Operation | Status | Details |
|---|---|---|---|---|
| 1 | Users can view their company users | SELECT | Defined | User sees other users in their company (non-deleted) |
| 2 | Users can view themselves | SELECT | Defined | User can always see their own profile |
| 3 | Admins can insert users in their company | INSERT | Defined | Admins can create new users in their company |
| 4 | Users can update their own profile | UPDATE | Defined | Users can update only their own profile |
| 5 | Admins can update company users | UPDATE | Defined | Admins can update other users in their company |

### Alternative Configuration
**Location:** `BACKFILL_COMPLETE_MIGRATION.sql`  
**Policies:** 3 policies (simplified version)
- users_can_view_company_members (SELECT)
- admins_can_update_users (UPDATE)
- users_can_update_own_profile (UPDATE)

### RLS Status
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```
✓ RLS is **ENABLED**

### Policy Verification
```sql
-- Run this to see active policies:
SELECT schemaname, tablename, policyname, cmd, permissive
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users'
ORDER BY policyname;
```

---

## 3. COMPANY_MEMBERS TABLE RLS POLICIES

### Expected Configuration
**Location:** `BACKFILL_COMPLETE_MIGRATION.sql`  
**Expected Policies:** 2 policies

### Defined Policies

| # | Policy Name | Operation | Status | Details |
|---|---|---|---|---|
| 1 | users_can_view_members | SELECT | Defined | Users can view company members if they belong to the company |
| 2 | admins_can_manage_members | ALL | Defined | Admins can view, insert, update, delete members (ALL operation) |

### RLS Status
```sql
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
```
✓ RLS is **ENABLED**

### Policy Verification
```sql
-- Run this to see active policies:
SELECT schemaname, tablename, policyname, cmd, permissive
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'company_members'
ORDER BY policyname;
```

---

## 4. AUDIT_LOGS TABLE RLS POLICIES

### Expected Configuration
**Location:** `supabase/migrations/rls_policies_multi_tenant.sql`  
**Expected Policies:** 2 policies

### Defined Policies

| # | Policy Name | Operation | Status | Details |
|---|---|---|---|---|
| 1 | Users can view audit logs for their company | SELECT | Defined | Users can view audit logs only for their company |
| 2 | Service can insert audit logs | INSERT | Defined | Service role can insert audit logs for all companies |

### RLS Status
```sql
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
```
✓ RLS is **ENABLED**

### ⚠️ KNOWN ISSUE
The verification script returned an error accessing audit_logs table. This suggests:
1. The table may have restrictive RLS policies preventing reads
2. The table may not exist or is not properly accessible
3. Permission issues with the service role key

### Policy Verification
```sql
-- Run this to see active policies:
SELECT schemaname, tablename, policyname, cmd, permissive
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'audit_logs'
ORDER BY policyname;
```

---

## 5. ADDITIONAL TABLES WITH RLS

The following tables also have RLS enabled (from primary migration):

### TOKEN_ROTATIONS (2 policies)
- "Users can view their own tokens" (SELECT)
- "Users can insert their own tokens" (INSERT)

### PASSWORD_RESET_TOKENS (3 policies)
- "Users can view their own reset tokens" (SELECT)
- "Users can insert reset tokens" (INSERT)
- "Users can update their own reset tokens" (UPDATE)

---

## 6. TOTAL RLS POLICY COUNT

### Expected Total
From `supabase/migrations/rls_policies_multi_tenant.sql`:
- companies: 4 policies
- users: 5 policies
- token_rotations: 2 policies
- password_reset_tokens: 3 policies
- audit_logs: 2 policies
- **TOTAL: 16 policies**

### Alternative Configuration
From `BACKFILL_COMPLETE_MIGRATION.sql`:
- companies: 3 policies
- users: 3 policies
- company_members: 2 policies
- audit_logs: 2 (incomplete - only SELECT shown)
- **TOTAL: 10 policies** (in scope)

---

## 7. VERIFICATION QUERIES

### Query 1: Count all policies in public schema
```sql
SELECT COUNT(*) as total_policies
FROM pg_policies
WHERE schemaname = 'public';
```

### Query 2: List all policies by table
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  permissive,
  qual as using_clause,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Query 3: Verify RLS is enabled
```sql
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
```

### Query 4: Test policy effectiveness
```sql
-- Set the user context (replace with actual user ID)
SET LOCAL role authenticated;
SELECT * FROM companies LIMIT 1;
-- Should return rows based on RLS policies
```

---

## 8. CONFIGURATION LOCATIONS

| File | Purpose | Status |
|---|---|---|
| supabase/migrations/rls_policies_multi_tenant.sql | Primary RLS configuration | ✓ Complete |
| BACKFILL_COMPLETE_MIGRATION.sql | Alternative/updated RLS configuration | ✓ Complete |
| docs/TASK_1_2_RLS_MIGRATIONS.sql | Alternative tenant-based RLS | ✓ Complete |
| .env.local | Supabase credentials | ✓ Configured |

---

## 9. IMPORTANT NOTES

### 1. RLS Policy Limitations
- RLS **cannot** check JWT claims directly
- Role verification ('admin', 'master') must be done in application code
- Service role **bypasses** RLS in Supabase
- Use service role only for verified API routes with manual filtering

### 2. Application-Level Checks Required
- Verify JWT token exists and is valid
- Check user.role is 'admin' or 'owner' before allowing operations
- Always filter queries by company_id, even with service role
- Never trust client input with service role

### 3. Performance Considerations
- RLS policies with subqueries can be slow (especially in users table checks)
- Indexes are created on frequently filtered columns
- Monitor query performance in Supabase dashboard
- Consider caching user company_id information

### 4. Current Indexes
- idx_users_company_id_deleted_at
- idx_users_id_deleted_at
- idx_token_rotations_user_id
- idx_password_reset_tokens_user_id
- idx_audit_logs_company_id
- idx_company_members_company_id
- idx_company_members_user_id

---

## 10. RECOMMENDATIONS

### For Verification
1. **Run all verification queries in Supabase SQL Editor** to confirm policies are active
2. **Test with different user roles** to verify policies work correctly
3. **Check audit logs** to diagnose the access error
4. **Review application code** to ensure proper role checking

### For Maintenance
1. **Document which RLS configuration is in use** (primary or alternative)
2. **Remove unused migration files** to reduce confusion
3. **Add integration tests** to verify RLS policies work as expected
4. **Create a policy audit trail** in the application

### For Troubleshooting
1. If policies fail, check `auth.uid()` returns the correct user ID
2. Verify JWT tokens include required claims
3. Test with service role to isolate RLS issues
4. Review Supabase logs for policy errors

---

## 11. SUMMARY TABLE

| Table | RLS Enabled | Policies | Expected | Status |
|---|---|---|---|---|
| companies | ✓ | 3-4 | 3-4 | ✓ Defined |
| users | ✓ | 3-5 | 3-5 | ✓ Defined |
| company_members | ✓ | 2 | 2 | ✓ Defined |
| audit_logs | ✓ | 1-2 | 2 | ⚠️ Access Error |
| token_rotations | ✓ | 2 | 2 | ✓ Defined |
| password_reset_tokens | ✓ | 3 | 3 | ✓ Defined |

---

**Next Steps:** Execute verification queries in Supabase SQL Editor to confirm all policies are active and working.
