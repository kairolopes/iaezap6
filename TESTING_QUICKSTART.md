# IAeZap Testing Quick Start

Get up and running with IAeZap authentication tests in 5 minutes.

## Prerequisites

- Node.js 15+ (has built-in crypto support)
- npm or yarn package manager
- Git (for version control)

## Quick Setup

### 1. Install Dependencies

```bash
# Install test framework and related packages
npm install

# Install test-specific dependencies
npm install --save-dev jest @types/jest ts-jest jest-environment-node
```

### 2. Generate JWT Keys (if not already done)

```bash
# Generate RSA key pair for JWT signing
npm run generate-jwt-keys

# Keys will be output to console
# Add them to your .env.local or jest.setup.js
```

### 3. Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run specific test file
npm test -- tests/auth.test.ts

# Run specific test case
npm test -- tests/auth.test.ts -t "should successfully register"
```

## Test Files Overview

### `tests/auth.test.ts` (Main Test Suite)
Contains unit tests for:
- Password hashing and verification
- User registration with valid/invalid data
- User login with correct/incorrect credentials
- JWT token verification and validation
- Multi-tenant support
- Error handling

**Run:** `npm test -- tests/auth.test.ts`

### `tests/auth.integration.test.ts` (Integration Tests)
Contains end-to-end tests with mock Supabase:
- Complete registration flow
- Complete login flow
- Multi-tenant isolation
- Token claims validation

**Run:** `npm test -- tests/auth.integration.test.ts`

## Test Coverage Report

```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
# Open coverage/lcov-report/index.html
```

This generates:
- Statement coverage (which lines executed)
- Branch coverage (which code paths executed)
- Function coverage (which functions executed)
- Line coverage (which lines have coverage)

## Common Commands

| Command | Purpose |
|---------|---------|
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests on file change |
| `npm run test:coverage` | Generate coverage report |
| `npm test -- --verbose` | Show detailed test output |
| `npm test -- --testNamePattern="Register"` | Run tests matching pattern |
| `npm test -- --maxWorkers=1` | Run tests sequentially |

## Environment Variables

Tests need JWT keys configured. Add to `jest.setup.js` or `.env.test`:

```bash
# RSA key pair for JWT signing
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."

# JWT configuration
JWT_ISSUER="auth-service"
JWT_AUDIENCE="auth-api"

# Bcrypt configuration
BCRYPT_ROUNDS="10"

# Token expiry (in seconds)
ACCESS_TOKEN_EXPIRY="900"       # 15 minutes
REFRESH_TOKEN_EXPIRY="604800"   # 7 days
```

## What Gets Tested

### ✅ User Registration
- [x] Register with valid credentials
- [x] Reject duplicate email (409 error)
- [x] Hash password with bcrypt
- [x] Create user with company association
- [x] Generate JWT tokens with company_id

### ✅ User Login
- [x] Login with correct password
- [x] Reject wrong password (401 error)
- [x] Reject nonexistent email
- [x] Generate tokens with company context

### ✅ JWT Tokens
- [x] Tokens contain correct company_id
- [x] Tokens include issuer and audience
- [x] Tokens include user roles
- [x] Reject expired tokens
- [x] Reject tampered tokens

### ✅ Multi-tenant
- [x] Support multiple users per company
- [x] Isolate data between companies
- [x] Maintain company context in tokens

### ✅ Error Handling
- [x] Handle missing passwords
- [x] Handle invalid emails
- [x] Handle missing JWT keys
- [x] Proper error messages

## Example Test Output

```
PASS  tests/auth.test.ts
  Authentication Tests
    Password Hashing and Verification
      ✓ should successfully hash a valid password (45ms)
      ✓ should reject a password that is too short (3ms)
      ✓ should verify correct password (22ms)
    User Registration
      ✓ should successfully register a new user with valid data (15ms)
      ✓ should fail when registering with duplicate email (2ms)
      ✓ should create tokens with company_id in payload (18ms)
    User Login
      ✓ should successfully login with correct credentials (18ms)
      ✓ should fail login with wrong password (22ms)
    JWT Token Verification
      ✓ should contain correct company_id in access token (12ms)
      ✓ should verify token with correct issuer and audience (8ms)

Test Suites: 2 passed, 2 total
Tests:       30 passed, 30 total
Time:        2.543 s
```

## Debug Tests

### Print debug output
```typescript
it('should debug something', () => {
  console.log('Debug value:', someValue);
  expect(someValue).toBe(expected);
});

// Run with verbose output
npm test -- --verbose
```

### Use debugger
```bash
# Run tests with Node debugger
node --inspect-brk ./node_modules/.bin/jest --runInBand

# Then open chrome://inspect in Chrome
```

## Troubleshooting

### Tests not running
```bash
# Check Jest is installed
npm list jest

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Test timeout
```bash
# Increase timeout in jest.config.js
testTimeout: 10000  // 10 seconds

# Or per test
jest.setTimeout(10000);
```

### Module not found errors
```bash
# Verify tsconfig.json has correct path mappings
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Environment variable not found
```bash
# Ensure variables set before test run
export JWT_PRIVATE_KEY="..."
export JWT_PUBLIC_KEY="..."
npm test
```

## Next Steps

1. **Run tests** - `npm test`
2. **Read test output** - Check which tests pass/fail
3. **Add more tests** - Follow patterns in `auth.test.ts`
4. **Check coverage** - `npm run test:coverage`
5. **Integrate with CI/CD** - Run tests on every commit

## Resources

- **[Tests Directory](./tests/)** - All test files
- **[Main Test File](./tests/auth.test.ts)** - Unit tests
- **[Integration Tests](./tests/auth.integration.test.ts)** - End-to-end tests
- **[Tests README](./tests/README.md)** - Detailed documentation
- **[Mocking Guide](./tests/MOCKING_GUIDE.md)** - How to mock Supabase
- **[Jest Docs](https://jestjs.io/)** - Jest documentation

## Support

For issues or questions:
1. Check the [Tests README](./tests/README.md)
2. Review [Mocking Guide](./tests/MOCKING_GUIDE.md)
3. Check test output for error details
4. Contact the development team

---

**Happy testing!** 🚀

Run `npm test` now to verify everything is working.
