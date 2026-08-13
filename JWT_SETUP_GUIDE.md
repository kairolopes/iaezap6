# JWT Utilities Setup Guide for IAeZap

## Overview

JWT utilities have been created at `src/lib/jwt.ts` with full support for RS256 (RSA) signing and verification. The implementation includes:

- Token signing with RS256 algorithm
- Token verification and claim extraction
- Route protection middleware
- Role-based access control (RBAC)
- Token expiration handling

## 1. Generate RSA Keys

### Option A: Using OpenSSL (Recommended)

```bash
# Generate private key (2048-bit RSA)
openssl genrsa -out private.key 2048

# Extract public key from private key
openssl rsa -in private.key -pubout -out public.key

# View the keys
cat private.key
cat public.key
```

### Option B: Using Node.js

Create a script `generate-keys.js`:

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

console.log('Private Key:');
console.log(privateKey);
console.log('\nPublic Key:');
console.log(publicKey);

fs.writeFileSync('private.key', privateKey);
fs.writeFileSync('public.key', publicKey);
```

Then run:
```bash
node generate-keys.js
```

## 2. Configure Environment Variables

Add the following to `.env.local`:

```env
# JWT Configuration
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQE...\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQE...\n-----END PUBLIC KEY-----"
JWT_ISSUER=iaezap
JWT_AUDIENCE=iaezap-api
JWT_ACCESS_TOKEN_EXPIRY=3600
JWT_REFRESH_TOKEN_EXPIRY=604800
```

**Important**: When copying keys with newlines:
- Replace actual newlines with `\n` escape sequences
- Or use a `.env` parser that handles multiline values

## 3. JWT Claims Structure

All tokens include these claims:

```typescript
{
  user_id: string;      // User ID from auth system
  company_id: string;   // Company/Organization ID
  email: string;        // User email address
  role: string;         // User role (e.g., "admin", "user", "manager")
  iat: number;          // Issued at (timestamp)
  exp: number;          // Expiration time (timestamp)
  iss: string;          // Issuer (default: "iaezap")
  aud: string;          // Audience (default: "iaezap-api")
}
```

## 4. API Usage Examples

### 4.1 Generate Tokens

```typescript
import { generateTokenPair, generateAccessToken, generateRefreshToken } from '@/lib/jwt';

// Generate access and refresh token pair
const tokens = generateTokenPair(
  'user_123',           // userId
  'company_456',        // companyId
  'user@example.com',   // email
  'admin'               // role
);

console.log(tokens);
// {
//   accessToken: "eyJhbGciOiJSUzI1NiIs...",
//   refreshToken: "eyJhbGciOiJSUzI1NiIs...",
//   expiresIn: 3600,
//   tokenType: "Bearer"
// }

// Generate only access token
const accessToken = generateAccessToken(
  'user_123',
  'company_456',
  'user@example.com',
  'user'
);

// Generate only refresh token
const refreshToken = generateRefreshToken('user_123', 'company_456');
```

### 4.2 Verify and Extract Claims

```typescript
import { verifyToken, extractClaimsWithoutVerification, isTokenExpired } from '@/lib/jwt';

// Verify token (validates signature and expiration)
const claims = verifyToken(accessToken);

if (claims) {
  console.log(`User: ${claims.user_id}, Company: ${claims.company_id}`);
} else {
  console.log('Token is invalid or expired');
}

// Extract claims without verification (fast, use only if you trust the source)
const claimsUnverified = extractClaimsWithoutVerification(accessToken);

// Check expiration
const isExpired = isTokenExpired(accessToken);
```

### 4.3 Protect API Routes

#### Basic Authentication

```typescript
// app/api/protected/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/jwt';

async function handler(request) {
  const user = request.user;
  
  return NextResponse.json({
    message: `Hello ${user.email}, you are from company ${user.company_id}`,
    user,
  });
}

export const POST = withAuth(handler);
```

#### Role-Based Access Control

```typescript
// app/api/admin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withRoleAuth } from '@/lib/jwt';

async function handler(request) {
  const user = request.user;
  
  return NextResponse.json({
    message: `Admin action by ${user.email}`,
    user,
  });
}

// Only allow users with "admin" or "super_admin" roles
export const POST = withRoleAuth(handler, ['admin', 'super_admin']);
```

#### Optional Authentication

```typescript
// app/api/public/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withOptionalAuth, getUserFromRequest } from '@/lib/jwt';

async function handler(request) {
  const user = getUserFromRequest(request);
  
  if (user) {
    return NextResponse.json({
      message: `Authenticated request from ${user.email}`,
      user,
    });
  } else {
    return NextResponse.json({
      message: 'Public content (no authentication)',
    });
  }
}

export const GET = withOptionalAuth(handler);
```

### 4.4 Extract Token from Request

```typescript
import { extractTokenFromRequest, extractTokenFromRequestAdvanced } from '@/lib/jwt';
import { NextRequest } from 'next/server';

// Extract from Authorization header only
const token = extractTokenFromRequest(request);

// Extract from multiple sources: header, cookie, query param
const tokenAdvanced = extractTokenFromRequestAdvanced(request);
```

## 5. Integration Examples

### 5.1 Login Endpoint

```typescript
// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateTokenPair } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate credentials (implement your auth logic)
    // const user = await validateCredentials(email, password);
    
    // For example:
    const user = {
      id: 'user_123',
      company_id: 'company_456',
      email,
      role: 'user',
    };

    // Generate tokens
    const tokens = generateTokenPair(
      user.id,
      user.company_id,
      user.email,
      user.role
    );

    return NextResponse.json(
      {
        success: true,
        data: tokens,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Login failed',
      },
      { status: 401 }
    );
  }
}
```

### 5.2 Refresh Token Endpoint

```typescript
// app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, generateAccessToken } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

    // Verify refresh token
    const claims = verifyToken(refreshToken);
    
    if (!claims) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid refresh token',
        },
        { status: 401 }
      );
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(
      claims.user_id,
      claims.company_id,
      claims.email,
      claims.role
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          accessToken: newAccessToken,
          tokenType: 'Bearer',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Token refresh failed',
      },
      { status: 401 }
    );
  }
}
```

### 5.3 Protected API Endpoint

```typescript
// app/api/users/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/jwt';

async function handler(request: NextRequest) {
  const user = request.user;

  // Now you have access to user claims
  return NextResponse.json(
    {
      success: true,
      data: {
        userId: user.user_id,
        email: user.email,
        companyId: user.company_id,
        role: user.role,
      },
    },
    { status: 200 }
  );
}

export const GET = withAuth(handler);
```

## 6. Testing with cURL

### Get Access Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJSUzI1NiIs...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

### Use Token to Access Protected Route

```bash
curl -X GET http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

Response:
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "email": "user@example.com",
    "companyId": "company_456",
    "role": "admin"
  }
}
```

## 7. Security Best Practices

1. **Store Keys Securely**
   - Never commit keys to git
   - Use environment variables
   - In production, use secret management (AWS Secrets Manager, HashiCorp Vault, etc.)

2. **HTTPS Only**
   - Always use HTTPS in production
   - Set `secure` flag on cookies containing tokens

3. **Token Storage**
   - Store access tokens in memory or secure cookies
   - Store refresh tokens in secure, httpOnly cookies
   - Avoid storing sensitive tokens in localStorage

4. **Token Rotation**
   - Implement token refresh mechanism
   - Rotate refresh tokens on use (if desired)
   - Maintain token blacklist for logout

5. **Expiration Times**
   - Keep access tokens short-lived (15 minutes - 1 hour)
   - Refresh tokens can be longer (days to weeks)
   - Implement token refresh flow

6. **Error Handling**
   - Don't leak information in error messages
   - Use generic error messages ("Invalid token" not "Token signature verification failed")
   - Log security events

## 8. Troubleshooting

### "JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables are required"

**Solution**: Generate RSA keys and add them to `.env.local` as shown in Section 2.

### "Invalid signature" or "Token verification failed"

**Possible Causes**:
- Keys mismatch: Using different keys for signing and verification
- Key format: Ensure keys are in PEM format
- Encoding: Check newline characters are properly escaped

**Solution**: Verify keys match and are properly formatted.

### Token Expiration Issues

**If tokens expire too quickly**:
```env
JWT_ACCESS_TOKEN_EXPIRY=7200  # 2 hours instead of 1
```

**If tokens don't expire**:
- Check `exp` claim in token (use jwt.io to decode)
- Verify clock synchronization across servers

## 9. File Locations

- **JWT Utilities**: `src/lib/jwt.ts`
- **Setup Guide**: `JWT_SETUP_GUIDE.md` (this file)
- **Example Usage**: See Integration Examples in this guide

## 10. Available Functions

| Function | Purpose |
|----------|---------|
| `signToken(claims, expiresIn?)` | Sign a token with custom expiration |
| `generateAccessToken(...)` | Generate access token |
| `generateRefreshToken(...)` | Generate refresh token |
| `generateTokenPair(...)` | Generate both tokens |
| `verifyToken(token)` | Verify and extract claims |
| `extractClaimsWithoutVerification(token)` | Extract claims without verification |
| `isTokenExpired(token)` | Check if token is expired |
| `getTokenExpiryTime(token)` | Get remaining seconds until expiration |
| `extractTokenFromRequest(request)` | Extract token from Authorization header |
| `extractTokenFromRequestAdvanced(request)` | Extract from header, cookie, or query |
| `withAuth(handler)` | Middleware for required authentication |
| `withOptionalAuth(handler)` | Middleware for optional authentication |
| `withRoleAuth(handler, roles)` | Middleware for role-based access control |
| `getUserFromRequest(request)` | Get user claims from request |

## Next Steps

1. Generate RSA keys using OpenSSL or Node.js
2. Add keys to `.env.local`
3. Update authentication endpoints to use new JWT utilities
4. Protect API routes with middleware
5. Test with provided cURL examples
