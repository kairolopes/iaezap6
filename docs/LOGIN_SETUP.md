# Login Endpoint Setup Guide

## Overview

The IAeZap login endpoint (`POST /api/auth/login`) implements secure user authentication using:
- **Email-based user lookup** with company isolation
- **Bcrypt password verification** for secure password hashing
- **RS256 JWT tokens** for stateless authentication
- **Refresh token rotation** for long-lived sessions

## Prerequisites

### 1. Database Schema

The login endpoint requires a `users` table in Supabase with the following columns:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  UNIQUE(company_id, email)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_company_id ON users(company_id);
```

### 2. Environment Variables

Add the following to your `.env.local`:

#### JWT RSA Keys (Required)

```bash
# Generate keys using: node scripts/generate-jwt-keys.js
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...LONG_BASE64_STRING...\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...LONG_BASE64_STRING...\n-----END PUBLIC KEY-----"
```

#### JWT Configuration (Optional)

```bash
# Token expiration times (in seconds)
JWT_ISSUER=iaezap
JWT_AUDIENCE=iaezap-api
ACCESS_TOKEN_EXPIRY=3600        # 1 hour
REFRESH_TOKEN_EXPIRY=604800     # 7 days

# Bcrypt configuration
BCRYPT_ROUNDS=12                # Higher = more secure but slower
```

### 3. Generate JWT Keys

Run the key generation script:

```bash
node scripts/generate-jwt-keys.js
```

This will output:
- RSA 2048-bit public and private keys
- Environment variable format ready to paste into `.env.local`
- Keys saved to `.keys/` directory for reference

**⚠️ Important**: Never commit private keys to version control. Add `.keys/` to `.gitignore`.

## API Endpoint

### Request

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "companyId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Parameters:**
- `email` (required): User's email address
- `password` (required): User's password (plaintext)
- `companyId` (optional): Company UUID (recommended for multi-tenant isolation)

### Success Response (200)

```json
{
  "success": true,
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "user",
    "company_id": "550e8400-e29b-41d4-a716-446655440001",
    "status": "active"
  },
  "company_id": "550e8400-e29b-41d4-a716-446655440001",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

**Response Fields:**
- `access_token`: JWT token for API requests (expires in 1 hour by default)
- `refresh_token`: Long-lived token for obtaining new access tokens
- `user`: User object with id, email, name, role, and company association
- `company_id`: Associated company UUID
- `expires_in`: Access token expiration in seconds
- `token_type`: Always "Bearer" for HTTP Authorization header

### Error Responses

#### 400 Bad Request - Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "email": ["Invalid email format"],
      "password": ["Password is required"]
    },
    "timestamp": "2026-08-12T10:00:00Z"
  }
}
```

#### 401 Unauthorized - Invalid Credentials
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "timestamp": "2026-08-12T10:00:00Z"
  }
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An error occurred during login",
    "timestamp": "2026-08-12T10:00:00Z"
  }
}
```

## Implementation Details

### 1. User Lookup

The endpoint queries the `users` table:

```typescript
// Find user by email, optionally filtered by company_id
const { data: user } = await supabase
  .from('users')
  .select('*')
  .eq('email', email)
  .eq('company_id', companyId)      // If provided
  .eq('deleted_at', null)            // Exclude deleted users
  .single();
```

### 2. Password Verification

Uses bcrypt for secure password comparison:

```typescript
const passwordValid = await verifyPassword(
  plainPassword,
  user.password_hash
);
```

Benefits:
- One-way hashing (bcrypt cannot be reversed)
- Salt included in hash (different hash for same password)
- Timing-attack resistant
- Configured with 12 rounds by default

### 3. JWT Token Generation

Generates RS256-signed tokens with claims:

```typescript
const tokens = await generateTokens({
  userId: user.id,
  email: user.email,
  roles: [user.role],
  tenantId: user.company_id  // Company ID as tenant
});
```

**Access Token Claims:**
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "roles": ["user"],
  "tenantId": "company-id",
  "iat": 1629129600,
  "exp": 1629133200,
  "iss": "iaezap",
  "aud": "iaezap-api"
}
```

### 4. Cookies

Two cookies are set for convenience:

| Name | HTTPOnly | Secure | Duration | Purpose |
|------|----------|--------|----------|---------|
| `access_token` | No | Yes (prod) | 1 hour | Client-side JWT access |
| `refresh_token` | Yes | Yes (prod) | 7 days | Secure token refresh |

## Client Usage

### JavaScript/TypeScript

```typescript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // Include cookies
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123',
    companyId: 'company-uuid',
  }),
});

const data = await response.json();

if (data.success) {
  // Store tokens
  localStorage.setItem('accessToken', data.access_token);
  localStorage.setItem('refreshToken', data.refresh_token);
  
  // Use in API requests
  const apiResponse = await fetch('/api/protected', {
    headers: {
      'Authorization': `Bearer ${data.access_token}`,
    },
  });
}
```

### Using with cURL

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123",
    "companyId": "550e8400-e29b-41d4-a716-446655440000"
  }' \
  -c cookies.txt
```

## Token Verification

To verify tokens in protected routes, use the middleware:

```typescript
import { withAuth } from '@/lib/jwt';

export const GET = withAuth(async (request) => {
  const user = request.user; // JwtClaims
  return NextResponse.json({ userId: user.user_id });
});
```

## Password Hashing

When creating users, hash passwords before storing:

```typescript
import { hashPassword } from '@/lib/auth';

const hashedPassword = await hashPassword(plainPassword);

await supabase
  .from('users')
  .insert({
    email,
    password_hash: hashedPassword,
    company_id,
    role: 'user',
  });
```

## Security Considerations

### 1. Password Storage
- ✅ Passwords are hashed with bcrypt before storage
- ✅ 12 rounds of salt for strong security
- ❌ Never log or expose password hashes

### 2. JWT Tokens
- ✅ RS256 ensures token integrity and authenticity
- ✅ Tokens are signed with private key, verified with public key
- ✅ Includes expiration time to limit token lifetime
- ❌ Refresh tokens must be stored securely (HTTP-only cookies)

### 3. Transport
- ✅ Always use HTTPS in production
- ✅ Cookies have Secure flag in production
- ✅ CORS properly configured

### 4. Multi-Tenancy
- ✅ Users are scoped to companies via `company_id`
- ✅ Company ID included in JWT claims for authorization
- ✅ Users cannot access other companies' data

## Troubleshooting

### "JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables are required"

**Solution:** Generate and add keys to `.env.local`:
```bash
node scripts/generate-jwt-keys.js
```

### "User not found" with valid credentials

**Causes:**
1. User doesn't exist in database
2. User's `deleted_at` is not null (soft-deleted)
3. Incorrect company_id provided
4. Email case mismatch

**Debug:**
```sql
SELECT id, email, company_id, deleted_at FROM users WHERE email = 'user@example.com';
```

### "Invalid email or password" even with correct credentials

**Causes:**
1. Password hash corrupted
2. `password_hash` column is NULL
3. Bcrypt configuration issue

**Debug:**
- Verify `password_hash` exists and is not NULL
- Regenerate password hash if needed

### Tokens not working in requests

**Check:**
1. Token is in Authorization header: `Bearer <token>`
2. Token hasn't expired (check `expires_in`)
3. Public key matches private key (regenerate if mismatched)
4. Token issuer/audience matches configuration

## Related Documentation

- [JWT Configuration](/docs/JWT_CONFIG.md)
- [Password Hashing](/docs/PASSWORD_SECURITY.md)
- [Token Refresh](/docs/TOKEN_REFRESH.md)
- [Multi-Tenant Architecture](/docs/MULTI_TENANCY.md)
