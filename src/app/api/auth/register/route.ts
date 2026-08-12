import { NextRequest, NextResponse } from 'next/server';
import { registerRequestSchema, AUTH_STATUS_CODES, TOKEN_EXPIRATION } from '@/types/auth';
import { registerUser } from '@/lib/supabase';
import { getTokenExpiresIn } from '@/lib/jwt';

/**
 * POST /api/auth/register
 *
 * Creates a new user account with email and password
 * Validates password complexity and handles duplicate email errors
 * Returns access and refresh tokens
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePass123!",
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "acceptTerms": true
 * }
 *
 * Success Response (201):
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
 * 409 - User already exists (duplicate email)
 * 422 - Unprocessable entity (weak password)
 * 500 - Internal server error
 *
 * Password Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one digit (0-9)
 * - At least one special character (@$!%*?&)
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
    const validationResult = registerRequestSchema.safeParse(body);

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

    const { email, password, firstName, lastName, acceptTerms } = validationResult.data;

    // Validate that terms are accepted
    if (!acceptTerms) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Terms and conditions must be accepted',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.BAD_REQUEST }
      );
    }

    // Attempt to register user with Supabase Auth
    const registrationResult = await registerUser(email, password, {
      first_name: firstName,
      last_name: lastName,
    });

    // Handle registration errors
    if (!registrationResult.success) {
      // Check if error is due to duplicate email
      if (registrationResult.code === 'user_already_exists') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'USER_ALREADY_EXISTS',
              message: 'An account with this email already exists. Please try logging in or use a different email.',
              timestamp: new Date().toISOString(),
            },
          },
          { status: AUTH_STATUS_CODES.CONFLICT }
        );
      }

      // Check for weak password error
      if (registrationResult.code === 'weak_password') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'WEAK_PASSWORD',
              message: registrationResult.error || 'Password does not meet security requirements',
              timestamp: new Date().toISOString(),
            },
          },
          { status: AUTH_STATUS_CODES.UNPROCESSABLE_ENTITY }
        );
      }

      // Generic registration error
      console.error('User registration error:', registrationResult.error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create account. Please try again.',
            details:
              process.env.NODE_ENV === 'development'
                ? {
                    errorMessage: registrationResult.error,
                    errorCode: registrationResult.code,
                  }
                : undefined,
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.INTERNAL_SERVER_ERROR }
      );
    }

    // Validate response data
    if (!registrationResult.data || !registrationResult.data.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create account: invalid response from authentication service',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.INTERNAL_SERVER_ERROR }
      );
    }

    const user = registrationResult.data.user;
    const session = registrationResult.data.session;

    // Prepare user metadata
    const userMetadata = user.user_metadata || {};

    // Prepare response
    const accessToken = session?.access_token || '';
    const refreshToken = session?.refresh_token || '';
    const expiresIn = accessToken ? getTokenExpiresIn(accessToken) || TOKEN_EXPIRATION.ACCESS : TOKEN_EXPIRATION.ACCESS;

    const response = {
      success: true as const,
      user: {
        id: user.id,
        email: user.email || email,
        firstName: userMetadata.first_name || firstName || undefined,
        lastName: userMetadata.last_name || lastName || undefined,
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

    // Create response with cookies
    const jsonResponse = NextResponse.json(response, {
      status: AUTH_STATUS_CODES.CREATED,
    });

    // Set refresh token in HTTP-only cookie
    if (refreshToken) {
      jsonResponse.cookies.set({
        name: 'refresh_token',
        value: refreshToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: TOKEN_EXPIRATION.REFRESH,
        path: '/',
      });
    }

    // Set access token in non-HTTP-only cookie for client access
    if (accessToken) {
      jsonResponse.cookies.set({
        name: 'access_token',
        value: accessToken,
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: expiresIn,
        path: '/',
      });
    }

    return jsonResponse;
  } catch (error) {
    console.error('Register endpoint error:', error);

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred during registration',
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
