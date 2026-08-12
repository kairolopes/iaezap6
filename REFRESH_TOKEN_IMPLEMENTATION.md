# Refresh Token Implementation

This document describes the implementation of the POST `/api/auth/refresh` endpoint with token rotation support.

## Overview

The refresh token endpoint allows clients to obtain a new access token using a valid refresh token. It includes security features like:

- JWT validation and expiry checking
- Token rotation (old refresh tokens are revoked automatically)
- Token revocation tracking in database
- Proper error handling and security headers
- Rate limiting considerations

## Files Created

### 1. Endpoint
- **`app/api/auth/refresh/route.ts`** - Main POST endpoint that handles token refresh requests

### 2. Token Utilities
- **`app/lib/auth/tokens.ts`** - Token generation, validation, and verification functions
- **`app/lib/auth/types.ts`** - TypeScript type definitions
- **`app/lib/auth/supabase.ts`** - Supabase database operations for token tracking
- **`app/lib/auth/index.ts`** - Barrel export for all auth utilities

### 3. Database
- **`app/lib/auth/migrations.sql`** - SQL migrations to create required tables

## API Usage

### Request

```bash
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Successful Response (200 OK)

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

### Error Responses

**Invalid JSON (400)**
```json
{
  "success": false,
  "error": "Invalid JSON in request body",
  "code": "INVALID_JSON"
}
```

**Missing Refresh Token (400)**
```json
{
  "success": false,
  "error": "Refresh token is required and must be a string",
  "code": "MISSING_REFRESH_TOKEN"
}
```

**Invalid Token (401)**
```json
{
  "success": false,
  "error": "Invalid refresh token",
  "code": "INVALID_REFRESH_TOKEN"
}
```

**Expired Token (401)**
```json
{
  "success": false,
  "error": "Refresh token has expired",
  "code": "EXPIRED_REFRESH_TOKEN"
}
```

**Revoked Token (401)**
```json
{
  "success": false,
  "error": "Refresh token has been revoked",
  "code": "REVOKED_REFRESH_TOKEN"
}
```

**Invalid Content-Type (400)**
```json
{
  "success": false,
  "error": "Content-Type must be application/json",
  "code": "INVALID_CONTENT_TYPE"
}
```

**Server Error (500)**
```json
{
  "success": false,
  "error": "Internal server error",
  "code": "INTERNAL_ERROR"
}
```

## Token Specifications

### Access Token
- **Algorithm**: HS256 (HMAC with SHA-256)
- **Expiry**: 1 hour (3600 seconds)
- **Audience**: `authenticated`
- **Claims**: 
  - `sub`: User ID
  - `iss`: `supabase`
  - `iat`: Issued at timestamp
  - `exp`: Expiration timestamp
  - `aud`: `authenticated`
  - `role`: User role (optional, defaults to "authenticated")
  - `email`: User email (optional)

### Refresh Token
- **Algorithm**: HS256
- **Expiry**: 7 days
- **Audience**: `authenticated`
- **Claims**: Same as access token

## Token Rotation

Token rotation is implemented for security purposes:

1. When a refresh token is used to get a new access token, a new refresh token is also generated
2. The old refresh token hash is stored in the `token_rotations` table
3. Subsequent requests with the old refresh token will be rejected (revoked)
4. This prevents token reuse in case of compromise

## Database Setup

### Create the required table

Run the SQL migrations in your Supabase dashboard:

```sql
CREATE TABLE IF NOT EXISTS token_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  old_refresh_token_hash TEXT NOT NULL UNIQUE,
  new_refresh_token_hash TEXT NOT NULL UNIQUE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  CONSTRAINT token_rotations_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_token_rotations_user_id
  ON token_rotations(user_id);

CREATE INDEX IF NOT EXISTS idx_token_rotations_new_hash
  ON token_rotations(new_refresh_token_hash);

CREATE INDEX IF NOT EXISTS idx_token_rotations_old_hash
  ON token_rotations(old_refresh_token_hash);

CREATE INDEX IF NOT EXISTS idx_token_rotations_expires_at
  ON token_rotations(expires_at);
```

### Row Level Security (RLS)

For production, consider adding RLS policies:

```sql
-- Enable RLS
ALTER TABLE token_rotations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own token rotations
CREATE POLICY "Users can view own token rotations"
  ON token_rotations FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert/update for token management
CREATE POLICY "Service role manages token rotations"
  ON token_rotations FOR ALL
  USING (auth.role() = 'service_role');
```

## Client-Side Usage Example

```typescript
// Refresh access token
async function refreshAccessToken(refreshToken: string) {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to refresh token');
  }

  const { data } = await response.json();
  return data; // { accessToken, refreshToken, expiresIn, tokenType }
}

// Usage in a React component with auto-refresh
function useAuthRefresh(refreshToken: string | null) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [newRefreshToken, setNewRefreshToken] = useState<string | null>(refreshToken);

  useEffect(() => {
    if (!newRefreshToken) return;

    // Refresh token 5 minutes before expiry
    const refreshInterval = (3600 - 300) * 1000; // 55 minutes

    const interval = setInterval(async () => {
      try {
        const tokens = await refreshAccessToken(newRefreshToken);
        setAccessToken(tokens.accessToken);
        setNewRefreshToken(tokens.refreshToken);
      } catch (error) {
        console.error('Token refresh failed:', error);
        // Handle logout or redirect to login
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [newRefreshToken]);

  return { accessToken, refreshToken: newRefreshToken };
}
```

## Security Considerations

1. **HTTPS Only**: Always use HTTPS in production to prevent token interception
2. **HttpOnly Cookies**: Consider storing refresh tokens in HttpOnly cookies instead of localStorage
3. **CSRF Protection**: Implement CSRF tokens if using cookies
4. **Rate Limiting**: Add rate limiting to the refresh endpoint to prevent brute force attacks
5. **Token Expiry**: Access tokens expire after 1 hour, refresh tokens after 7 days
6. **Revocation**: Old refresh tokens are immediately marked as revoked after use
7. **Secure Headers**: Response includes proper cache-control headers to prevent caching

## Configuration

The implementation uses environment variables:

- **`SUPABASE_SERVICE_ROLE_KEY`**: Used as JWT secret for token signing/verification
- **`NEXT_PUBLIC_SUPABASE_URL`**: Supabase project URL

Both are already configured in `.env.local`.

## Advanced Features

### Token Revocation

To revoke a specific refresh token:

```typescript
import { revokeRefreshToken, hashToken } from '@/app/lib/auth';

const tokenToRevoke = 'user-refresh-token';
const tokenHash = hashToken(tokenToRevoke);
await revokeRefreshToken(tokenHash);
```

### Check Token Status

```typescript
import { isTokenRevoked, hashToken } from '@/app/lib/auth';

const tokenHash = hashToken(refreshToken);
const revoked = await isTokenRevoked(tokenHash);
```

### Extract User Information

```typescript
import { extractUserIdFromToken } from '@/app/lib/auth';

const userId = extractUserIdFromToken(accessToken);
```

### Get Token Expiry Time

```typescript
import { getTokenExpiryTime } from '@/app/lib/auth';

const secondsUntilExpiry = getTokenExpiryTime(accessToken);
```

## Testing

### Using cURL

```bash
# Get a valid refresh token first (from login endpoint)
REFRESH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Test refresh endpoint
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

### Using Fetch API

```javascript
const response = await fetch('/api/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    refreshToken: 'your-refresh-token-here'
  })
});

const result = await response.json();
console.log(result);
```

## Troubleshooting

### "Invalid refresh token"
- Ensure the token is a valid JWT
- Check that the token hasn't expired
- Verify the token was generated with the same secret key

### "Refresh token has expired"
- The refresh token's expiry time has passed (7 days)
- User needs to log in again to get new tokens

### "Refresh token has been revoked"
- This token was already used for a refresh operation
- The new refresh token from the previous operation should be used instead

### "Missing Supabase environment variables"
- Ensure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

## Performance Optimization

The implementation includes:

1. **Indexed Database Queries**: Token hash lookups use indexes
2. **JWT Verification**: Uses fast synchronous verification
3. **Minimal Database Calls**: Only checks revocation status when needed
4. **Proper Error Codes**: Clients can differentiate error types without retries

## Future Enhancements

1. Add rate limiting per user/IP
2. Implement device tracking for token rotation
3. Add multi-device logout functionality
4. Implement sliding window token refresh
5. Add token metadata (device, browser, IP)
6. Implement adaptive authentication based on risk
