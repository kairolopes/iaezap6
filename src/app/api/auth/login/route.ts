import { NextRequest, NextResponse } from 'next/server';
import { loginRequestSchema, AUTH_STATUS_CODES, TOKEN_EXPIRATION } from '@/types/auth';
import { authenticateUser, getUserInfo } from '@/lib/supabase';
import { getTokenExpiresIn } from '@/lib/jwt';

/**
 * POST /api/auth/login
 *
 * Authenticates a user with email and password
 * Returns access and refresh JWT tokens
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "password123",
 *   "rememberMe": false
 * }
 *
 * Success Response (200):
 * {
 *   "success": true,
 *   "user": {
 *     "id": "uuid",
 *     "email": "user@example.com",
 *     "firstName": "John",
 *     "lastName": "Doe",
 *     "roles": ["user"],
 *     "createdAt": "2026-08-12T10:00:00Z",
 *     "updatedAt": "2026-08-12T10:00:00Z"
 *   },
 *   "tokens": {
 *     "accessToken": "eyJhbGciOiJIUzI1NiIs...",
 *     "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
 *     "expiresIn": 900,
 *     "tokenType": "Bearer"
 *   }
 * }
 *
 * Error Responses:
 * 400 - Invalid request (validation error)
 * 401 - Invalid credentials or user not found
 * 500 - Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Request body must be valid JSON',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.BAD_REQUEST }
      );
    }

    // Validate request using Zod schema
    const validationResult = loginRequestSchema.safeParse(body);

    if (!validationResult.success) {
      const fieldErrors = validationResult.error.flatten().fieldErrors;
      const errorMessage = Object.entries(fieldErrors)
        .map(([field, errors]) => `${field}: ${errors?.join(', ')}`)
        .join('; ');

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Validation failed',
            details: fieldErrors,
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.BAD_REQUEST }
      );
    }

    const { email, password, rememberMe } = validationResult.data;

    // Authenticate user with Supabase
    const authResult = await authenticateUser(email, password);

    if (!authResult.success || !authResult.data) {
      // Invalid credentials
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: authResult.error || 'Invalid email or password',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.UNAUTHORIZED }
      );
    }

    const { user, session } = authResult.data;

    if (!user || !session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Authentication failed: no session established',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.UNAUTHORIZED }
      );
    }

    // Get additional user information from custom user table if needed
    const userInfoResult = await getUserInfo(user.id);
    const userMetadata = user.user_metadata || {};
    const userEmail = user.email || email;

    // Prepare tokens
    const accessToken = session.access_token;
    const refreshToken = session.refresh_token;
    const expiresIn = getTokenExpiresIn(accessToken) || TOKEN_EXPIRATION.ACCESS;

    // Build response
    const response = {
      success: true as const,
      user: {
        id: user.id,
        email: userEmail,
        firstName: userMetadata.first_name || undefined,
        lastName: userMetadata.last_name || undefined,
        roles: userMetadata.roles ? [userMetadata.roles].flat() : ['user'],
        createdAt: user.created_at || new Date().toISOString(),
        updatedAt: user.updated_at || new Date().toISOString(),
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn,
        tokenType: 'Bearer' as const,
      },
    };

    // Create response with optional cookie for "Remember Me"
    const jsonResponse = NextResponse.json(response, {
      status: AUTH_STATUS_CODES.OK,
    });

    // Set HTTP-only cookie with refresh token if "Remember Me" is enabled
    if (rememberMe && refreshToken) {
      const refreshTokenExpiry = new Date();
      refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days

      jsonResponse.cookies.set({
        name: 'refresh_token',
        value: refreshToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: TOKEN_EXPIRATION.REFRESH, // 7 days in seconds
        path: '/',
      });
    }

    // Also set the access token in a cookie for convenience (non-httpOnly for client access)
    if (accessToken) {
      jsonResponse.cookies.set({
        name: 'access_token',
        value: accessToken,
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: expiresIn, // Match token expiration
        path: '/',
      });
    }

    return jsonResponse;
  } catch (error) {
    console.error('Login endpoint error:', error);

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred during login',
          details:
            process.env.NODE_ENV === 'development'
              ? {
                  errorType: error instanceof Error ? error.constructor.name : 'Unknown',
                  errorMessage,
                }
              : undefined,
          timestamp: new Date().toISOString(),
        },
      },
      { status: AUTH_STATUS_CODES.INTERNAL_SERVER_ERROR }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  const headers = {
    'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  return NextResponse.json({}, { headers, status: 200 });
}
