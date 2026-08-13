# JWT Implementation - Quick Start

## What Was Created

### 1. Core JWT Utilities
**File**: `src/lib/jwt.ts` (444 lines)

Complete JWT implementation with RS256 signing including:
- Token generation and verification
- JWT claims extraction  
- Route protection middleware
- Role-based access control
- RSA key management

### 2. Setup Guide
**File**: `JWT_SETUP_GUIDE.md`

Comprehensive guide covering:
- RSA key generation (OpenSSL & Node.js)
- Environment variable configuration
- All available functions and their usage
- Testing with cURL
- Security best practices
- Troubleshooting

### 3. Implementation Examples
**File**: `JWT_EXAMPLES.md`

10 ready-to-use examples:
1. Login endpoint
2. Refresh token endpoint
3. Protected user profile
4. Admin-only endpoints
5. Role-based data filtering
6. Public endpoints with optional auth
7. Logout endpoint
8. Client-side token management (React hook)
9. API client with auto-refresh
10. Jest test examples

### 4. Key Generation Script
**File**: `scripts/generate-jwt-keys.js`

Automated RSA key pair generation:
```bash
node scripts/generate-jwt-keys.js
```

Outputs keys in `.env.local` format.

### 5. Environment Configuration
**File**: `.env.example` (updated)

Added JWT configuration template:
```env
JWT_PRIVATE_KEY="..."
JWT_PUBLIC_KEY="..."
JWT_ISSUER=iaezap
JWT_AUDIENCE=iaezap-api
JWT_ACCESS_TOKEN_EXPIRY=3600
JWT_REFRESH_TOKEN_EXPIRY=604800
```

## Getting Started (5 Minutes)

### Step 1: Generate RSA Keys
```bash
node scripts/generate-jwt-keys.js
```

### Step 2: Add Keys to .env.local
Copy the JWT configuration from the script output to `.env.local`

### Step 3: Use in Your Code

**Generate tokens:**
```typescript
import { generateTokenPair } from '@/lib/jwt';

const tokens = generateTokenPair(
  'user_123',
  'company_456',
  'user@example.com',
  'admin'
);
```

**Protect routes:**
```typescript
import { withAuth } from '@/lib/jwt';

async function handler(request) {
  const user = request.user;
  // user has: user_id, company_id, email, role
  return NextResponse.json({ user });
}

export const GET = withAuth(handler);
```

**Test it:**
```bash
# Get token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"demo123"}' \
  | jq -r '.data.accessToken')

# Use token
curl -X GET http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer $TOKEN"
```

## Main Functions

| Function | Purpose |
|----------|---------|
| `generateAccessToken()` | Create short-lived access token |
| `generateRefreshToken()` | Create long-lived refresh token |
| `generateTokenPair()` | Create both tokens |
| `verifyToken()` | Validate and extract claims |
| `withAuth()` | Middleware requiring authentication |
| `withRoleAuth()` | Middleware requiring specific role |
| `withOptionalAuth()` | Middleware with optional auth |
| `extractTokenFromRequest()` | Get token from request header |

## Token Structure

All tokens include these claims:
```json
{
  "user_id": "user_123",
  "company_id": "company_456",
  "email": "user@example.com",
  "role": "admin",
  "iat": 1692432000,
  "exp": 1692435600,
  "iss": "iaezap",
  "aud": "iaezap-api"
}
```

## Security Checklist

- [x] RS256 algorithm (asymmetric, more secure than HS256)
- [x] Configurable token expiry
- [x] Role-based access control
- [x] Token verification with public key
- [x] Middleware for route protection
- [ ] TODO: Add token blacklist for logout
- [ ] TODO: Implement CORS/CSRF protection
- [ ] TODO: Add rate limiting

## Integration with Existing Code

The new JWT utilities work alongside the existing auth system:
- Existing `src/lib/auth/tokens.ts` uses HS256
- New `src/lib/jwt.ts` uses RS256
- Can coexist or gradually migrate

**To migrate**:
1. Update login endpoint to use `generateTokenPair()`
2. Update refresh endpoint to use `verifyToken()`
3. Replace `withAuth()` usage in route handlers
4. Update client to send tokens in Authorization header

## Environment Variables Required

```env
# Required - Generated RSA keys
JWT_PRIVATE_KEY=...
JWT_PUBLIC_KEY=...

# Optional - Defaults provided
JWT_ISSUER=iaezap              # Who issued the token
JWT_AUDIENCE=iaezap-api        # Who can use the token
JWT_ACCESS_TOKEN_EXPIRY=3600   # 1 hour
JWT_REFRESH_TOKEN_EXPIRY=604800 # 7 days
```

## File Locations

```
iaezap6/
├── src/
│   └── lib/
│       └── jwt.ts                 # Main JWT utilities
├── scripts/
│   └── generate-jwt-keys.js       # Key generation script
├── JWT_SETUP_GUIDE.md             # Full setup guide
├── JWT_EXAMPLES.md                # 10 implementation examples
├── JWT_QUICK_START.md             # This file
└── .env.example                   # Updated with JWT config
```

## Next Steps

1. **Generate keys**: `node scripts/generate-jwt-keys.js`
2. **Configure environment**: Add keys to `.env.local`
3. **Update auth endpoints**: Use new JWT functions
4. **Protect routes**: Apply middleware to endpoints
5. **Test thoroughly**: Use provided examples
6. **Deploy**: Ensure keys are in production secrets manager

## Common Issues

**"JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables are required"**
- Run: `node scripts/generate-jwt-keys.js`
- Add keys to `.env.local`

**"Token verification failed"**
- Check keys match (same pair for signing and verification)
- Ensure newlines are properly escaped as `\n`
- Verify keys are in PEM format

**"Token is always expired"**
- Check system clock synchronization
- Verify `exp` claim in token (decode at jwt.io)
- Adjust `JWT_ACCESS_TOKEN_EXPIRY` if needed

## Support Files

For complete documentation, see:
- `JWT_SETUP_GUIDE.md` - Comprehensive setup and configuration
- `JWT_EXAMPLES.md` - Ready-to-use code examples
- `src/lib/jwt.ts` - Function signatures and JSDoc comments

## Dependency Requirements

Already installed in `package.json`:
- `jsonwebtoken` (^9.0.3)
- `@types/jsonwebtoken` (^9.0.10)

No additional packages needed!

---

**Questions?** Check JWT_SETUP_GUIDE.md for detailed documentation.
