# Multi-Tenant Isolation Testing Guide for IAeZap

This guide explains the multi-tenant isolation tests, how they work, and how to implement the corresponding Row Level Security (RLS) policies in Supabase.

## Overview

The multi-tenant architecture ensures that:
1. **Company A users cannot see Company B data** - Data isolation via RLS policies
2. **Admin can only manage users in their company** - Role-based access control (RBAC)
3. **Master can create companies** - Master-only operations
4. **Regular users cannot access /api/admin routes** - Authorization middleware
5. **RLS policies work correctly** - Database-level security

## Test Structure

### Test File: `tests/multi-tenant.test.ts`

The test file contains the following test suites:

#### 1. Company Data Isolation (RLS Policy)
Tests that users can only see and access their own company's data:
- Company A user sees only Company A data
- Company B user sees only Company B data
- Cross-company queries are blocked
- Isolation is symmetric between companies

**Related RLS Policies:**
```sql
CREATE POLICY "Users can view their own company"
  ON companies FOR SELECT
  USING (id IN (SELECT company_id FROM users WHERE id = auth.uid()));
```

#### 2. Admin User Management Isolation
Tests that admins can only manage users within their company:
- Company A admin sees only Company A users
- Company B admin sees only Company B users
- Admins cannot manage users from other companies
- Only admins can manage users (RBAC)

**Related RLS Policies:**
```sql
CREATE POLICY "Admins can view users in their company"
  ON users FOR SELECT
  USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    OR role = 'admin'
  );
```

#### 3. Master User Company Creation
Tests that only master users can create and list all companies:
- Master user can list all companies
- Master user has 'master' role in JWT token
- Regular admins cannot list all companies
- Regular users cannot create companies

**Authorization Check (Application Level):**
```typescript
if (user.role !== 'master') {
  return NextResponse.json(
    { error: 'Only master users can create companies' },
    { status: 403 }
  );
}
```

#### 4. Admin Route Access Control
Tests that only admin and master users can access admin endpoints:
- Regular users cannot access /api/admin routes
- Admin users can access admin routes
- Master users can access admin routes
- Invalid tokens are rejected

**Middleware Check:**
```typescript
if (!payload || (payload.role !== 'admin' && payload.role !== 'master')) {
  return NextResponse.json(
    { error: 'Forbidden' },
    { status: 403 }
  );
}
```

#### 5. Row Level Security (RLS) Policy Verification
Tests that RLS policies function correctly:
- RLS prevents SELECT from other companies
- RLS prevents INSERT into other companies
- RLS prevents UPDATE of other company users
- RLS allows SELECT of same company users
- RLS allows admin to manage users in their company

## Setup Instructions

### 1. Install Dependencies

```bash
npm install --save-dev jest @types/jest ts-jest
```

### 2. Verify jest.config.js

The `jest.config.js` file is already configured. Review these key settings:

```javascript
{
  testEnvironment: 'node',
  preset: 'ts-jest',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  }
}
```

### 3. Update package.json Scripts

Add test scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:multi-tenant": "jest tests/multi-tenant.test.ts",
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand"
  }
}
```

## Running the Tests

### Run all tests
```bash
npm test
```

### Run only multi-tenant tests
```bash
npm run test:multi-tenant
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Debug tests
```bash
npm run test:debug
```

Then open `chrome://inspect` in Chrome to debug.

## Implementing RLS Policies in Supabase

To fully implement the multi-tenant isolation, enable and configure RLS policies:

### 1. Enable RLS on Tables

```sql
-- Enable RLS on companies table
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on other company-specific tables
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
```

### 2. Companies Table RLS Policies

```sql
-- Policy: Users can view their own company
CREATE POLICY "Users can view their own company"
  ON companies FOR SELECT
  USING (
    -- User can see their company
    id = (SELECT company_id FROM users WHERE id = auth.uid() AND deleted_at IS NULL)
    -- OR Master users can see all companies
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'master'
      AND deleted_at IS NULL
    )
  );

-- Policy: Master users can create companies
CREATE POLICY "Master users can create companies"
  ON companies FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'master'
      AND deleted_at IS NULL
    )
  );

-- Policy: Admins can update their company
CREATE POLICY "Admins can update their company"
  ON companies FOR UPDATE
  USING (
    id = (SELECT company_id FROM users WHERE id = auth.uid() AND deleted_at IS NULL)
  )
  WITH CHECK (
    id = (SELECT company_id FROM users WHERE id = auth.uid() AND deleted_at IS NULL)
  );
```

### 3. Users Table RLS Policies

```sql
-- Policy: Users can view their own company's users
CREATE POLICY "Users can view their company users"
  ON users FOR SELECT
  USING (
    -- User can see users in their company
    company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND deleted_at IS NULL)
    -- AND user is not deleted
    AND deleted_at IS NULL
  );

-- Policy: Users can view themselves
CREATE POLICY "Users can view themselves"
  ON users FOR SELECT
  USING (
    id = auth.uid()
  );

-- Policy: Admins can insert users in their company
CREATE POLICY "Admins can insert users in their company"
  ON users FOR INSERT
  WITH CHECK (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND deleted_at IS NULL)
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
      AND deleted_at IS NULL
    )
  );

-- Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (
    id = auth.uid() AND deleted_at IS NULL
  )
  WITH CHECK (
    id = auth.uid() AND deleted_at IS NULL
  );

-- Policy: Admins can update users in their company
CREATE POLICY "Admins can update company users"
  ON users FOR UPDATE
  USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND deleted_at IS NULL)
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
      AND deleted_at IS NULL
    )
    AND deleted_at IS NULL
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid() AND deleted_at IS NULL)
  );
```

### 4. Service Role Bypass

When using service role keys in API routes, RLS is bypassed. Always:
1. Verify the JWT token manually
2. Check user's company_id and role
3. Explicitly filter queries by company_id
4. Never return data from other companies

Example:
```typescript
// Get current user's company
const { data: user } = await supabase
  .from('users')
  .select('company_id, role')
  .eq('id', userId)
  .single();

if (!user) throw new Error('User not found');

// Filter by company
const { data: companyUsers } = await supabase
  .from('users')
  .select('*')
  .eq('company_id', user.company_id)  // IMPORTANT: Filter by company
  .eq('deleted_at', null);
```

## Test Coverage Details

### Test 1: Company Data Isolation
- **Lines Tested:** 87-115
- **Purpose:** Verify users can only access their own company data
- **Key Assertions:**
  - `getCompanyData(userId)` returns only user's company
  - Different users see different companies
  - Cross-company access is blocked

### Test 2: Admin User Management
- **Lines Tested:** 120-165
- **Purpose:** Verify admins can only manage users in their company
- **Key Assertions:**
  - Admin sees only company users
  - Non-admins cannot manage users
  - Company isolation is enforced for user lists

### Test 3: Master Company Creation
- **Lines Tested:** 170-210
- **Purpose:** Verify only master users can create companies
- **Key Assertions:**
  - Master can list all companies
  - Master has 'master' role in JWT
  - Regular users cannot list all companies
  - Non-master users cannot create companies

### Test 4: Admin Route Access
- **Lines Tested:** 215-260
- **Purpose:** Verify authorization on admin endpoints
- **Key Assertions:**
  - Regular users rejected with 403
  - Admin users allowed with 200
  - Token role is checked
  - Invalid tokens are rejected

### Test 5: RLS Policy Verification
- **Lines Tested:** 265-330
- **Purpose:** Verify RLS policies work correctly
- **Key Assertions:**
  - RLS blocks cross-company SELECT
  - RLS prevents cross-company INSERT
  - RLS allows same-company access
  - Company-user relationships are enforced

## Advanced Isolation Tests

The test file includes additional tests for:
- **Cross-Company Contamination Prevention** - Can't modify other company users
- **Database Integrity** - Unique constraints, cascade deletes, foreign keys
- **JWT Token Security** - Signature verification, expiration, claim validation

## Troubleshooting

### Tests fail with "SUPABASE_SERVICE_ROLE_KEY not set"
The tests use a mock key. Ensure it's set in your test environment:
```bash
export SUPABASE_SERVICE_ROLE_KEY="test-secret-key-for-jwt-verification"
npm test
```

### RLS policies seem to not work
1. Verify `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` was executed
2. Check that policies are created with correct syntax
3. Use Supabase dashboard to view active policies
4. Test with authenticated role, not service role

### Users can see other companies' data
1. Check that RLS policies are enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
2. Verify the `company_id` filter is in all queries
3. Check that the user's `company_id` is set correctly in the database
4. Review auth middleware to ensure JWT `company_id` matches database

## Integration with CI/CD

Add to your GitHub Actions workflow:

```yaml
- name: Run multi-tenant tests
  run: npm run test:multi-tenant

- name: Generate coverage report
  run: npm run test:coverage

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

## Best Practices

1. **Always filter by company_id** - Even if using service role, manually filter queries
2. **Check user role in middleware** - Verify role before allowing operations
3. **Log all admin operations** - Create audit logs for compliance
4. **Test with different roles** - Include user, admin, and master tests
5. **Rotate credentials regularly** - Change JWT signing keys periodically
6. **Monitor RLS performance** - Large WHERE clauses can be slow
7. **Use database indexes** - Create indexes on frequently filtered columns

## Security Checklist

- [ ] RLS is enabled on all company-related tables
- [ ] All admin routes check user role
- [ ] JWT token is validated before processing
- [ ] company_id filter is applied to all queries
- [ ] Soft deletes use `deleted_at` column
- [ ] Audit logs are created for admin operations
- [ ] Cross-company attacks are tested
- [ ] Token expiration is enforced
- [ ] Service role is only used for creating initial records

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Multi-Tenant SaaS Design](https://supabase.com/docs/guides/auth/multi-tenant-authorization)
- [IAeZap Implementation Guides](../MASTER_ADMIN_ENDPOINTS_DELIVERY.md)
