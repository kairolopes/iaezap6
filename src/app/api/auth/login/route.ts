import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/auth/supabase';
import { verifyPassword, generateTokens } from '@/lib/auth';
import { AUTH_STATUS_CODES } from '@/types/auth';
import { z } from 'zod';

/**
 * POST /api/auth/login
 *
 * Authenticates a user with email and password
 * Finds user by email with company_id, verifies password with bcrypt,
 * and signs JWT tokens with RS256
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "password123",
 *   "companyId": "company-uuid" (optional - required if not specified by other means)
 * }
 *
 * Success Response (200):
 * {
 *   "success": true,
 *   "access_token": "eyJhbGciOiJSUzI1NiIs...",
 *   "refresh_token": "eyJhbGciOiJSUzI1NiIs...",
 *   "user": {
 *     "id": "user-uuid",
 *     "email": "user@example.com",
 *     "full_name": "John Doe",
 *     "role": "user",
 *     "company_id": "company-uuid"
 *   },
 *   "company_id": "company-uuid",
 *   "expires_in": 3600,
 *   "token_type": "Bearer"
 * }
 *
 * Error Responses:
 * 400 - Invalid request (validation error)
 * 401 - Invalid credentials (user not found or password mismatch)
 * 500 - Internal server error
 */

// Validation schema for login request
const loginRequestSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(1, 'Password is required'),
  companyId: z
    .string()
    .uuid('Invalid company ID format')
    .optional(),
});

type LoginRequest = z.infer<typeof loginRequestSchema>;

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
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

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: fieldErrors,
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.BAD_REQUEST }
      );
    }

    const { email, password, companyId } = validationResult.data;

    // Build query to find user by email
    let query = supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .is('deleted_at', null)
      .limit(1);

    // If companyId is provided, filter by it
    if (companyId) {
      query = supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .limit(1);
    }

    // Execute query and get first result
    const { data: userData, error: userError } = await query;
    const user = Array.isArray(userData) ? userData[0] : userData;

    // User not found or database error
    if (userError || !user) {
      console.error('User lookup error:', userError?.message);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.UNAUTHORIZED }
      );
    }

    // Verify password with bcrypt
    let passwordValid = false;
    try {
      passwordValid = await verifyPassword(password, user.password_hash || '');
    } catch (error) {
      console.error('Password verification error:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.UNAUTHORIZED }
      );
    }

    if (!passwordValid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.UNAUTHORIZED }
      );
    }

    // Generate JWT tokens with RS256
    let tokenPair;
    try {
      tokenPair = await generateTokens({
        userId: user.id,
        email: user.email,
        roles: user.role ? [user.role] : ['user'],
        tenantId: user.company_id,
      });
    } catch (error) {
      console.error('Token generation error:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TOKEN_GENERATION_ERROR',
            message: 'Failed to generate authentication tokens',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.INTERNAL_SERVER_ERROR }
      );
    }

    // Build success response
    const response = {
      success: true,
      access_token: tokenPair.accessToken,
      refresh_token: tokenPair.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name || null,
        role: user.role || 'user',
        company_id: user.company_id,
        status: user.status || 'active',
      },
      company_id: user.company_id,
      expires_in: tokenPair.expiresIn,
      token_type: tokenPair.tokenType,
    };

    // Create response with optional cookies
    const jsonResponse = NextResponse.json(response, {
      status: AUTH_STATUS_CODES.OK,
    });

    // Set HTTP-only cookie with refresh token
    jsonResponse.cookies.set({
      name: 'refresh_token',
      value: tokenPair.refreshToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      path: '/',
    });

    // Set non-HTTP-only access token cookie for client access
    jsonResponse.cookies.set({
      name: 'access_token',
      value: tokenPair.accessToken,
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenPair.expiresIn,
      path: '/',
    });

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
