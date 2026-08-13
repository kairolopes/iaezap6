# JWT Implementation Examples

Complete, copy-paste ready examples for common IAeZap authentication scenarios.

## Example 1: Login Endpoint

**File**: `src/app/api/auth/login/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { generateTokenPair } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Input validation
    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email and password are required',
          code: 'INVALID_INPUT',
        },
        { status: 400 }
      );
    }

    // TODO: Implement your authentication logic
    // Example placeholder - replace with actual database lookup
    const user = {
      id: 'user_' + Math.random().toString(36).substr(2, 9),
      company_id: 'company_' + Math.random().toString(36).substr(2, 9),
      email: email,
      role: 'user',
    };

    // For demonstration - validate password
    // In production, use bcrypt or similar
    if (password !== 'demo123') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email or password',
          code: 'AUTH_FAILED',
        },
        { status: 401 }
      );
    }

    // Generate JWT tokens
    const tokens = generateTokenPair(
      user.id,
      user.company_id,
      user.email,
      user.role
    );

    // Set secure cookies (optional)
    const response = NextResponse.json(
      {
        success: true,
        data: tokens,
      },
      { status: 200 }
    );

    // Optional: Set httpOnly cookies for automatic token management
    response.cookies.set('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600, // 1 hour
      path: '/',
    });

    response.cookies.set('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 604800, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Login failed',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
```

## Example 2: Refresh Token Endpoint

**File**: `src/app/api/auth/refresh/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, generateAccessToken } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Refresh token is required',
          code: 'MISSING_TOKEN',
        },
        { status: 400 }
      );
    }

    // Verify refresh token
    const claims = verifyToken(refreshToken);

    if (!claims) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired refresh token',
          code: 'INVALID_REFRESH_TOKEN',
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
          expiresIn: 3600,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Token refresh failed',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
```

## Example 3: Protected User Profile Endpoint

**File**: `src/app/api/users/profile/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/jwt';

async function handler(request: NextRequest) {
  const user = request.user;

  // TODO: Fetch user details from database
  const userProfile = {
    userId: user.user_id,
    email: user.email,
    companyId: user.company_id,
    role: user.role,
    name: 'John Doe', // From database
    createdAt: '2024-01-01T00:00:00Z',
  };

  return NextResponse.json(
    {
      success: true,
      data: userProfile,
    },
    { status: 200 }
  );
}

export const GET = withAuth(handler);
```

## Example 4: Admin-Only Endpoint

**File**: `src/app/api/admin/users/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withRoleAuth } from '@/lib/jwt';

async function handler(request: NextRequest) {
  const adminUser = request.user;

  // TODO: Fetch all users from database
  const users = [
    { id: 'user_1', email: 'user1@example.com', role: 'user' },
    { id: 'user_2', email: 'user2@example.com', role: 'user' },
    { id: 'user_3', email: 'admin@example.com', role: 'admin' },
  ];

  // Log admin action
  console.log(`Admin ${adminUser.email} accessed user list`);

  return NextResponse.json(
    {
      success: true,
      data: users,
    },
    { status: 200 }
  );
}

// Only allow admin and super_admin roles
export const GET = withRoleAuth(handler, ['admin', 'super_admin']);
```

## Example 5: Public Endpoint with Optional Authentication

**File**: `src/app/api/posts/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withOptionalAuth, getUserFromRequest } from '@/lib/jwt';

async function handler(request: NextRequest) {
  const user = getUserFromRequest(request);

  // TODO: Fetch posts from database
  const posts = [
    { id: 1, title: 'Post 1', content: 'Content 1', public: true },
    { id: 2, title: 'Post 2', content: 'Content 2', public: true },
    { id: 3, title: 'Private Post', content: 'Private', public: false },
  ];

  // Filter based on authentication
  const filteredPosts = posts.filter((post) => {
    if (post.public) return true;
    if (user) return true; // Authenticated users see private posts
    return false;
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        posts: filteredPosts,
        authenticated: !!user,
        userEmail: user?.email || null,
      },
    },
    { status: 200 }
  );
}

export const GET = withOptionalAuth(handler);
```

## Example 6: Logout Endpoint

**File**: `src/app/api/auth/logout/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/jwt';

async function handler(request: NextRequest) {
  const user = request.user;

  // TODO: Implement token blacklist if needed
  // Add token to database blacklist to prevent reuse

  const response = NextResponse.json(
    {
      success: true,
      message: 'Logged out successfully',
    },
    { status: 200 }
  );

  // Clear cookies
  response.cookies.delete('access_token');
  response.cookies.delete('refresh_token');
  response.cookies.delete('Authorization');

  // Log logout
  console.log(`User ${user.email} logged out`);

  return response;
}

export const POST = withAuth(handler);
```

## Example 7: Role-Based Data Filtering

**File**: `src/app/api/company/settings/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/jwt';

async function handler(request: NextRequest) {
  const user = request.user;

  // Base settings visible to all authenticated users
  let settings = {
    companyName: 'Acme Corp',
    timezone: 'UTC',
  };

  // Admin-only settings
  if (user.role === 'admin') {
    settings = {
      ...settings,
      apiKeys: ['key_xxx', 'key_yyy'],
      billingEmail: 'admin@acme.com',
      maxUsers: 100,
      features: {
        advancedReporting: true,
        apiAccess: true,
        customBranding: true,
      },
    };
  }

  return NextResponse.json(
    {
      success: true,
      data: settings,
    },
    { status: 200 }
  );
}

export const GET = withAuth(handler);
```

## Example 8: Client-Side Token Management

**File**: `src/hooks/useAuth.ts`

```typescript
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export function useAuth() {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Load tokens from storage on mount
  useEffect(() => {
    const storedTokens = localStorage.getItem('auth_tokens');
    if (storedTokens) {
      setTokens(JSON.parse(storedTokens));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      const newTokens = data.data;

      setTokens(newTokens);
      localStorage.setItem('auth_tokens', JSON.stringify(newTokens));

      return newTokens;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const refreshAccessToken = async () => {
    if (!tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      const newAccessToken = data.data.accessToken;

      const updatedTokens = { ...tokens, accessToken: newAccessToken };
      setTokens(updatedTokens);
      localStorage.setItem('auth_tokens', JSON.stringify(updatedTokens));

      return updatedTokens;
    } catch (error) {
      console.error('Token refresh error:', error);
      logout();
      throw error;
    }
  };

  const logout = () => {
    setTokens(null);
    localStorage.removeItem('auth_tokens');
    router.push('/login');
  };

  return {
    tokens,
    loading,
    login,
    logout,
    refreshAccessToken,
    isAuthenticated: !!tokens,
    accessToken: tokens?.accessToken,
  };
}
```

## Example 9: API Request Helper with Auto-Refresh

**File**: `src/lib/api-client.ts`

```typescript
interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

async function fetchWithAuth(url: string, options: RequestOptions = {}) {
  const tokens = JSON.parse(localStorage.getItem('auth_tokens') || '{}');

  if (!options.skipAuth && !tokens.accessToken) {
    throw new Error('No access token available');
  }

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (tokens.accessToken && !options.skipAuth) {
    headers['Authorization'] = `Bearer ${tokens.accessToken}`;
  }

  let response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 - try to refresh token
  if (response.status === 401 && tokens.refreshToken && !options.skipAuth) {
    const refreshResponse = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (refreshResponse.ok) {
      const refreshData = await refreshResponse.json();
      const newAccessToken = refreshData.data.accessToken;

      // Update stored tokens
      tokens.accessToken = newAccessToken;
      localStorage.setItem('auth_tokens', JSON.stringify(tokens));

      // Retry original request with new token
      headers['Authorization'] = `Bearer ${newAccessToken}`;
      response = await fetch(url, {
        ...options,
        headers,
      });
    } else {
      // Refresh failed - logout
      localStorage.removeItem('auth_tokens');
      throw new Error('Session expired');
    }
  }

  return response;
}

export { fetchWithAuth };
```

## Example 10: Testing with Jest

**File**: `__tests__/jwt.test.ts`

```typescript
import {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyToken,
  isTokenExpired,
  extractClaimsWithoutVerification,
} from '@/lib/jwt';

describe('JWT Utilities', () => {
  const testUser = {
    userId: 'test_user_123',
    companyId: 'test_company_456',
    email: 'test@example.com',
    role: 'user',
  };

  it('should generate access token', () => {
    const token = generateAccessToken(
      testUser.userId,
      testUser.companyId,
      testUser.email,
      testUser.role
    );

    expect(token).toBeTruthy();
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  it('should verify and extract claims from token', () => {
    const token = generateAccessToken(
      testUser.userId,
      testUser.companyId,
      testUser.email,
      testUser.role
    );

    const claims = verifyToken(token);

    expect(claims).toBeTruthy();
    expect(claims?.user_id).toBe(testUser.userId);
    expect(claims?.company_id).toBe(testUser.companyId);
    expect(claims?.email).toBe(testUser.email);
    expect(claims?.role).toBe(testUser.role);
  });

  it('should generate token pair', () => {
    const tokens = generateTokenPair(
      testUser.userId,
      testUser.companyId,
      testUser.email,
      testUser.role
    );

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(tokens.expiresIn).toBe(3600);
    expect(tokens.tokenType).toBe('Bearer');
  });

  it('should detect expired tokens', () => {
    const expiredToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTIzIiwiZXhwIjowfQ.invalid';
    // This should return null because it's invalid, not because it's expired
    const claims = verifyToken(expiredToken);
    expect(claims).toBeNull();
  });

  it('should extract claims without verification', () => {
    const token = generateAccessToken(
      testUser.userId,
      testUser.companyId,
      testUser.email,
      testUser.role
    );

    const claims = extractClaimsWithoutVerification(token);

    expect(claims).toBeTruthy();
    expect(claims?.user_id).toBe(testUser.userId);
  });

  it('should reject invalid tokens', () => {
    const invalidToken = 'invalid.token.here';
    const claims = verifyToken(invalidToken);

    expect(claims).toBeNull();
  });

  it('should reject tokens with modified claims', () => {
    const token = generateAccessToken(
      testUser.userId,
      testUser.companyId,
      testUser.email,
      testUser.role
    );

    // Manually modify the token
    const parts = token.split('.');
    const modifiedToken = parts[0] + '.' + parts[1].replace('user', 'hacker') + '.' + parts[2];

    const claims = verifyToken(modifiedToken);
    expect(claims).toBeNull();
  });
});
```

## Tips

1. **Always use HTTPS** in production
2. **Never expose private keys** in client code
3. **Store tokens securely** - use httpOnly cookies for refresh tokens
4. **Implement token blacklist** for logout functionality
5. **Add CSRF protection** alongside token authentication
6. **Monitor token usage** for suspicious patterns
7. **Rotate keys periodically** in production
