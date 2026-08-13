# Multi-Tenant Testing Quick Start

## Installation

```bash
# Install test dependencies
npm install --save-dev jest @types/jest ts-jest

# Verify jest.config.js exists in project root
ls jest.config.js
```

## Running Tests

```bash
# Run all tests
npm test

# Run only multi-tenant isolation tests
npm run test:multi-tenant

# Run with coverage report
npm run test:coverage

# Run in watch mode (reruns on file changes)
npm run test:watch

# Debug tests
npm run test:debug
# Then open chrome://inspect in Chrome browser
```

## Test File Structure

```
tests/
├── multi-tenant.test.ts          # All isolation tests
├── MULTI_TENANT_TESTING_GUIDE.md # Full documentation
└── QUICK_START.md               # This file
```

## What Gets Tested

### Test 1: Company Data Isolation
```typescript
// Company A user can only see Company A data
const companyData = getCompanyData(userA.id);
expect(companyData.id).toBe(companyA.id); // ✓ PASS
```

**Tests:** Data cannot leak between companies

### Test 2: Admin User Management
```typescript
// Admin can see and manage users in their company
const users = getCompanyUsers(adminA.id);
expect(users.find(u => u.email === 'user@company-a.com')).toBeDefined(); // ✓
expect(users.find(u => u.email === 'user@company-b.com')).toBeUndefined(); // ✓
```

**Tests:** Admins can only manage their own company users

### Test 3: Master Company Creation
```typescript
// Only master users can create companies
const companies = getAllCompanies(masterUser.id);
expect(companies.length).toBeGreaterThan(0); // ✓ Master can list all

const adminCompanies = getAllCompanies(adminA.id);
expect(adminCompanies.length).toBe(0); // ✓ Admin cannot list all
```

**Tests:** Only master users can perform master operations

### Test 4: Admin Route Access
```typescript
// Only admin/master can access admin routes
const can = canAccessAdminRoutes(regularUser.id);
expect(can).toBe(false); // ✓ Regular user blocked

const adminCan = canAccessAdminRoutes(adminA.id);
expect(adminCan).toBe(true); // ✓ Admin allowed
```

**Tests:** Authorization middleware works correctly

### Test 5: RLS Policies
```typescript
// RLS policies enforce isolation at database level
const usersForA = getCompanyUsers(userA.id);
const usersForB = getCompanyUsers(userB.id);

expect(usersForA).not.toContain(usersForB[0]); // ✓ No cross-contamination
```

**Tests:** Database-level isolation works correctly

## Test Data Structure

Each test uses this structure:

```typescript
interface TestUser {
  id: string;              // User UUID
  email: string;           // user@company.com
  companyId: string;       // Which company they belong to
  role: 'user' | 'admin' | 'master';  // Their role
  token: string;           // JWT token for authentication
}

interface TestCompany {
  id: string;              // Company UUID
  name: string;            // Company Name
  slug: string;            // company-slug
  ownerId: string;         // Creator user ID
}
```

## Test Data Setup

```typescript
// Before each test
beforeEach(() => {
  // Creates:
  // - 2 companies (A and B)
  // - 1 master user
  // - 2 admins (one per company)
  // - 4 regular users (2 per company)
  testData = setupTestData();
});

// After each test
afterEach(() => {
  // Clear all test data
  mockDatabase.clearAll();
});
```

## Using Test Utilities

### generateToken(userId, email, companyId, role)
Create a JWT token for testing:

```typescript
const token = generateToken(
  'user-uuid',
  'user@example.com',
  'company-uuid',
  'admin'
);
```

### verifyToken(token)
Decode and verify a token:

```typescript
const payload = verifyToken(token);
// {
//   sub: 'user-uuid',
//   email: 'user@example.com',
//   company_id: 'company-uuid',
//   role: 'admin',
//   iat: ...,
//   exp: ...
// }
```

### getCompanyUsers(userId)
Get users visible to a specific user (simulates RLS):

```typescript
const users = getCompanyUsers(userId);
// Returns array of TestUser objects from same company
```

### getCompanyData(userId)
Get company visible to a user (simulates RLS):

```typescript
const company = getCompanyData(userId);
// Returns TestCompany object for user's company
```

### canAccessAdminRoutes(userId)
Check if user can access admin endpoints:

```typescript
const canAccess = canAccessAdminRoutes(userId);
// Returns boolean
```

## Common Test Patterns

### Test 1: User Isolation
```typescript
test('users from different companies cannot see each other', () => {
  const usersForA = getCompanyUsers(testData.companyAUser1.id);
  const usersForB = getCompanyUsers(testData.companyBUser1.id);

  const hasUserB = usersForA.some(u => u.id === testData.companyBUser1.id);
  expect(hasUserB).toBe(false);
});
```

### Test 2: Role-Based Access
```typescript
test('only admins can manage users', () => {
  const userCanManage = canManageUsers(testData.companyAUser1.id);
  expect(userCanManage).toBe(false);

  const adminCanManage = canManageUsers(testData.companyAAdminUser.id);
  expect(adminCanManage).toBe(true);
});
```

### Test 3: Token Validation
```typescript
test('invalid token is rejected', () => {
  const invalidToken = 'not.a.valid.token';
  const payload = verifyToken(invalidToken);
  expect(payload).toBeNull();
});
```

### Test 4: Cross-Company Attack
```typescript
test('user cannot modify other company data', () => {
  // Even if user A knows user B's ID, RLS blocks modification
  const userBId = testData.companyBUser1.id;
  const companyAId = testData.companyA.id;

  // User A is in Company A, trying to access Company B user
  const canModify = mockDatabase.users.get(userBId)?.companyId === companyAId;
  expect(canModify).toBe(false);
});
```

## Debugging Failed Tests

### Step 1: Read the error message
```
FAIL tests/multi-tenant.test.ts
  ● Company A users cannot see Company B data
    ✕ Company A user should only see Company A data (5ms)

    Expected: {"id":"company-a-uuid","name":"Company A",...}
    Received: {"id":"company-b-uuid","name":"Company B",...}
```

### Step 2: Check the test data
```typescript
// Print test data to see what was created
console.log('Test data:', testData);

// Check specific user
console.log('User company:', mockDatabase.users.get(testData.companyAUser1.id)?.companyId);
```

### Step 3: Verify test utility
```typescript
// Test the utility function directly
const users = getCompanyUsers(testData.companyAUser1.id);
console.log('Users for user A:', users.map(u => u.email));
// Should only show users from Company A
```

### Step 4: Run specific test
```bash
# Run only the failing test
npx jest tests/multi-tenant.test.ts -t "Company A user should only see Company A data"

# Run with verbose output
npx jest tests/multi-tenant.test.ts -t "Company A user" --verbose
```

## Extending the Tests

### Add a new test to existing suite
```typescript
describe('Company Data Isolation (RLS Policy)', () => {
  // ... existing tests ...

  test('custom isolation test', () => {
    const data = getCompanyData(testData.companyAUser1.id);
    expect(data).toBeDefined();
    // Add your assertion
  });
});
```

### Add a new test suite
```typescript
describe('Custom Multi-Tenant Feature', () => {
  test('new feature requirement 1', () => {
    // Test implementation
  });

  test('new feature requirement 2', () => {
    // Test implementation
  });
});
```

## Integration with RLS Policies

These tests verify that the following RLS policies work:

1. **Companies Table:**
   - Users see only their own company
   - Master users see all companies
   - Admins can update their company

2. **Users Table:**
   - Users see only their company's users
   - Users can see themselves
   - Admins can manage company users

3. **Token Rotations:**
   - Users see only their tokens
   - Users can insert their tokens

4. **Password Reset:**
   - Users see only their reset tokens
   - Users can manage their reset tokens

5. **Audit Logs:**
   - Users see logs from their company
   - Service can insert logs

**All policies are defined in:** `supabase/migrations/rls_policies_multi_tenant.sql`

## Production Deployment

### Before deploying:
```bash
# 1. Run all tests
npm test

# 2. Check test coverage
npm run test:coverage
# Target: >80% coverage on admin routes

# 3. Review RLS policies
cat supabase/migrations/rls_policies_multi_tenant.sql

# 4. Test with real Supabase instance
# - Set SUPABASE_URL and SUPABASE_ANON_KEY
# - Run integration tests against staging
```

### Deploying RLS policies:
```bash
# 1. Run migration in Supabase dashboard
# 2. Verify policies are active
# 3. Test with real users
# 4. Monitor for performance issues
```

## Common Issues

| Issue | Solution |
|-------|----------|
| `SUPABASE_SERVICE_ROLE_KEY not set` | Set in environment: `export SUPABASE_SERVICE_ROLE_KEY="test-key"` |
| `TypeError: generateToken is not a function` | Import from test file: `import { generateToken } from './multi-tenant.test'` |
| Tests timeout | Increase timeout: `jest.setTimeout(30000)` |
| Mock database not clearing | Call `mockDatabase.clearAll()` in afterEach |

## Additional Resources

- Full Guide: `tests/MULTI_TENANT_TESTING_GUIDE.md`
- RLS Policies: `supabase/migrations/rls_policies_multi_tenant.sql`
- API Implementation: `src/app/api/admin/`
- Auth Middleware: `src/lib/admin/auth.ts`
- Admin Types: `src/types/admin.ts`
