# IAeZap End-to-End Integration Tests

## Overview

This document describes the end-to-end integration tests for the IAeZap multi-tenant application. These tests verify the complete user flow including registration, authentication, JWT token generation with company isolation, and webhook message handling.

## Test File Location

```
tests/end-to-end.test.ts
```

## What Gets Tested

### 1. User Registration Flow
- **New Company Registration**: User can register with a new company (CNPJ)
- **Validation**: Email format, password strength, CNPJ format, company name
- **Duplicate Detection**: Cannot register with same email twice
- **User Role Assignment**: First user is assigned `admin` role

### 2. User Login/Authentication
- **Valid Credentials**: Login succeeds with correct email/password
- **Invalid Credentials**: Login fails with wrong password
- **Non-existent User**: Login fails if user doesn't exist
- **Response Format**: Login returns user info and tokens

### 3. JWT Token Validation
- **Company ID Claim**: JWT contains `company_id` claim
- **User ID Claim**: JWT contains `user_id` claim  
- **Email Claim**: JWT contains `email` claim
- **Role Claim**: JWT contains `role` claim
- **Standard Claims**: JWT includes `iat`, `exp`, `iss`, `aud`
- **Token Expiration**: Tokens have proper expiration times

### 4. Webhook Message Handling
- **Message Reception**: Webhook endpoint accepts Z-API messages
- **Payload Validation**: Invalid payloads are rejected
- **Text Format Support**: Handles both string and object text formats
- **Response Format**: Returns `{ value: true }` on success

### 5. Multi-Tenant Isolation
- **Company Isolation**: Users belong to isolated companies
- **Company ID in Token**: Each company_id is unique and correct in JWT
- **Data Separation**: Different companies have different company_ids
- **Message Association**: Messages can be associated with correct company

## Prerequisites

### 1. Install Dependencies

```bash
npm install
```

This will install Jest, ts-jest, and all required dependencies.

### 2. Set Up Environment Variables

Create a `.env.local` file with the following:

```env
# JWT Configuration
JWT_PRIVATE_KEY="<your-private-key>"
JWT_PUBLIC_KEY="<your-public-key>"
JWT_ISSUER="iaezap"
JWT_AUDIENCE="iaezap-api"
JWT_ACCESS_TOKEN_EXPIRY="3600"
JWT_REFRESH_TOKEN_EXPIRY="604800"

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="<your-supabase-url>"
SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"

# Node Environment
NODE_ENV="test"
```

### 3. Generate JWT Keys (if needed)

If you don't have JWT keys, generate them:

```bash
# Generate RSA key pair
openssl genrsa -out private.key 2048
openssl rsa -in private.key -pubout -out public.key

# Convert to single-line format for environment variables
# (remove newlines, replace \n with literal \n)
```

Then set the keys in your `.env.local` file.

### 4. Start the Test Server

The tests expect a running API server:

```bash
npm run dev
# or
npm start
```

By default, tests connect to `http://localhost:3000`. You can override with:

```bash
export TEST_API_URL="http://localhost:3001"
npm test
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Specific Test File

```bash
npm test tests/end-to-end.test.ts
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run with Coverage

```bash
npm run test:coverage
```

### Run Specific Test Suite

```bash
npm test -- --testNamePattern="Complete User Registration and Authentication Flow"
```

### Run with Verbose Output

```bash
npm test -- --verbose
```

## Test Data

Tests use dynamically generated unique identifiers to avoid conflicts:

- **Timestamp-based Identifiers**: Each test run generates unique data using `Date.now()`
- **CNPJ Format**: Valid 14-digit CNPJ numbers
- **Email Format**: `test-user-<timestamp>@example.com`
- **Company Names**: Include timestamp for uniqueness

Example test data generated:
```javascript
const timestamp = 1691868600000;
const user1 = {
  email: "test-user-1-1691868600000@example.com",
  password: "TestPassword123!@#"
};
const company1 = {
  cnpj: "11111111111111",
  name: "Test Company 1 - 1691868600000"
};
```

## Test Structure

### Helper Functions

#### `apiRequest(method, endpoint, body?, headers?)`
Makes HTTP requests to the API with proper JSON handling.

```typescript
const response = await apiRequest('POST', '/api/auth/register', {
  email: 'user@example.com',
  password: 'Password123!@#',
  company_cnpj: '12345678901234',
  company_name: 'My Company'
});
```

#### `decodeJwt(token)`
Decodes JWT tokens without verification (for testing purposes).

```typescript
const claims = decodeJwt(accessToken);
console.log(claims.company_id); // UUID
```

### Test Organization

Tests are organized in describe blocks:

```
IAeZap End-to-End Integration Tests
├── Complete User Registration and Authentication Flow
│   ├── Step 1: Register user in new company
│   ├── Step 2: Login as registered user
│   ├── Step 3: Verify JWT contains company_id
│   ├── Step 4: Send message via webhook using company_id
│   ├── Step 5: Verify multi-company message isolation
│   └── Error Handling and Edge Cases
├── Token Refresh Flow
├── Multi-Tenant Data Isolation
```

## Expected Test Results

### Success Response Examples

#### Registration Success (201)
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "company_id": "uuid",
    "role": "admin",
    "created_at": "2026-08-13T..."
  },
  "token": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJSUzI1NiIs...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

#### Login Success (200)
```json
{
  "success": true,
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "company_id": "uuid",
    "role": "admin"
  },
  "company_id": "uuid",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

#### JWT Claims
```json
{
  "user_id": "uuid",
  "company_id": "uuid",
  "email": "user@example.com",
  "role": "admin",
  "iat": 1691868600,
  "exp": 1691872200,
  "iss": "iaezap",
  "aud": "iaezap-api"
}
```

#### Webhook Success (200)
```json
{
  "value": true
}
```

### Error Response Examples

#### Validation Error (400)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "email": ["Invalid email format"]
    },
    "timestamp": "2026-08-13T..."
  }
}
```

#### Invalid Credentials (401)
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "timestamp": "2026-08-13T..."
  }
}
```

## Troubleshooting

### Tests Timeout

If tests timeout with error `Timeout - Async callback was not invoked`:

1. **Increase Test Timeout** in jest.config.js:
```javascript
testTimeout: 30000, // 30 seconds
```

2. **Check Server Running**: Ensure API server is running on correct port
```bash
curl http://localhost:3000/api/auth/register
```

3. **Check Network**: Verify network connectivity
```bash
ping localhost
```

### "Cannot find module" Errors

If you get TypeScript module errors:

1. Rebuild TypeScript files:
```bash
npm run build
```

2. Clear Jest cache:
```bash
npm test -- --clearCache
```

### JWT Verification Fails

If JWT-related tests fail:

1. Verify JWT keys are set:
```bash
echo $JWT_PRIVATE_KEY
echo $JWT_PUBLIC_KEY
```

2. Check key format (should be PEM):
```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----
```

3. Regenerate keys if needed:
```bash
openssl genrsa -out private.key 2048
openssl rsa -in private.key -pubout -out public.key
```

### Database Cleanup Issues

Tests use unique data with timestamps. If you need to clean up:

1. **Manual Cleanup SQL**:
```sql
-- Delete test users
DELETE FROM users 
WHERE email LIKE 'test-user-%@example.com'
OR created_at < NOW() - INTERVAL '1 day';

-- Delete test companies  
DELETE FROM companies
WHERE name LIKE 'Test Company%'
OR created_at < NOW() - INTERVAL '1 day';
```

2. **Reset Database**:
```bash
# If using Supabase, reset from their dashboard
# Or restore from backup
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Generate JWT keys
        run: |
          openssl genrsa -out private.key 2048
          openssl rsa -in private.key -pubout -out public.key
      
      - name: Start server
        run: npm run dev &
      
      - name: Wait for server
        run: npx wait-on http://localhost:3000
      
      - name: Run tests
        run: npm test
        env:
          NODE_ENV: test
          TEST_API_URL: http://localhost:3000
```

## Extending Tests

To add new test cases:

1. **Add test within appropriate describe block**:
```typescript
describe('Your Feature', () => {
  test('should do something', async () => {
    const response = await apiRequest('POST', '/api/endpoint', {...});
    expect(response.status).toBe(200);
  });
});
```

2. **Use helper functions**:
```typescript
const response = await apiRequest('POST', '/api/auth/login', {...});
const token = response.data.access_token;
const claims = decodeJwt(token);
```

3. **Generate unique test data**:
```typescript
const uniqueEmail = `test-${timestamp}@example.com`;
```

## Performance Notes

- **Test Duration**: Approximately 30-60 seconds for full suite
- **Parallel Execution**: Jest runs tests in parallel by default
- **Database**: Each test creates unique data to avoid conflicts
- **Cleanup**: Automatic cleanup runs after test suite completes

## Contributing

When adding new integration tests:

1. Follow existing test structure and naming conventions
2. Use helper functions for API calls
3. Generate unique test data with timestamps
4. Include both success and error cases
5. Document expected behavior in test names
6. Add comments for complex test logic

## Support and Issues

For issues or questions:

1. Check the troubleshooting section above
2. Review test output with `--verbose` flag
3. Check API server logs
4. Verify environment variables are set
5. Ensure database is accessible

## References

- [Jest Documentation](https://jestjs.io/)
- [TypeScript Jest](https://kulshekhar.github.io/ts-jest/)
- [IAeZap API Documentation](../README.md)
- [JWT Standard](https://tools.ietf.org/html/rfc7519)
- [Z-API Documentation](https://z-api.io/)
