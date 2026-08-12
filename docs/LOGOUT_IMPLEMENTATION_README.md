# Logout Endpoint Implementation

## Overview

This is a complete, production-ready implementation of a POST `/api/auth/logout` endpoint for Next.js 16 with Supabase backend. The endpoint invalidates authentication tokens by adding them to a database blacklist, preventing further use.

## Features

✅ Token invalidation via database blacklist  
✅ Flexible token input (request body or Authorization header)  
✅ Token format validation  
✅ Error handling and logging  
✅ Token verification middleware for protected routes  
✅ Database initialization utilities  
✅ Comprehensive documentation and examples  
✅ Unit test examples  

## Architecture

```
Logout Request
    ↓
Parse Token (body or header)
    ↓
Validate Token Format
    ↓
Add to Blacklist Table
    ↓
Return Success/Error Response

Protected Route Request
    ↓
Verify Token Format
    ↓
Check if Blacklisted
    ↓
Allow/Deny Access
```

## File Structure

```
app/api/auth/
├── logout/
│   └── route.ts                    # Main logout endpoint (POST)
├── utils/
│   ├── tokenBlacklist.ts           # Token blacklist utilities
│   └── dbInit.ts                   # Database initialization utilities
├── middleware/
│   └── verifyToken.ts              # Token verification middleware
└── example/
    └── protected-route.example.ts  # Example protected route

docs/
├── LOGOUT_API_SETUP.md             # Setup and configuration guide
└── LOGOUT_IMPLEMENTATION_README.md # This file

__tests__/
└── api/auth/
    └── logout.test.example.ts      # Unit test examples
```

## Quick Start

### 1. Install Dependencies

```bash
npm install @supabase/supabase-js
```

### 2. Create Database Table

In Supabase SQL Editor, run:

```sql
CREATE TABLE IF NOT EXISTS token_blacklist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_token_blacklist_token ON token_blacklist(token);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);

-- Optional: Enable RLS
ALTER TABLE token_blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access" ON token_blacklist
  AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true) TO service_role;
```

### 3. Test the Endpoint

```bash
# Using cURL
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Using JavaScript
fetch('/api/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
  }
}).then(res => res.json()).then(data => console.log(data));
```

## Core Components

### 1. Logout Endpoint (`app/api/auth/logout/route.ts`)

The main HTTP endpoint that handles logout requests.

**Features:**
- Accepts token from request body or Authorization header
- Validates token format
- Calls blacklist utility to invalidate token
- Returns appropriate status codes (200, 400, 500)

**Usage:**
```typescript
POST /api/auth/logout

// Option 1: Authorization Header
Authorization: Bearer <token>

// Option 2: Request Body
{
  "token": "<token>"
}

// Response
{
  "success": true,
  "message": "Successfully logged out. Token has been invalidated."
}
```

### 2. Token Blacklist Utilities (`app/api/auth/utils/tokenBlacklist.ts`)

Core utility functions for managing the token blacklist.

**Functions:**

#### `blacklistToken(token, expiresInHours)`
Adds a token to the blacklist.

```typescript
const result = await blacklistToken('token-here', 24);
if (result.success) {
  console.log('Token blacklisted');
}
```

#### `isTokenBlacklisted(token)`
Checks if a token is blacklisted.

```typescript
const { isBlacklisted } = await isTokenBlacklisted('token-here');
if (isBlacklisted) {
  return new Response('Unauthorized', { status: 401 });
}
```

#### `cleanupExpiredBlacklist()`
Removes expired entries from the blacklist.

```typescript
const result = await cleanupExpiredBlacklist();
console.log(`Deleted ${result.deletedCount} expired tokens`);
```

### 3. Token Verification Middleware (`app/api/auth/middleware/verifyToken.ts`)

Middleware to protect API routes by verifying tokens aren't blacklisted.

**Usage:**
```typescript
export async function GET(request: NextRequest) {
  return withTokenAuth(request, async (req, token) => {
    // Token is verified and not blacklisted
    return NextResponse.json({ data: 'protected' });
  });
}
```

### 4. Database Initialization (`app/api/auth/utils/dbInit.ts`)

Utilities for database setup and verification.

**Functions:**

#### `initializeTokenBlacklistTable()`
Checks if the table exists and provides setup instructions.

```typescript
const result = await initializeTokenBlacklistTable();
console.log(result.message);
```

#### `verifyTokenBlacklistTable()`
Tests the table with a test insert/delete operation.

```typescript
const { exists, hasCorrectStructure } = await verifyTokenBlacklistTable();
```

#### `getBlacklistStats()`
Returns statistics about the blacklist.

```typescript
const { totalTokens, activeTokens, expiredTokens } = await getBlacklistStats();
```

## Integration Examples

### React Component with Logout

```typescript
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        localStorage.removeItem('authToken');
        router.push('/login');
      } else {
        const data = await response.json();
        console.error('Logout failed:', data.message);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button 
      onClick={handleLogout} 
      disabled={isLoading}
    >
      {isLoading ? 'Logging out...' : 'Logout'}
    </button>
  );
}
```

### Protected API Route

```typescript
// app/api/user/settings/route.ts
import { withTokenAuth } from '../auth/middleware/verifyToken';

export async function GET(request: NextRequest) {
  return withTokenAuth(request, async (req, token) => {
    // Your protected logic here
    return NextResponse.json({ settings: {} });
  });
}
```

### Server Action with Logout

```typescript
// app/actions/auth.ts
'use server';

import { cookies } from 'next/headers';

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    throw new Error('No auth token found');
  }

  const response = await fetch(
    process.env.NEXT_PUBLIC_API_URL + '/api/auth/logout',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Logout failed');
  }

  // Clear cookies
  cookieStore.delete('auth_token');

  return { success: true };
}
```

## Database Schema

### token_blacklist Table

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key, auto-generated |
| token | TEXT | Unique, the JWT token |
| created_at | TIMESTAMP | When the token was blacklisted |
| expires_at | TIMESTAMP | When the blacklist entry expires |

**Indexes:**
- `idx_token_blacklist_token` - For fast token lookups
- `idx_token_blacklist_expires_at` - For cleanup queries

## Response Status Codes

| Status | Meaning | Example Response |
|--------|---------|------------------|
| 200 | Token successfully invalidated | `{ "success": true, "message": "..." }` |
| 400 | Missing or invalid token | `{ "success": false, "message": "Token is required..." }` |
| 500 | Database or server error | `{ "success": false, "message": "Failed to invalidate..." }` |

## Best Practices

1. **Always use HTTPS** - Tokens are sensitive data
2. **Store tokens securely** - Use httpOnly cookies when possible
3. **Set reasonable expiry** - Default is 24 hours
4. **Clean up regularly** - Run cleanup job periodically
5. **Handle errors gracefully** - Show user-friendly error messages
6. **Log for debugging** - Server logs contain error details
7. **Verify on protected routes** - Use `withTokenAuth` middleware
8. **Validate token format** - Prevents database abuse

## Troubleshooting

### Table Doesn't Exist
**Error:** "Failed to invalidate token"  
**Solution:** Run the SQL migration from `LOGOUT_API_SETUP.md` in Supabase

### Missing Environment Variables
**Error:** "Missing Supabase credentials"  
**Solution:** Add `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`

### Token Not Invalidating
**Error:** Token still works after logout  
**Solution:** Ensure protected routes use `withTokenAuth` middleware

### Unique Constraint Violation
**Error:** This shouldn't happen in normal operation  
**Solution:** Check logs for duplicate logout attempts

## Performance Considerations

- **Token blacklist growth** - Consider cleanup job frequency
- **Database queries** - Indexed lookups are fast
- **Token expiry** - Automatic cleanup prevents table bloat
- **Caching** - Can be added for frequently accessed tokens

## Security Considerations

1. **Service Role Key** - Keep `SUPABASE_SERVICE_ROLE_KEY` secret
2. **Token Storage** - Use secure, httpOnly cookies
3. **HTTPS Only** - Always use in production
4. **Rate Limiting** - Consider adding to prevent abuse
5. **Logging** - Monitor for suspicious logout patterns

## Testing

Unit test examples are provided in `__tests__/api/auth/logout.test.example.ts`

To set up testing:

```bash
npm install --save-dev jest @testing-library/react ts-jest @types/jest
```

Create `jest.config.js`:
```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

module.exports = createJestConfig({
  testEnvironment: 'jest-environment-jsdom',
})
```

Run tests:
```bash
npm test
```

## Deployment Checklist

- [ ] Database table created in Supabase
- [ ] Environment variables set in production
- [ ] Cleanup job scheduled (optional but recommended)
- [ ] Protected routes use `withTokenAuth` middleware
- [ ] Error handling tested
- [ ] Logs monitored for errors
- [ ] Rate limiting configured (optional)
- [ ] Load testing completed

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Authentication](https://owasp.org/www-project-authentication-cheat-sheet/)

## Support

For issues or questions:
1. Check `LOGOUT_API_SETUP.md` for setup instructions
2. Review example files in `app/api/auth/example/`
3. Check test examples in `__tests__/`
4. Review environment variables in `.env.local`
5. Check Supabase logs for database errors

## License

This implementation is provided as-is for use in your project.
