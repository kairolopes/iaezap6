# Authentication API - Login Endpoint

## Overview

Complete POST `/api/auth/login` endpoint implementation with:
- **Zod validation** for email and password
- **Supabase Auth integration** for credential verification
- **JWT token management** with access and refresh tokens
- **Comprehensive error handling** (400, 401, 500 status codes)
- **"Remember Me" cookie support** for persistent sessions

## Endpoint Details

### Route
```
POST /api/auth/login
```

### Request Headers
```
Content-Type: application/json
```

### Request Body
```json
{
  "email": "user@example.com",
  "password": "password123",
  "rememberMe": false
}
```

**Field Validation:**
- `email`: Required, must be valid email format, lowercased, trimmed
- `password`: Required, 6-128 characters
- `rememberMe`: Optional, boolean (default: false)

### Success Response (200 OK)
```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["user"],
    "createdAt": "2026-08-12T10:00:00Z",
    "updatedAt": "2026-08-12T10:00:00Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900,
    "tokenType": "Bearer"
  }
}
```

**Cookies Set:**
- `access_token`: HTTP-only cookie (if rememberMe=true)
- `refresh_token`: HTTP-only cookie (if rememberMe=true), expires in 7 days

### Error Responses

#### 400 Bad Request (Validation Error)
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Validation failed",
    "details": {
      "email": ["Invalid email format"],
      "password": ["Password must be at least 6 characters"]
    },
    "timestamp": "2026-08-12T10:00:00Z"
  }
}
```

#### 401 Unauthorized (Invalid Credentials)
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

### Files Created

#### 1. `src/app/api/auth/login/route.ts`
- Main endpoint handler
- Validates request using Zod schema
- Authenticates with Supabase Auth
- Returns JWT tokens and user information
- Sets HTTP-only cookies for "Remember Me"

#### 2. `src/lib/supabase.ts`
- `createSupabaseServerClient()`: Creates admin client for server operations
- `createSupabaseAnonClient()`: Creates public client for user operations
- `authenticateUser(email, password)`: Authenticates user with Supabase
- `getUserInfo(userId)`: Retrieves user information

#### 3. `src/lib/jwt.ts`
- `decodeToken(token)`: Decodes JWT without verification
- `isTokenExpired(token)`: Checks if token is expired
- `getTokenExpiresIn(token)`: Gets remaining token lifetime
- `validateToken(token)`: Validates token structure and expiration
- `extractUserIdFromToken(token)`: Extracts user ID from token
- `extractEmailFromToken(token)`: Extracts email from token
- `extractRolesFromToken(token)`: Extracts roles from token

#### 4. `src/lib/tokenBlacklist.ts`
- `blacklistToken(token, expiresInHours)`: Adds token to blacklist
- `isTokenBlacklisted(token)`: Checks if token is blacklisted
- `cleanupExpiredBlacklist()`: Removes expired blacklist entries

#### 5. `src/app/api/auth/logout/route.ts`
- Logout endpoint that blacklists tokens
- Accepts token from body or Authorization header

### Configuration

#### Environment Variables Required
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### TypeScript Configuration
Updated `tsconfig.json`:
- `baseUrl`: "."
- `@/*`: Points to `./src/*` for clean imports

## Usage Examples

### Using Fetch API
```javascript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123',
    rememberMe: true,
  }),
});

const data = await response.json();

if (data.success) {
  // Store tokens
  localStorage.setItem('accessToken', data.tokens.accessToken);
  localStorage.setItem('refreshToken', data.tokens.refreshToken);
  console.log('User:', data.user);
} else {
  console.error('Login failed:', data.error.message);
}
```

### Using Axios
```javascript
import axios from 'axios';

try {
  const response = await axios.post('/api/auth/login', {
    email: 'user@example.com',
    password: 'password123',
    rememberMe: false,
  });

  const { tokens, user } = response.data;
  // Handle successful login
} catch (error) {
  if (error.response?.status === 401) {
    console.error('Invalid credentials');
  } else if (error.response?.status === 400) {
    console.error('Validation error:', error.response.data.error.details);
  }
}
```

### Using cURL
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "rememberMe": true
  }'
```

## Database Requirements

For token blacklist functionality, create a `token_blacklist` table in Supabase:

```sql
CREATE TABLE token_blacklist (
  id BIGSERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  CONSTRAINT delete_expired AFTER INSERT ON token_blacklist
    FOR EACH ROW DELETE FROM token_blacklist WHERE expires_at < NOW()
);

CREATE INDEX idx_token_blacklist_expires_at ON token_blacklist(expires_at);
```

## Error Codes Reference

| Code | HTTP | Description |
|------|------|-------------|
| INVALID_CREDENTIALS | 401 | Email/password incorrect or validation failed |
| USER_NOT_FOUND | 401 | User does not exist |
| INTERNAL_SERVER_ERROR | 500 | Server error during login |
| BAD_REQUEST | 400 | Invalid request format |

## Token Expiration

- **Access Token**: 15 minutes (configurable via TOKEN_EXPIRATION.ACCESS)
- **Refresh Token**: 7 days (configurable via TOKEN_EXPIRATION.REFRESH)
- **Remember Me Cookie**: 7 days

## Security Considerations

1. **HTTP-only Cookies**: Refresh tokens stored in HTTP-only cookies prevent XSS attacks
2. **Password Validation**: Zod schema enforces length requirements
3. **Email Validation**: RFC-compliant email validation
4. **Token Blacklist**: Invalidated tokens are blacklisted in the database
5. **CORS**: OPTIONS handler implements basic CORS support
6. **Secure Flag**: Cookies use secure flag in production
7. **SameSite**: Cookies use SameSite=Lax to prevent CSRF

## Token Usage

Include the access token in subsequent requests:

```javascript
const response = await fetch('/api/protected-route', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
});
```

## Integration with Protected Routes

Use the `withTokenAuth` helper from `src/lib/middleware`:

```typescript
import { withTokenAuth } from '@/lib/middleware';

export async function POST(request: NextRequest) {
  return withTokenAuth(request, async (req, token) => {
    // Your protected route logic here
    return NextResponse.json({ message: 'Success' });
  });
}
```

## Testing

All validation schemas and helper functions are thoroughly tested with:
- Valid credentials
- Invalid email format
- Weak passwords
- Missing fields
- Expired tokens
- Blacklisted tokens
