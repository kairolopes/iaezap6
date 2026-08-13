# IAeZap Integration Tests - Quick Reference

## Test Files Created

| File | Purpose | Size |
|------|---------|------|
| `end-to-end.test.ts` | Main integration test suite | ~800 lines |
| `test-utils.ts` | Helper utilities and helper functions | ~500 lines |
| `database-cleanup.ts` | Database cleanup tools | ~400 lines |
| `SETUP.md` | Step-by-step setup guide | ~400 lines |
| `END_TO_END_TEST_README.md` | Comprehensive documentation | ~600 lines |
| `INDEX.md` | File index and overview | ~300 lines |
| `QUICK_REFERENCE.md` | This file | ~200 lines |

## Quick Commands

### Setup (First Time)
```bash
# 1. Install dependencies
npm install

# 2. Generate JWT keys
openssl genrsa -out private.key 2048
openssl rsa -in private.key -pubout -out public.key

# 3. Create .env.local (see SETUP.md for details)
JWT_PRIVATE_KEY="<from-private.key>"
JWT_PUBLIC_KEY="<from-public.key>"
NEXT_PUBLIC_SUPABASE_URL="<your-supabase-url>"
SUPABASE_SERVICE_ROLE_KEY="<your-service-key>"

# 4. Start server
npm run dev
```

### Running Tests
```bash
# Run all end-to-end tests
npm run test:e2e

# Run in watch mode
npm run test:e2e:watch

# Run with coverage
npm run test:e2e:coverage

# Run specific test
npm test -- --testNamePattern="should successfully register"

# Run all tests
npm test
```

### Debugging
```bash
# Run with verbose output
npm run test:e2e -- --verbose

# Run specific file
npm test tests/end-to-end.test.ts

# Clear Jest cache
npm test -- --clearCache

# Debug mode
npm run test:debug
```

### Cleanup
```bash
# Dry run (show what will be deleted)
npm run test:cleanup -- --dry-run

# Actually cleanup
npm run test:cleanup

# Verbose cleanup
npm run test:cleanup -- --verbose
```

## Test Structure Overview

### Main Test Suite (end-to-end.test.ts)

```
IAeZap End-to-End Integration Tests
├── Complete User Registration and Authentication Flow
│   ├── Step 1: Register user in new company (4 tests)
│   ├── Step 2: Login as registered user (3 tests)
│   ├── Step 3: Verify JWT contains company_id (5 tests)
│   ├── Step 4: Send message via webhook using company_id (4 tests)
│   ├── Step 5: Verify multi-company message isolation (4 tests)
│   └── Error Handling and Edge Cases (6 tests)
├── Token Refresh Flow (2 tests)
└── Multi-Tenant Data Isolation (3 tests)
```

**Total Tests**: 40+

## Key Test Scenarios

### 1. Registration Tests
```typescript
// New user registration creates company
POST /api/auth/register
{
  email: "test-user-<timestamp>@example.com",
  password: "TestPassword123!@#",
  company_cnpj: "<14-digit-number>",
  company_name: "Test Company - <timestamp>"
}

// Response
{
  success: true,
  user: { id, email, company_id, role: "admin", ... },
  token: { accessToken, refreshToken, expiresIn, ... }
}
```

### 2. Login Tests
```typescript
// User login
POST /api/auth/login
{
  email: "test-user-<timestamp>@example.com",
  password: "TestPassword123!@#"
}

// Response
{
  success: true,
  user: { id, email, company_id, role, ... },
  access_token: "<jwt-token>",
  refresh_token: "<jwt-token>",
  ...
}
```

### 3. JWT Validation Tests
```typescript
// Decode JWT to verify claims
const claims = decodeJwt(accessToken);
{
  user_id: "<uuid>",
  company_id: "<uuid>",  // ← Key multi-tenant claim
  email: "user@example.com",
  role: "admin",
  iat: <timestamp>,
  exp: <timestamp>,
  iss: "iaezap",
  aud: "iaezap-api"
}
```

### 4. Webhook Tests
```typescript
// Receive Z-API webhook message
POST /api/webhooks/z-api/receive
{
  status: "RECEIVED",
  messageId: "msg-<timestamp>-1",
  phone: "558199999999",
  senderPhone: "558188888888",
  senderName: "Test Sender",
  text: "Test message",
  momment: <timestamp>,
  instanceId: "instance-<timestamp>"
}

// Response
{
  value: true
}
```

### 5. Multi-Tenant Isolation Tests
```typescript
// Register two users in different companies
User 1 → Company 1 (company_id: "uuid-1")
User 2 → Company 2 (company_id: "uuid-2")

// Verify company isolation
Token 1 contains company_id: "uuid-1"
Token 2 contains company_id: "uuid-2"

// Different messages are associated with correct company
```

## Key Assertions

### Status Code Assertions
```typescript
expect(response.status).toBe(201);  // Registration success
expect(response.status).toBe(200);  // Login success
expect(response.status).toBe(400);  // Validation error
expect(response.status).toBe(401);  // Invalid credentials
expect(response.status).toBe(409);  // Duplicate conflict
```

### Response Assertions
```typescript
expect(response.data).toHaveProperty('success', true);
expect(response.data).toHaveProperty('user');
expect(response.data.user).toHaveProperty('company_id');
expect(response.data).toHaveProperty('token');
expect(response.data.token).toHaveProperty('accessToken');
```

### JWT Claims Assertions
```typescript
const claims = decodeJwt(token);
expect(claims).toHaveProperty('company_id');
expect(claims).toHaveProperty('user_id');
expect(claims).toHaveProperty('email');
expect(claims).toHaveProperty('role');
expect(claims.exp).toBeGreaterThan(claims.iat);
```

### Error Assertions
```typescript
expect(response.data).toHaveProperty('success', false);
expect(response.data.error).toHaveProperty('code', 'VALIDATION_ERROR');
expect(response.data.error).toHaveProperty('message');
expect(response.data.error).toHaveProperty('timestamp');
```

## Utility Functions Quick Reference

### API Requests
```typescript
import { apiRequest } from './test-utils';

const response = await apiRequest('POST', '/api/auth/register', {
  email: 'user@example.com',
  password: 'Password123!@#',
  company_cnpj: '12345678901234',
  company_name: 'My Company'
});

// response.status, response.data, response.headers, response.ok
```

### JWT Decoding
```typescript
import { decodeJwt } from './test-utils';

const claims = decodeJwt(accessToken);
// claims.company_id, claims.user_id, claims.email, claims.role, etc.
```

### Test Data Generation
```typescript
import { TestDataGenerator } from './test-utils';

const gen = new TestDataGenerator();
gen.email('test-user');           // test-user-<timestamp>@example.com
gen.password();                   // TestPassword<timestamp>!@#
gen.cnpj();                       // 14-digit CNPJ
gen.companyName('My Company');    // My Company - <timestamp>
gen.phone();                      // 558219<8-digits>
gen.messageId('msg');             // msg-<timestamp>-<random>
gen.instanceId('instance');       // instance-<timestamp>-<random>
```

### Assertions
```typescript
import { assertStatus, assertError, assertSuccess } from './test-utils';

assertStatus(response, 201);           // Expect 201
assertStatus(response, [200, 201]);    // Expect 200 or 201
assertError(response, 'VALIDATION_ERROR');
assertSuccess(response);
```

### Helper Functions
```typescript
import {
  isValidJwt,
  isTokenExpired,
  waitFor,
  sleep,
  createTestUser,
  loginTestUser,
  sendWebhookMessage
} from './test-utils';

const valid = isValidJwt(token);
const expired = isTokenExpired(token);
await sleep(1000);
await waitFor(() => condition, { timeout: 5000 });

const user = await createTestUser(email, password, company);
const loginData = await loginTestUser(email, password);
const msgResponse = await sendWebhookMessage(...);
```

## Environment Variables

### Required
```bash
JWT_PRIVATE_KEY              # RSA private key (PEM format)
JWT_PUBLIC_KEY               # RSA public key (PEM format)
NEXT_PUBLIC_SUPABASE_URL     # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY    # Supabase service role key
```

### Optional
```bash
NODE_ENV                     # test, development, production
TEST_API_URL                 # http://localhost:3000
TEST_VERBOSE                 # true/false for verbose logging
```

## Test Data Patterns

All test data uses timestamp-based unique identifiers to avoid conflicts:

| Type | Pattern | Example |
|------|---------|---------|
| Email | `test-user-<timestamp>@example.com` | `test-user-1691868600000@example.com` |
| CNPJ | `<14-digit-base> + <timestamp % 10000>` | `11111111111111` |
| Company | `Test Company - <timestamp>` | `Test Company - 1691868600000` |
| Phone | `55819<8-digits>` | `558199999999` |
| Message ID | `msg-<timestamp>-<random>` | `msg-1691868600000-a1b2c3d4e5` |

## Expected Test Results

### All Tests Pass
```
PASS tests/end-to-end.test.ts (45.234 s)
  IAeZap End-to-End Integration Tests
    ✓ Complete User Registration and Authentication Flow (1234 ms)
    ✓ Token Refresh Flow (456 ms)
    ✓ Multi-Tenant Data Isolation (789 ms)

Test Suites: 1 passed, 1 total
Tests:       40 passed, 40 total
```

### Common Issues

#### Test Timeout
```
Error: Timeout - Async callback was not invoked within 30000 ms

Solution:
- Ensure API server is running (npm run dev)
- Increase testTimeout in jest.config.js
- Check network connectivity
```

#### Connection Error
```
Error: Failed to fetch http://localhost:3000/api/auth/register

Solution:
- Start API server: npm run dev
- Check correct port: curl http://localhost:3000
- Set TEST_API_URL environment variable if different
```

#### JWT Error
```
Error: Failed to decode JWT

Solution:
- Verify JWT keys in .env.local
- Check key format (PEM with newlines)
- Regenerate keys: openssl genrsa -out private.key 2048
```

## File Locations

```
iaezap6/
├── tests/
│   ├── end-to-end.test.ts
│   ├── test-utils.ts
│   ├── database-cleanup.ts
│   ├── SETUP.md
│   ├── END_TO_END_TEST_README.md
│   ├── INDEX.md
│   ├── QUICK_REFERENCE.md
│   └── .env.test (created during setup)
├── jest.config.js
├── package.json
├── .env.local (create with JWT keys and Supabase config)
└── src/
    ├── app/api/auth/register/route.ts
    ├── app/api/auth/login/route.ts
    ├── app/api/webhooks/z-api/receive/route.ts
    └── lib/
        ├── jwt.ts
        ├── supabase.ts
        └── auth/
```

## Documentation Map

| Need | Read |
|------|------|
| Quick setup (5 min) | SETUP.md - Quick Start |
| Detailed setup | SETUP.md - Detailed Setup |
| How to run tests | END_TO_END_TEST_README.md - Running Tests |
| What gets tested | END_TO_END_TEST_README.md - What Gets Tested |
| File overview | INDEX.md |
| Troubleshooting | SETUP.md - Troubleshooting or END_TO_END_TEST_README.md |
| Extending tests | END_TO_END_TEST_README.md - Extending Tests |
| Test utilities | test-utils.ts (well-commented source) |
| Database cleanup | database-cleanup.ts (well-commented source) |

## Next Steps

1. **Setup**: Follow SETUP.md (5-10 minutes)
2. **Start Server**: `npm run dev`
3. **Run Tests**: `npm run test:e2e` (another terminal)
4. **Review Results**: Check test output for pass/fail
5. **Inspect Data**: Use helper functions to examine tokens and responses
6. **Cleanup**: `npm run test:cleanup` after tests

## Support Resources

- **API Documentation**: See API route files in `src/app/api/`
- **JWT Reference**: See `src/lib/jwt.ts`
- **Supabase**: https://supabase.com/docs
- **Jest**: https://jestjs.io/docs/
- **TypeScript**: https://www.typescriptlang.org/docs/

---

**Version**: 1.0
**Last Updated**: 2026-08-13
**Test Coverage**: Multi-tenant registration, auth, JWT, webhooks
