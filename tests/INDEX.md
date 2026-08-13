# IAeZap Integration Tests - Index

## Overview

This directory contains comprehensive integration tests for the IAeZap multi-tenant application. The tests verify the complete user flow including registration, authentication, JWT token generation with company isolation, and webhook message handling.

## Files in This Directory

### Core Test Files

#### `end-to-end.test.ts`
**Purpose**: Main integration test suite for the complete IAeZap flow

**Tests Covered**:
- User registration in new companies
- User login and authentication
- JWT token generation with company_id claims
- Webhook message reception and validation
- Multi-tenant data isolation
- Error handling and edge cases
- Token refresh flow

**How to Run**:
```bash
npm run test:e2e
npm run test:e2e:watch
npm run test:e2e:coverage
```

**Key Test Suites**:
1. **Complete User Registration and Authentication Flow**
   - Step 1: Register user in new company
   - Step 2: Login as registered user
   - Step 3: Verify JWT contains company_id
   - Step 4: Send message via webhook using company_id
   - Step 5: Verify multi-company message isolation
   - Error Handling and Edge Cases

2. **Token Refresh Flow**
   - Refresh token validity after login
   - Company_id in refresh token

3. **Multi-Tenant Data Isolation**
   - Registration creates isolated namespaces
   - Users see only their company_id
   - Users have different company_ids

**Test Data**: Uses timestamp-based unique identifiers to avoid conflicts

### Utility Files

#### `test-utils.ts`
**Purpose**: Helper functions and utilities for all integration tests

**Exports**:
- `apiRequest()` - Make HTTP requests to API
- `decodeJwt()` - Decode JWT tokens for inspection
- `extractBearerToken()` - Parse Authorization headers
- `generateTestEmail()` - Create unique test emails
- `generateTestCnpj()` - Create valid test CNPJs
- `generateCompanyName()` - Create unique company names
- `isValidJwt()` - Validate JWT token structure
- `isTokenExpired()` - Check token expiration
- `waitFor()` - Wait for async conditions
- `sleep()` - Async sleep utility
- `createTestUser()` - Register test user via API
- `loginTestUser()` - Login test user via API
- `sendWebhookMessage()` - Send Z-API webhook messages
- `assertStatus()`, `assertError()`, `assertSuccess()` - Response assertions
- `TestDataGenerator` - Class for generating unique test data
- `TestLogger` - Logging utilities for debugging
- `mockResponses` - Mock API response generators
- `testConfig` - Test configuration
- `TestContext` - Interface for test state
- `JwtClaims` - Interface for JWT claims
- `ApiResponse` - Interface for API responses

**Usage Example**:
```typescript
import { apiRequest, decodeJwt, TestDataGenerator } from './test-utils';

const generator = new TestDataGenerator();
const response = await apiRequest('POST', '/api/auth/register', {
  email: generator.email('test-user'),
  password: generator.password(),
  company_cnpj: generator.cnpj(),
  company_name: generator.companyName(),
});

const claims = decodeJwt(response.data.token.accessToken);
console.log(claims.company_id);
```

#### `database-cleanup.ts`
**Purpose**: Utilities for cleaning up test data from database

**Exports**:
- `cleanupTestData()` - Async cleanup function
- `sqlCleanupScripts` - SQL scripts for manual cleanup
- `manualCleanupInstructions` - Human-readable cleanup guide
- `cleanupConfig` - Cleanup configuration

**Usage**:
```bash
# Automated cleanup (verbose)
npm run test:cleanup

# Dry run (show what would be deleted)
npm run test:cleanup -- --dry-run

# Manual SQL cleanup
# Copy SQL from database-cleanup.ts and run in Supabase dashboard
```

**Cleanup Patterns**:
- Test users by email pattern (test-user-*@example.com, *@example.test, etc.)
- Test companies by name pattern (Test*, Refresh*, Isolation*, Multi*, etc.)
- Old test data (older than 24 hours)

### Documentation Files

#### `END_TO_END_TEST_README.md`
**Purpose**: Comprehensive documentation for end-to-end tests

**Sections**:
- Overview of tests
- Prerequisites and setup
- How to run tests
- Test data explanation
- Test structure and organization
- Expected response examples
- Troubleshooting guide
- CI/CD integration examples
- How to extend tests

**Best For**: Complete reference for using the integration tests

#### `SETUP.md`
**Purpose**: Step-by-step setup guide for running tests

**Sections**:
- Quick start (5-minute setup)
- Detailed setup instructions
- Environment variables explained
- JWT key generation (3 methods)
- Database setup (SQL, table definitions)
- Verification steps
- Running tests (various options)
- Troubleshooting
- Test data management
- CI/CD integration

**Best For**: Initial setup and troubleshooting

#### `INDEX.md` (this file)
**Purpose**: Overview of all test files and how to use them

**Best For**: Quick reference and navigation

## Getting Started

### 1. Quick Start (5 minutes)
```bash
# Install dependencies
npm install

# Generate JWT keys
openssl genrsa -out private.key 2048
openssl rsa -in private.key -pubout -out public.key

# Create .env.local with keys and Supabase config
# (See SETUP.md for details)

# Start server
npm run dev

# Run tests (in another terminal)
npm run test:e2e
```

### 2. Full Setup
Follow the detailed instructions in `SETUP.md`

## Test Coverage

### Authentication Flow
- ✓ User registration with new company
- ✓ Email validation
- ✓ Password strength validation
- ✓ CNPJ format validation
- ✓ Duplicate email detection
- ✓ User login with email/password
- ✓ Invalid credential handling
- ✓ User not found handling

### JWT Tokens
- ✓ Access token generation
- ✓ Refresh token generation
- ✓ company_id claim in access token
- ✓ user_id claim in access token
- ✓ email claim in access token
- ✓ role claim in access token
- ✓ Standard JWT claims (iat, exp, iss, aud)
- ✓ Token expiration handling

### Multi-Tenant Isolation
- ✓ Company creation with unique IDs
- ✓ Users belong to correct company
- ✓ Users have different company_ids
- ✓ JWT contains correct company_id
- ✓ Different companies have different data

### Webhook Handling
- ✓ Z-API message reception
- ✓ Payload validation
- ✓ Text format variations
- ✓ Error handling
- ✓ Response format validation

### Error Handling
- ✓ Validation errors (400)
- ✓ Unauthorized errors (401)
- ✓ Conflict errors (409)
- ✓ Server errors (500)
- ✓ CORS preflight (OPTIONS)
- ✓ Missing request body
- ✓ Invalid field validation

## Test Statistics

| Metric | Value |
|--------|-------|
| Total Test Cases | 40+ |
| Test Suites | 4 |
| Estimated Run Time | 30-60 seconds |
| Test Data Pattern | Timestamp-based unique IDs |
| Database Tables | companies, users, messages |

## Common Tasks

### Run All Integration Tests
```bash
npm run test:e2e
```

### Run Tests in Watch Mode
```bash
npm run test:e2e:watch
```

### Generate Coverage Report
```bash
npm run test:e2e:coverage
```

### Run Specific Test
```bash
npm test -- --testNamePattern="should successfully register"
```

### Clean Up Test Data
```bash
npm run test:cleanup
```

### Dry Run Cleanup
```bash
npm run test:cleanup -- --dry-run
```

## File Structure

```
tests/
├── end-to-end.test.ts              # Main test suite
├── test-utils.ts                   # Helper utilities
├── database-cleanup.ts             # Database cleanup tools
├── INDEX.md                        # This file
├── SETUP.md                        # Setup instructions
└── END_TO_END_TEST_README.md      # Comprehensive documentation
```

## Architecture

### Test Flow

```
Test Start
    ↓
Setup Test Context
    ↓
Create Test Data (unique email, CNPJ, etc.)
    ↓
Test Registration → Verify Response → Store Data
    ↓
Test Login → Verify Response → Extract Token
    ↓
Decode JWT → Verify Claims (company_id, user_id, etc.)
    ↓
Send Webhook → Verify Processing
    ↓
Test Multi-Tenant Isolation
    ↓
Error Handling Tests
    ↓
Cleanup Test Data
    ↓
Test Complete
```

### Data Flow

```
Unique Test Data (timestamp-based)
    ├── email: test-user-<timestamp>@example.com
    ├── cnpj: <14-digit-number>
    └── company: Test Company - <timestamp>
        ↓
    POST /api/auth/register
        ↓
    Response: { user: { id, email, company_id }, token: { accessToken, ... } }
        ↓
    Decode JWT → Extract claims { company_id, user_id, email, role, iat, exp }
        ↓
    Webhook Message Processing
        ↓
    Verify Company Isolation
        ↓
    Cleanup (optional)
```

## Best Practices

### Writing Tests
1. Use `TestDataGenerator` for unique data
2. Use helper functions from `test-utils.ts`
3. Include both success and error cases
4. Add descriptive test names
5. Clean up data after tests (automated)

### Running Tests
1. Ensure API server is running
2. Verify environment variables are set
3. Check database connectivity
4. Run with `--verbose` for debugging
5. Use `--dry-run` before cleanup

### Debugging
1. Use `TEST_VERBOSE=true npm run test:e2e`
2. Check API server logs
3. Review test output with `--verbose`
4. Use `decodeJwt()` to inspect tokens
5. Check database directly for test data

## Troubleshooting

### Tests Timeout
- Increase `testTimeout` in jest.config.js
- Ensure API server is running
- Check network connectivity

### Module Errors
- Clear cache: `npm test -- --clearCache`
- Rebuild: `npm run build`
- Reinstall: `rm -rf node_modules && npm install`

### JWT Errors
- Verify keys in .env.local
- Check key format (PEM)
- Regenerate keys if needed

### Database Errors
- Check Supabase URL and key
- Verify tables exist
- Check network connectivity

See SETUP.md for more troubleshooting.

## Contributing

When adding new integration tests:

1. Follow existing test structure
2. Use helper functions from test-utils.ts
3. Generate unique test data with timestamps
4. Include both success and error cases
5. Document test purpose and expectations
6. Add to appropriate describe block
7. Clean up test data properly

## Support

- **Documentation**: See END_TO_END_TEST_README.md
- **Setup Help**: See SETUP.md
- **Test Utilities**: See test-utils.ts
- **Database Cleanup**: See database-cleanup.ts

## Next Steps

1. Complete setup from SETUP.md
2. Run tests: `npm run test:e2e`
3. Review test output
4. Check JWT tokens in console
5. Verify multi-tenant isolation
6. Add custom tests as needed

---

**Last Updated**: 2026-08-13
**Test Coverage**: Multi-tenant user registration, authentication, JWT validation, webhook handling
**Database**: Supabase PostgreSQL
