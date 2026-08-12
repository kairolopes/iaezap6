# Logout API Setup Guide

## Overview

The logout endpoint (`POST /api/auth/logout`) invalidates authentication tokens by adding them to a blacklist in Supabase. This prevents the use of tokens after logout.

## Prerequisites

- Supabase project set up
- Environment variables configured:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- `@supabase/supabase-js` package installed (added to `package.json`)

## Database Setup

### Create Token Blacklist Table

In your Supabase dashboard, run the following SQL in the SQL Editor to create the token blacklist table:

```sql
-- Create token_blacklist table
CREATE TABLE IF NOT EXISTS token_blacklist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create index on token for faster lookups
CREATE INDEX IF NOT EXISTS idx_token_blacklist_token ON token_blacklist(token);

-- Create index on expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);

-- Enable RLS (Row Level Security) - optional but recommended
ALTER TABLE token_blacklist ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role full access
CREATE POLICY "Service role has full access" ON token_blacklist
  AS PERMISSIVE
  FOR ALL
  USING (true)
  WITH CHECK (true)
  TO service_role;
```

### Set Up Cleanup (Optional but Recommended)

To periodically remove expired tokens, you can use a PostgreSQL cron job:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup to run daily at 2 AM
SELECT cron.schedule('cleanup-expired-tokens', '0 2 * * *', $$
  DELETE FROM token_blacklist WHERE expires_at < NOW();
$$);
```

## Installation

Install the Supabase JavaScript client:

```bash
npm install @supabase/supabase-js
# or
pnpm add @supabase/supabase-js
# or
yarn add @supabase/supabase-js
```

## API Endpoint

### POST /api/auth/logout

Invalidates a user's authentication token.

#### Request

**Method:** `POST`

**URL:** `/api/auth/logout`

**Option 1: Request Body**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Option 2: Authorization Header**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response

**Success (200 OK):**
```json
{
  "success": true,
  "message": "Successfully logged out. Token has been invalidated."
}
```

**Missing Token (400 Bad Request):**
```json
{
  "success": false,
  "message": "Token is required for logout. Provide it in request body or Authorization header."
}
```

**Invalid Token Format (400 Bad Request):**
```json
{
  "success": false,
  "message": "Invalid token format."
}
```

**Server Error (500 Internal Server Error):**
```json
{
  "success": false,
  "message": "Failed to invalidate token."
}
```

## Usage Examples

### JavaScript/TypeScript Frontend

```typescript
// Using fetch with Authorization header
async function logout(token: string) {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  
  if (response.ok) {
    console.log('Logged out successfully');
    // Clear local storage, redirect to login, etc.
  } else {
    console.error('Logout failed:', data.message);
  }
}

// Using fetch with request body
async function logoutWithBody(token: string) {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  const data = await response.json();
  return data.success;
}
```

### React Hook

```typescript
function useLogout() {
  const logout = async (token: string) => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Clear auth state
        localStorage.removeItem('authToken');
        // Redirect to login
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return { logout };
}
```

### cURL

```bash
# Using Authorization header
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Using request body
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_TOKEN_HERE"}'
```

## Protecting Routes with Token Verification

Use the `withTokenAuth` middleware to protect your API routes:

```typescript
// app/api/protected/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withTokenAuth } from '../auth/middleware/verifyToken';

export async function GET(request: NextRequest) {
  return withTokenAuth(request, async (req, token) => {
    // Your protected route logic here
    // Token is verified and not blacklisted
    return NextResponse.json({
      message: 'This is a protected endpoint',
      token: token.substring(0, 10) + '...' // Don't expose full token
    });
  });
}
```

## Utility Functions

### blacklistToken
Add a token to the blacklist.

```typescript
import { blacklistToken } from '@/app/api/auth/utils/tokenBlacklist';

const result = await blacklistToken(token, 24); // 24 hours expiry
if (result.success) {
  console.log('Token blacklisted');
} else {
  console.error(result.error);
}
```

### isTokenBlacklisted
Check if a token is blacklisted.

```typescript
import { isTokenBlacklisted } from '@/app/api/auth/utils/tokenBlacklist';

const { isBlacklisted } = await isTokenBlacklisted(token);
if (isBlacklisted) {
  console.log('Token is invalid');
}
```

### cleanupExpiredBlacklist
Remove expired entries from the blacklist (run periodically).

```typescript
import { cleanupExpiredBlacklist } from '@/app/api/auth/utils/tokenBlacklist';

const result = await cleanupExpiredBlacklist();
console.log(`Deleted ${result.deletedCount} expired tokens`);
```

## Best Practices

1. **Always validate tokens** - Use the `withTokenAuth` middleware on protected routes
2. **Set reasonable expiry times** - Tokens expire from the blacklist after 24 hours by default
3. **Clean up regularly** - Run the cleanup function periodically to remove expired entries
4. **Use HTTPS** - Always use HTTPS in production to protect tokens in transit
5. **Store securely** - Store tokens securely on the client (httpOnly cookies are ideal)
6. **Handle errors** - Always handle logout errors gracefully on the frontend

## Troubleshooting

### Error: "Missing Supabase credentials in environment variables"
- Ensure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in `.env.local`
- Restart the development server after adding environment variables

### Error: "Failed to blacklist token"
- Check that the `token_blacklist` table exists in Supabase
- Verify that Row Level Security policies allow the service role to insert data
- Check Supabase logs for database errors

### Token still works after logout
- Verify that your protected routes use the `withTokenAuth` middleware
- Check that `isTokenBlacklisted` is being called correctly
- Ensure the token was actually added to the blacklist table

## File Structure

```
app/
├── api/
│   └── auth/
│       ├── logout/
│       │   └── route.ts           # Main logout endpoint
│       ├── utils/
│       │   └── tokenBlacklist.ts   # Token blacklist utilities
│       └── middleware/
│           └── verifyToken.ts      # Token verification middleware
```

## Database Schema

```
token_blacklist
├── id (UUID, PRIMARY KEY)
├── token (TEXT, UNIQUE)
├── created_at (TIMESTAMP WITH TIME ZONE)
└── expires_at (TIMESTAMP WITH TIME ZONE)

Indexes:
├── idx_token_blacklist_token (on token)
└── idx_token_blacklist_expires_at (on expires_at)
```
