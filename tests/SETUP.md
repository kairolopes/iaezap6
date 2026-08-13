# IAeZap Integration Tests - Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd /path/to/iaezap6
npm install
```

### 2. Generate JWT Keys

```bash
# Generate RSA key pair for JWT signing
openssl genrsa -out private.key 2048
openssl rsa -in private.key -pubout -out public.key
```

Convert keys to environment variable format:
```bash
# macOS/Linux
sed ':a;N;$!ba;s/\n/\\n/g' private.key

# Windows (PowerShell)
(Get-Content private.key) -replace "`n", "\n" | Write-Host
```

### 3. Configure Environment

Create `.env.local` in project root:

```env
# JWT Configuration (required)
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...\n-----END PUBLIC KEY-----"
JWT_ISSUER="iaezap"
JWT_AUDIENCE="iaezap-api"
JWT_ACCESS_TOKEN_EXPIRY="3600"
JWT_REFRESH_TOKEN_EXPIRY="604800"

# Supabase Configuration (required)
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Optional
NODE_ENV="test"
TEST_API_URL="http://localhost:3000"
TEST_VERBOSE="false"
```

### 4. Start API Server

```bash
# In one terminal
npm run dev
```

Server will be running at `http://localhost:3000`

### 5. Run Tests

```bash
# In another terminal
npm test tests/end-to-end.test.ts

# Or run all tests
npm test

# Or watch mode
npm run test:watch
```

## Detailed Setup

### Environment Variables Explained

#### JWT Configuration

| Variable | Purpose | Example |
|----------|---------|---------|
| `JWT_PRIVATE_KEY` | Private key for signing tokens | `-----BEGIN RSA PRIVATE KEY-----\n...` |
| `JWT_PUBLIC_KEY` | Public key for verifying tokens | `-----BEGIN PUBLIC KEY-----\n...` |
| `JWT_ISSUER` | Token issuer claim | `iaezap` |
| `JWT_AUDIENCE` | Token audience claim | `iaezap-api` |
| `JWT_ACCESS_TOKEN_EXPIRY` | Access token lifetime (seconds) | `3600` (1 hour) |
| `JWT_REFRESH_TOKEN_EXPIRY` | Refresh token lifetime (seconds) | `604800` (7 days) |

#### Supabase Configuration

| Variable | Purpose | How to Get |
|----------|---------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for backend | Supabase Dashboard → Project Settings → API |

#### Test Configuration

| Variable | Purpose | Default |
|----------|---------|---------|
| `NODE_ENV` | Environment mode | `test` |
| `TEST_API_URL` | API server URL | `http://localhost:3000` |
| `TEST_VERBOSE` | Enable verbose logging | `false` |

### Key Generation Details

#### Option A: Using OpenSSL

```bash
# Generate private key
openssl genrsa -out private.key 2048

# Generate public key from private key
openssl rsa -in private.key -pubout -out public.key

# View keys
cat private.key
cat public.key
```

#### Option B: Using Node.js

```javascript
const crypto = require('crypto');
const fs = require('fs');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

fs.writeFileSync('private.key', privateKey);
fs.writeFileSync('public.key', publicKey);

console.log('Private Key:', privateKey);
console.log('Public Key:', publicKey);
```

#### Format Keys for Environment Variables

```bash
# View raw key with escaped newlines
node -e "
const fs = require('fs');
const key = fs.readFileSync('private.key', 'utf-8');
console.log(key.split('\\n').join('\\\\n'));
"
```

Copy output and paste into `.env.local`:
```env
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"
```

### Database Setup

The tests use existing database tables. Ensure the following tables exist in Supabase:

#### Required Tables

1. **companies**
   - `id` (UUID, primary key)
   - `cnpj` (VARCHAR, unique)
   - `name` (VARCHAR)
   - `status` (VARCHAR, default: 'active')
   - `created_at` (TIMESTAMP)
   - `deleted_at` (TIMESTAMP, nullable)

2. **users**
   - `id` (UUID, primary key)
   - `email` (VARCHAR, unique)
   - `password_hash` (VARCHAR)
   - `company_id` (UUID, foreign key)
   - `role` (VARCHAR)
   - `status` (VARCHAR, default: 'active')
   - `created_at` (TIMESTAMP)
   - `updated_at` (TIMESTAMP)
   - `deleted_at` (TIMESTAMP, nullable)

3. **messages** (optional, for message tracking)
   - `id` (UUID, primary key)
   - `company_id` (UUID, foreign key)
   - `phone` (VARCHAR)
   - `sender_phone` (VARCHAR)
   - `text` (TEXT)
   - `created_at` (TIMESTAMP)

#### SQL to Create Tables

```sql
-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj VARCHAR(14) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id),
  role VARCHAR(50) DEFAULT 'user',
  full_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  message_id VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  sender_phone VARCHAR(20),
  sender_name VARCHAR(255),
  text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON companies(cnpj);
CREATE INDEX IF NOT EXISTS idx_messages_company_id ON messages(company_id);
```

### Verify Setup

#### 1. Check Node Version

```bash
node --version  # Should be 16+
npm --version   # Should be 8+
```

#### 2. Check Environment Variables

```bash
# Verify JWT keys are set
echo $JWT_PRIVATE_KEY | head -c 50
echo $JWT_PUBLIC_KEY | head -c 50

# Verify Supabase settings
echo $SUPABASE_SERVICE_ROLE_KEY | head -c 50
```

#### 3. Check Database Connection

```bash
# Test Supabase connection
curl -X GET "https://xxxxx.supabase.co/rest/v1/companies?limit=1" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

#### 4. Start Server and Verify

```bash
# Terminal 1
npm run dev

# Terminal 2 - Wait for server to start, then test
sleep 5
curl http://localhost:3000/api/auth/register -X OPTIONS
```

Should return:
```
HTTP/1.1 200 OK
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## Running Tests

### Basic Test Run

```bash
npm test tests/end-to-end.test.ts
```

Expected output:
```
PASS tests/end-to-end.test.ts
  IAeZap End-to-End Integration Tests
    Complete User Registration and Authentication Flow
      Step 1: Register user in new company
        ✓ should successfully register new user and create company (234 ms)
        ✓ should reject duplicate email registration (145 ms)
        ...
```

### Test Options

```bash
# Run specific test
npm test -- --testNamePattern="should successfully register"

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run with verbose output
npm test -- --verbose

# Run single file
npm test tests/end-to-end.test.ts

# Run and update snapshots
npm test -- -u
```

## Troubleshooting

### Port Already in Use

```bash
# Kill existing process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### Module Not Found Error

```bash
# Clear Jest cache
npm test -- --clearCache

# Rebuild TypeScript
npm run build

# Reinstall dependencies
rm -rf node_modules
npm install
```

### JWT Key Issues

```bash
# Verify key format
node -e "
const key = process.env.JWT_PRIVATE_KEY;
console.log('Key starts with:', key.substring(0, 30));
console.log('Key ends with:', key.substring(key.length - 30));
console.log('Contains newlines:', key.includes('\\\\n'));
"
```

### Database Connection Failed

```bash
# Check Supabase URL
echo $NEXT_PUBLIC_SUPABASE_URL

# Check service role key
echo $SUPABASE_SERVICE_ROLE_KEY | cut -c1-50

# Test connection
curl -X GET "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/companies" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"
```

### Tests Timeout

Increase timeout in `jest.config.js`:
```javascript
testTimeout: 60000, // 60 seconds
```

## Test Data Management

### View Test Data

```bash
# Count test users
psql -c "
  SELECT COUNT(*) as test_users
  FROM users
  WHERE email LIKE 'test-%@example.com';
"
```

### Cleanup Test Data

```bash
# Dry run (see what would be deleted)
npm run test:cleanup -- --dry-run

# Actually delete
npm run test:cleanup

# Manual SQL cleanup
npm run test:cleanup:sql
```

## Next Steps

1. Run the end-to-end tests: `npm test tests/end-to-end.test.ts`
2. Check the test output for any failures
3. Review test results to verify multi-tenant isolation
4. Examine JWT tokens in test output to verify company_id claims
5. Check test data cleanup after tests complete

## CI/CD Integration

See `END_TO_END_TEST_README.md` for GitHub Actions setup examples.

## Support

For issues or questions:
1. Check test output with `--verbose` flag
2. Review API server logs
3. Verify environment variables are set correctly
4. Check database connectivity
5. Ensure required tables exist
