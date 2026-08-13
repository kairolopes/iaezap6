# Login Endpoint Integration Guide

## Overview

This guide explains how to integrate the IAeZap login endpoint into your frontend and backend applications.

## API Contract

### Endpoint
```
POST /api/auth/login
```

### Request Body

```typescript
interface LoginRequest {
  email: string;           // User's email (required)
  password: string;        // User's password (required)
  companyId?: string;      // Company UUID (optional but recommended)
}
```

### Success Response (200 OK)

```typescript
interface LoginResponse {
  success: true;
  access_token: string;         // JWT access token (RS256)
  refresh_token: string;        // JWT refresh token (RS256)
  user: {
    id: string;                 // User UUID
    email: string;              // User email
    full_name: string | null;   // User's full name
    role: string;               // User role (admin, manager, user, etc.)
    company_id: string;         // Associated company UUID
    status: string;             // User status (active, inactive, etc.)
  };
  company_id: string;           // Company UUID (for convenience)
  expires_in: number;           // Access token expiration in seconds
  token_type: 'Bearer';         // Always 'Bearer'
}
```

### Error Response (4xx/5xx)

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: 'VALIDATION_ERROR' | 'INVALID_CREDENTIALS' | 'INTERNAL_SERVER_ERROR';
    message: string;
    details?: Record<string, any>;
    timestamp: string;          // ISO 8601 timestamp
  };
}
```

## Frontend Integration

### React Example

```typescript
// src/hooks/useLogin.ts
import { useState } from 'react';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  company_id: string;
  status: string;
}

interface LoginResponse {
  success: boolean;
  access_token?: string;
  refresh_token?: string;
  user?: User;
  company_id?: string;
  error?: {
    code: string;
    message: string;
  };
}

export function useLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (email: string, password: string, companyId?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify({
          email,
          password,
          ...(companyId && { companyId }),
        }),
      });

      const data: LoginResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Login failed');
      }

      // Store tokens
      localStorage.setItem('accessToken', data.access_token!);
      localStorage.setItem('refreshToken', data.refresh_token!);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('companyId', data.company_id!);

      return {
        success: true,
        user: data.user,
        tokens: {
          access: data.access_token!,
          refresh: data.refresh_token!,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  return { login, isLoading, error };
}
```

### Login Form Component

```typescript
// src/components/LoginForm.tsx
import { useState } from 'react';
import { useLogin } from '@/hooks/useLogin';
import { useRouter } from 'next/router';

export function LoginForm() {
  const router = useRouter();
  const { login, isLoading, error } = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyId, setCompanyId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await login(email, password, companyId || undefined);

    if (result.success) {
      // Redirect to dashboard
      router.push('/dashboard');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="companyId">Company (Optional)</label>
        <input
          id="companyId"
          type="text"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          placeholder="Leave empty for auto-detection"
        />
      </div>

      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

## Backend Integration

### Using Tokens in API Routes

```typescript
// src/app/api/protected/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/jwt';

export const GET = withAuth(async (request: NextRequest) => {
  // request.user contains decoded JWT claims
  const user = request.user;

  return NextResponse.json({
    message: 'Protected route',
    userId: user?.user_id,
    companyId: user?.company_id,
    role: user?.role,
  });
});
```

### Verifying Tokens in Middleware

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  // Skip auth check for public routes
  if (request.nextUrl.pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // Extract token from Authorization header or cookies
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json(
      { error: 'Missing authorization token' },
      { status: 401 }
    );
  }

  // Verify token
  const result = await verifyToken(token);

  if (!result.valid) {
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  // Add user info to request headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('X-User-ID', result.payload?.sub || '');
  requestHeaders.set('X-Company-ID', result.payload?.tenantId || '');
  requestHeaders.set('X-User-Role', result.payload?.role || '');

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/api/:path*'],
};
```

### Token Refresh Logic

```typescript
// src/lib/token-manager.ts
import { verifyToken } from '@/lib/auth';

export async function ensureValidToken(): Promise<string | null> {
  const accessToken = localStorage.getItem('accessToken');

  if (!accessToken) {
    return null;
  }

  // Check if token is still valid
  const result = await verifyToken(accessToken);

  if (result.valid) {
    return accessToken;
  }

  // Try to refresh with refresh token
  const refreshToken = localStorage.getItem('refreshToken');

  if (!refreshToken) {
    // Clear storage and redirect to login
    localStorage.clear();
    window.location.href = '/login';
    return null;
  }

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();

    // Update stored tokens
    localStorage.setItem('accessToken', data.access_token);
    localStorage.setItem('refreshToken', data.refresh_token);

    return data.access_token;
  } catch (error) {
    // Clear storage and redirect to login
    localStorage.clear();
    window.location.href = '/login';
    return null;
  }
}
```

### API Client with Token Management

```typescript
// src/lib/api-client.ts
import { ensureValidToken } from './token-manager';

export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
) {
  const token = await ensureValidToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers || {}) as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401) {
    // Token expired and refresh failed
    localStorage.clear();
    window.location.href = '/login';
  }

  return response.json();
}

// Usage
export async function getUser(userId: string) {
  return apiRequest(`/api/users/${userId}`);
}

export async function updateProfile(data: any) {
  return apiRequest('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
```

## Testing

### Unit Tests

```typescript
// __tests__/api/auth/login.test.ts
import { POST } from '@/app/api/auth/login/route';
import { NextRequest } from 'next/server';

describe('POST /api/auth/login', () => {
  it('should return 400 for invalid email', async () => {
    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'invalid-email',
        password: 'password123',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 401 for invalid credentials', async () => {
    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'password123',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should return tokens for valid credentials', async () => {
    // Setup: Create test user in database
    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPassword123',
        companyId: 'test-company-id',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.access_token).toBeDefined();
    expect(data.refresh_token).toBeDefined();
    expect(data.user.email).toBe('test@example.com');
  });
});
```

### Integration Tests

```typescript
// __tests__/integration/login-flow.test.ts
describe('Login Flow', () => {
  it('should complete full login -> request -> logout cycle', async () => {
    // 1. Login
    const loginRes = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPassword123',
      }),
    });
    const loginData = await loginRes.json();
    expect(loginData.success).toBe(true);

    const { access_token } = loginData;

    // 2. Use token in protected request
    const protectedRes = await fetch('/api/protected', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    expect(protectedRes.status).toBe(200);

    // 3. Logout
    const logoutRes = await fetch('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: loginData.refresh_token }),
    });
    expect(logoutRes.status).toBe(200);

    // 4. Verify token is invalid after logout
    const invalidRes = await fetch('/api/protected', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    expect(invalidRes.status).toBe(401);
  });
});
```

## Security Best Practices

### 1. Store Tokens Securely

```typescript
// ✅ Good: HTTP-only cookie (automatic)
// Tokens are set as HTTP-only cookies automatically by the server

// ✅ Good: Local storage with careful usage
localStorage.setItem('accessToken', token);

// ❌ Bad: Session storage (cleared on browser close)
sessionStorage.setItem('token', token); // Avoid for long sessions

// ❌ Avoid: Global variables
window.token = token; // Don't expose globally
```

### 2. Send Tokens Securely

```typescript
// ✅ Good: Authorization header
fetch('/api/protected', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

// ✅ Good: HTTP-only cookie (automatic)
// Browser sends this automatically

// ❌ Avoid: URL query parameters
fetch(`/api/protected?token=${token}`); // Don't expose in URL

// ❌ Avoid: Custom headers
fetch('/api/protected', {
  headers: {
    'X-Token': token, // Inconsistent with standards
  },
});
```

### 3. Handle Token Expiration

```typescript
// ✅ Good: Check expiration and refresh
const result = await verifyToken(token);
if (!result.valid && result.error?.includes('expired')) {
  // Refresh token
  const newToken = await refreshAccessToken();
}

// ❌ Avoid: Ignoring expiration
// Just using token without checking validity

// ❌ Avoid: Storing invalid tokens
if (!result.valid) {
  localStorage.clear();
}
```

### 4. Use HTTPS in Production

```typescript
// ✅ Good: HTTPS only
jsonResponse.cookies.set({
  secure: process.env.NODE_ENV === 'production',
});

// ✅ Good: SameSite protection
jsonResponse.cookies.set({
  sameSite: 'lax', // or 'strict'
});

// ❌ Avoid: Sending tokens over HTTP
// Always use HTTPS in production
```

## Troubleshooting Integration

### Token Not Persisting

```typescript
// Check if credentials are included
fetch('/api/auth/login', {
  credentials: 'include', // Required for cookie access
  // ...
});
```

### CORS Issues

```typescript
// Ensure correct CORS headers
'Access-Control-Allow-Origin': 'https://yourdomain.com',
'Access-Control-Allow-Credentials': 'true',
```

### Token Not in Authorization Header

```typescript
// Verify correct format
const token = localStorage.getItem('accessToken');
headers['Authorization'] = `Bearer ${token}`; // Must have 'Bearer ' prefix
```

## Migration from Other Auth Systems

### From Supabase Auth to Custom Login

```typescript
// Update your hooks to use new endpoint
const response = await fetch('/api/auth/login', { // Changed from Supabase
  method: 'POST',
  body: JSON.stringify({ email, password }),
});
```

### From Session-Based to JWT

```typescript
// Replace session checks with token verification
// Before: Check if session exists
// After: Verify JWT token validity

const result = await verifyToken(token);
if (result.valid) {
  // User is authenticated
}
```

## Related Documentation

- [Login Setup Guide](./LOGIN_SETUP.md)
- [Quick Start Guide](./QUICK_START_LOGIN.md)
- [Token Refresh](./TOKEN_REFRESH.md)
- [Security Best Practices](./SECURITY.md)
