# Multi-Tenant Isolation Testing Guide

## Overview

This guide explains how to run comprehensive multi-tenant data isolation tests for the IAeZap platform. These tests verify that the Row-Level Security (RLS) policies and JWT authentication properly isolate data between different companies.

## What Gets Tested

### Test Scenarios

1. **User Creation Across Companies**
   - Create two companies (Company A and Company B)
   - Create one user in each company
   - Verify users are properly associated with their companies

2. **JWT Token Generation**
   - Generate JWT access tokens with company_id claims
   - Verify tokens contain correct user_id and company_id
   - Verify tokens have proper expiration

3. **Data Isolation via RLS**
   - User A from Company A can see users in Company A
   - User B from Company B can see users in Company B
   - User A CANNOT see User B (different companies)
   - User B CANNOT see User A (different companies)

4. **Cross-Tenant Access Prevention**
   - User A tries to read Company B data → BLOCKED
   - User A tries to update Company B user → BLOCKED
   - User B tries to delete Company A user → BLOCKED

5. **Audit Trail Isolation**
   - Create audit logs for Company A
   - User A can read Company A audit logs
   - User B CANNOT read Company A audit logs

## Prerequisites

### Required Environment Variables

Ensure your `.env.local` file contains:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# JWT Configuration (RS256)
JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----

JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----
...
-----END PUBLIC KEY-----

# Optional: JWT Configuration
JWT_ISSUER=iaezap
JWT_AUDIENCE=iaezap-api
JWT_ACCESS_TOKEN_EXPIRY=3600
JWT_REFRESH_TOKEN_EXPIRY=604800

NODE_ENV=development
```

### Generating JWT Keys

If you haven't generated JWT keys yet, run:

```bash
npm run generate-jwt-keys
```

This will generate RSA keys and output them to the console. Copy them to your `.env.local` file.

### Database Setup

Ensure the database migrations have been applied:

1. `001_create_companies_users_roles.sql` - Creates base tables and indexes
2. `002_add_cnpj_to_companies.sql` - Adds CNPJ support
3. `003_complete_multitenant_migration.sql` - Enables RLS policies

Check the Supabase dashboard to verify migrations are applied.

## Running Tests

### Option 1: Using npm Script

```bash
# Install dependencies
npm install

# Run the multi-tenant isolation tests
npm run test:multi-tenant
```

### Option 2: Using the Shell Script

```bash
# Make script executable (first time only)
chmod +x tests/run-isolation-test.sh

# Run the tests
bash tests/run-isolation-test.sh
```

### Option 3: Using ts-node Directly

```bash
npx ts-node -O '{"module":"commonjs"}' \
  -P tsconfig.json \
  tests/multi-tenant-isolation.test.ts
```

## Understanding Test Output

### Successful Test Run

```
========================================
MULTI-TENANT ISOLATION TEST SUITE
========================================

PHASE 1: Creating Test Companies...

✓ PASS: Create Company A
✓ PASS: Create Company B

...

========================================
TEST RESULTS SUMMARY
========================================

Total Tests: 14
Passed: 14 (100.00%)
Failed: 0 (0.00%)

========================================
ISOLATION VALIDATION RESULTS
========================================

✓ User A cannot see User B: PASSED
✓ User B cannot see User A: PASSED
✓ User A cannot read Company B data via RLS: PASSED
✓ RLS prevents User A from updating Company B users: PASSED
✓ RLS prevents User B from deleting Company A users: PASSED

Overall Isolation Status: PASSED ✓
```

### Failed Test Run

If tests fail, you'll see:

```
✗ FAIL: User A cannot see User B - Data isolation failed

========================================
TEST RESULTS SUMMARY
========================================

Total Tests: 14
Passed: 13 (92.86%)
Failed: 1 (7.14%)

Failed Tests:
  - User A cannot see User B: Data isolation failed

========================================
ISOLATION VALIDATION RESULTS
========================================

✗ User A cannot see User B: FAILED
...

Overall Isolation Status: FAILED ✗
```

## Test Phases Explained

### PHASE 1: Create Test Companies

```
Action: INSERT INTO companies (name, slug, ...) VALUES (...)
Expected: Two unique companies with IDs
Tests: 2
- Create Company A ✓
- Create Company B ✓
```

### PHASE 2: Create Test Users

```
Action: INSERT INTO users (company_id, email, ...) VALUES (...)
Expected: User A in Company A, User B in Company B
Tests: 2
- Create User A in Company A ✓
- Create User B in Company B ✓
```

### PHASE 3: Generate JWT Tokens

```
Action: Use JWT library to sign tokens with RS256
Payload: { user_id, company_id, email, role }
Expected: Valid JWTs with company_id claims
Tests: 2
- Generate JWT for User A ✓
- Generate JWT for User B ✓
```

### PHASE 4: Verify JWT Claims

```
Action: Verify token signature and decode claims
Expected: Correct company_id and user_id in each token
Tests: 3
- Verify User A JWT claims ✓
- Verify User B JWT claims ✓
- User A and User B have different tokens ✓
```

### PHASE 5: Test RLS Policies

```
Action: Query users table, checking company isolation
Expected: Users only see members of their own company
Tests: 4
- User A can see users in Company A ✓
- User B can see users in Company B ✓
- User A cannot see User B ✓
- User B cannot see User A ✓
```

### PHASE 6: Test Cross-Tenant Prevention

```
Action: Attempt unauthorized READ/UPDATE/DELETE operations
Expected: All operations blocked by RLS
Tests: 3
- User A cannot read Company B data via RLS ✓
- RLS prevents User A from updating Company B users ✓
- RLS prevents User B from deleting Company A users ✓
```

### PHASE 7: Test Audit Logs

```
Action: Create audit logs, test visibility
Expected: Logs isolated by company_id
Tests: 3
- Create audit log for Company A ✓
- User A can read Company A audit logs ✓
- User B cannot read Company A audit logs ✓
```

### PHASE 8: Cleanup

```
Action: DELETE test users and companies
Expected: All test data removed
Tests: 2
- Delete test users ✓
- Delete test companies ✓
```

## Troubleshooting

### Error: "Missing Supabase credentials"

**Solution**: Ensure `.env.local` contains:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Error: "Missing JWT keys"

**Solution**: Generate JWT keys:
```bash
npm run generate-jwt-keys
```

Then add them to `.env.local`:
```env
JWT_PRIVATE_KEY=...
JWT_PUBLIC_KEY=...
```

### Error: "Cannot connect to database"

**Solutions**:
1. Verify Supabase URL is correct
2. Check service role key is valid
3. Verify network connectivity
4. Check Supabase project status

### Error: "RLS policy violations not detected"

This might indicate RLS policies aren't properly configured. Check:

1. RLS is enabled on tables:
   ```sql
   SELECT tablename, rowsecurity FROM pg_class
   WHERE relname IN ('companies', 'users', 'audit_logs');
   ```

2. Policies exist:
   ```sql
   SELECT * FROM pg_policies
   WHERE schemaname = 'public'
   ORDER BY tablename;
   ```

3. Run migrations again:
   - Check Supabase SQL Editor
   - Execute migration 003_complete_multitenant_migration.sql

## What Each Test Validates

| Test | Validates | Why Important |
|------|-----------|---------------|
| Create Companies | Company creation works | Foundation for multi-tenancy |
| Create Users | User creation per company | Proper tenant association |
| Generate JWT | Token signing with company_id | Auth includes tenant context |
| Verify JWT Claims | Token payload correctness | Backend can extract company_id |
| User isolation (SELECT) | RLS blocks cross-tenant reads | Data privacy |
| User isolation (UPDATE) | RLS blocks cross-tenant writes | Data integrity |
| Audit log isolation | RLS on audit tables | Compliance and auditability |

## Test Results Summary

### Expected Results

```
✓ All 14 tests should PASS
✓ 100% pass rate
✓ 0 failures
✓ Overall Isolation Status: PASSED
```

### What Each Result Means

| Result | Meaning |
|--------|---------|
| ✓ PASS | Test executed successfully, expectation met |
| ✗ FAIL | Test executed but expectation not met, isolation compromised |
| ERROR | Test failed to execute (connection, auth, etc.) |

## Security Implications

### If All Tests Pass ✓

Your multi-tenant system is properly isolated:
- Users cannot see other companies' data
- Database enforces isolation at RLS layer
- JWT tokens carry tenant context
- Writes across tenants are blocked

**Status: SAFE FOR PRODUCTION**

### If Any Test Fails ✗

Your system has isolation issues:
- Data may be leaking between tenants
- RLS policies may not be properly enforced
- Authentication may not include tenant context

**Status: DO NOT DEPLOY - Fix issues before production**

## Next Steps

After confirming all tests pass:

1. **Review the detailed report**: `MULTI_TENANT_TEST_REPORT.md`
2. **Run tests regularly**: Add to CI/CD pipeline
3. **Monitor in production**: Watch audit logs for RLS violations
4. **Update tests**: Add tests for custom tables with company_id
5. **Security review**: Have security team review RLS policies

## Running Tests in CI/CD

### GitHub Actions Example

```yaml
name: Multi-Tenant Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run generate-jwt-keys
      - run: npm run test:multi-tenant
```

### GitLab CI Example

```yaml
test:multi-tenant:
  image: node:18
  script:
    - npm install
    - npm run generate-jwt-keys
    - npm run test:multi-tenant
```

## Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Row Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Multi-Tenancy](https://owasp.org/www-project-web-security-testing-guide/stable/4-Web_Application_Security_Testing/09-Testing_for_Weak_Cryptography/04-Testing_for_Weak_Encryption.html)

## Support

For issues or questions:

1. Check error messages in test output
2. Review `MULTI_TENANT_TEST_REPORT.md` for detailed information
3. Check Supabase logs in the dashboard
4. Review database migration status
5. Verify environment variables are correct

---

**Last Updated:** August 13, 2026  
**Version:** 1.0  
**Maintainer:** IAeZap Development Team
