# Integration Examples

This document provides practical examples of how to use the refresh token implementation in your application.

## Table of Contents

1. [Basic API Usage](#basic-api-usage)
2. [React Integration](#react-integration)
3. [Protected API Routes](#protected-api-routes)
4. [Token Manager](#token-manager)
5. [Error Handling](#error-handling)
6. [Production Setup](#production-setup)

## Basic API Usage

### Server-Side (Node.js)

```typescript
import { RefreshTokenClient, RefreshTokenError } from '@/app/lib/auth/client';

const client = new RefreshTokenClient('/api/auth/refresh');

async function getNewAccessToken(refreshToken: string) {
  try {
    const tokens = await client.refresh(refreshToken);
    console.log('New access token:', tokens.accessToken);
    console.log('Expires in:', tokens.expiresIn, 'seconds');
    return tokens;
  } catch (error) {
    if (error instanceof RefreshTokenError) {
      console.error('Refresh failed:', error.message);
      console.error('Error code:', error.code);

      if (error.isAuthenticationError()) {
        // User needs to login again
        console.log('Token invalid, redirect to login');
      }

      if (error.isRetryable()) {
        // Retry after delay
        console.log('Retrying in 5 seconds...');
      }
    }
  }
}
```

### Client-Side (Browser)

```javascript
// Using fetch directly
async function refreshAccessToken(refreshToken) {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to refresh token');
    }

    // Store new tokens
    localStorage.setItem('accessToken', result.data.accessToken);
    localStorage.setItem('refreshToken', result.data.refreshToken);

    return result.data;
  } catch (error) {
    console.error('Token refresh failed:', error);
    // Redirect to login
    window.location.href = '/login';
  }
}
```

## React Integration

### Hook for Token Management

```typescript
// hooks/useAuth.ts
import { useState, useCallback, useEffect } from 'react';
import { RefreshTokenClient, RefreshTokenError } from '@/app/lib/auth/client';

export function useAuth() {
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return typeof window !== 'undefined'
      ? localStorage.getItem('accessToken')
      : null;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (refreshToken: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const client = new RefreshTokenClient();
      const tokens = await client.refresh(refreshToken);

      setAccessToken(tokens.accessToken);
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);

      return tokens;
    } catch (err) {
      if (err instanceof RefreshTokenError) {
        setError(err.message);

        if (err.isAuthenticationError()) {
          // Clear auth data and redirect to login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }, []);

  return {
    accessToken,
    isLoading,
    error,
    refresh,
    logout,
    isAuthenticated: !!accessToken,
  };
}
```

### Component with Auto-Refresh

```typescript
// components/AuthProvider.tsx
import React, { useEffect, useRef } from 'react';
import { RefreshTokenClient, RefreshTokenError } from '@/app/lib/auth/client';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const client = useRef(new RefreshTokenClient());

  useEffect(() => {
    function scheduleTokenRefresh() {
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) return;

      // Refresh 5 minutes before expiry (55 minutes from now for 1-hour tokens)
      const refreshIn = 55 * 60 * 1000;

      refreshTimeoutRef.current = setTimeout(async () => {
        try {
          const tokens = await client.current.refresh(refreshToken);

          localStorage.setItem('accessToken', tokens.accessToken);
          localStorage.setItem('refreshToken', tokens.refreshToken);

          // Schedule next refresh
          scheduleTokenRefresh();
        } catch (error) {
          if (error instanceof RefreshTokenError && error.isAuthenticationError()) {
            // Redirect to login
            window.location.href = '/login';
          }
        }
      }, refreshIn);
    }

    scheduleTokenRefresh();

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  return <>{children}</>;
}
```

### Fetch Interceptor

```typescript
// lib/fetchWithAuth.ts
import { RefreshTokenClient, RefreshTokenError } from '@/app/lib/auth/client';

const client = new RefreshTokenClient();

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');

  const headers = new Headers(init?.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let response = await fetch(input, {
    ...init,
    headers,
  });

  // If 401, try to refresh and retry
  if (response.status === 401 && refreshToken) {
    try {
      const tokens = await client.refresh(refreshToken);

      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);

      headers.set('Authorization', `Bearer ${tokens.accessToken}`);

      response = await fetch(input, {
        ...init,
        headers,
      });
    } catch (error) {
      if (error instanceof RefreshTokenError && error.isAuthenticationError()) {
        window.location.href = '/login';
      }
      throw error;
    }
  }

  return response;
}

// Usage in components:
// const response = await fetchWithAuth('/api/user/profile');
```

## Protected API Routes

### Simple Protected Route

```typescript
// app/api/user/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getUserFromRequest } from '@/app/lib/auth/middleware';

async function handler(request: NextRequest) {
  const user = getUserFromRequest(request);

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // User is authenticated, access request.user
  console.log('User ID:', user.sub);
  console.log('User email:', user.email);

  return NextResponse.json({
    message: `Hello ${user.email}`,
    userId: user.sub,
  });
}

export const GET = withAuth(handler);
```

### Protected Route with Database Access

```typescript
// app/api/user/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getUserFromRequest } from '@/app/lib/auth/middleware';
import { supabase } from '@/app/lib/auth/supabase';

async function handler(request: NextRequest) {
  const user = getUserFromRequest(request);

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  if (request.method === 'GET') {
    // Fetch user settings
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.sub)
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  }

  if (request.method === 'PUT') {
    // Update user settings
    const body = await request.json();

    const { error } = await supabase
      .from('user_settings')
      .update(body)
      .eq('user_id', user.sub);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  }
}

export const GET = withAuth(handler);
export const PUT = withAuth(handler);
```

## Token Manager

### Application-Wide Token Management

```typescript
// lib/initAuth.ts
import { createTokenManager, RefreshTokenError } from '@/app/lib/auth/client';

export function initializeAuth() {
  return createTokenManager(
    (tokens) => {
      // Called when tokens are refreshed
      console.log('Tokens refreshed at:', new Date());
      // Update UI, emit events, etc.
    },
    (error) => {
      // Called when authentication error occurs
      console.error('Auth error:', error.message);
      // Redirect to login
      window.location.href = '/login';
    }
  );
}
```

### Using TokenManager in React

```typescript
// hooks/useTokenManager.ts
import { useEffect, useState } from 'react';
import { getTokenManager, createTokenManager } from '@/app/lib/auth/client';

export function useTokenManager() {
  const [manager, setManager] = useState(() => {
    return getTokenManager() || createTokenManager();
  });

  useEffect(() => {
    const initialAccessToken = localStorage.getItem('accessToken');
    const initialRefreshToken = localStorage.getItem('refreshToken');

    if (initialAccessToken && initialRefreshToken) {
      manager.setTokens(initialAccessToken, initialRefreshToken, 3600);
    }

    return () => {
      // Don't destroy on unmount - keep singleton alive
    };
  }, [manager]);

  return manager;
}

// Usage in component:
export function UserMenu() {
  const manager = useTokenManager();

  const handleAPICall = async () => {
    // Manager automatically refreshes before expiry
    const headers = manager.getAuthHeader();
    const response = await fetch('/api/user/profile', { headers });
    const data = await response.json();
    console.log(data);
  };

  return (
    <button onClick={handleAPICall}>
      Call API
    </button>
  );
}
```

## Error Handling

### Comprehensive Error Handling

```typescript
import { RefreshTokenClient, RefreshTokenError } from '@/app/lib/auth/client';

async function handleTokenRefresh(refreshToken: string) {
  const client = new RefreshTokenClient();

  try {
    const tokens = await client.refresh(refreshToken);
    console.log('Success! New tokens obtained');
    return tokens;
  } catch (error) {
    if (!(error instanceof RefreshTokenError)) {
      console.error('Unexpected error:', error);
      return null;
    }

    switch (error.code) {
      case 'MISSING_REFRESH_TOKEN':
        console.log('Token missing from request');
        break;

      case 'INVALID_REFRESH_TOKEN':
        console.log('Token is invalid - user needs to login again');
        redirectToLogin();
        break;

      case 'EXPIRED_REFRESH_TOKEN':
        console.log('Refresh token expired - user needs to login again');
        redirectToLogin();
        break;

      case 'REVOKED_REFRESH_TOKEN':
        console.log('Token was revoked - likely security issue');
        // Force logout and audit
        redirectToLogin();
        break;

      case 'INVALID_CONTENT_TYPE':
        console.log('Invalid request format');
        break;

      case 'NETWORK_ERROR':
        console.log('Network unavailable - will retry');
        if (error.isRetryable()) {
          // Retry after delay
          setTimeout(() => handleTokenRefresh(refreshToken), 5000);
        }
        break;

      case 'TIMEOUT':
        console.log('Request timed out - will retry');
        if (error.isRetryable()) {
          setTimeout(() => handleTokenRefresh(refreshToken), 5000);
        }
        break;

      case 'INTERNAL_ERROR':
        console.log('Server error - will retry');
        if (error.isRetryable()) {
          setTimeout(() => handleTokenRefresh(refreshToken), 5000);
        }
        break;

      default:
        console.log('Unknown error:', error.message);
    }

    return null;
  }
}

function redirectToLogin() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.href = '/login?reason=session_expired';
}
```

## Production Setup

### Environment Variables

Create `.env.production` with:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Security
NODE_ENV=production
```

### Rate Limiting Middleware

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const tokenRefreshLimits = new Map<string, number[]>();
const WINDOW_SIZE = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10; // 10 requests per minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const times = tokenRefreshLimits.get(ip) || [];

  // Remove old entries
  const recentTimes = times.filter((t) => now - t < WINDOW_SIZE);

  if (recentTimes.length >= MAX_REQUESTS) {
    return true;
  }

  recentTimes.push(now);
  tokenRefreshLimits.set(ip, recentTimes);

  return false;
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/api/auth/refresh') {
    const ip = request.ip || 'unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/auth/refresh'],
};
```

### Logging and Monitoring

```typescript
// lib/logging.ts
import { RefreshTokenError } from '@/app/lib/auth/client';

export function logTokenRefreshError(
  error: RefreshTokenError,
  userId?: string
) {
  const timestamp = new Date().toISOString();

  const logEntry = {
    timestamp,
    type: 'token_refresh_error',
    errorCode: error.code,
    errorMessage: error.message,
    statusCode: error.statusCode,
    userId: userId || 'unknown',
    isRetryable: error.isRetryable(),
    isAuthError: error.isAuthenticationError(),
  };

  // Send to logging service
  console.error(JSON.stringify(logEntry));

  // Optionally send to monitoring service (Sentry, etc.)
  if (typeof window !== 'undefined' && window.__SENTRY__) {
    window.__SENTRY__.captureException(error, {
      contexts: { auth: logEntry },
    });
  }
}
```

This comprehensive example set should help you integrate the refresh token system into your application effectively.
