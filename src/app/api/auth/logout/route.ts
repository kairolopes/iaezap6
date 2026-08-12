import { NextRequest, NextResponse } from 'next/server';
import { blacklistToken } from '@/lib/tokenBlacklist';

interface LogoutRequest {
  token?: string;
}

interface LogoutResponse {
  success: boolean;
  message: string;
}

/**
 * POST /api/auth/logout
 *
 * Handles user logout by invalidating the authentication token.
 * The token is added to a blacklist in the database to prevent further use.
 *
 * Request body:
 * {
 *   "token": "your-auth-token" // Optional - can also be extracted from Authorization header
 * }
 *
 * Authorization header:
 * Authorization: Bearer <token>
 *
 * Response:
 * - 200: Token successfully invalidated
 * - 400: Missing or invalid token
 * - 500: Database error
 *
 * Examples:
 *
 * Using request body:
 * POST /api/auth/logout
 * Content-Type: application/json
 *
 * {
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 *
 * Using Authorization header:
 * POST /api/auth/logout
 * Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 */
export async function POST(request: NextRequest): Promise<NextResponse<LogoutResponse>> {
  try {
    // Extract token from request body or Authorization header
    let token: string | null = null;

    // Try to get token from request body first
    try {
      const body = await request.json() as LogoutRequest;
      token = body.token;
    } catch {
      // Body might not be JSON, continue to check headers
    }

    // If not in body, try Authorization header
    if (!token) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      }
    }

    // Validate that we have a token
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: 'Token is required for logout. Provide it in request body or Authorization header.',
        },
        { status: 400 }
      );
    }

    // Validate token format (basic check)
    if (typeof token !== 'string' || token.length < 10) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid token format.',
        },
        { status: 400 }
      );
    }

    // Add token to blacklist
    const result = await blacklistToken(token, 24); // 24 hours expiry

    if (!result.success) {
      console.error('Failed to blacklist token:', result.error);
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to invalidate token.',
        },
        { status: 500 }
      );
    }

    // Success response
    return NextResponse.json(
      {
        success: true,
        message: 'Successfully logged out. Token has been invalidated.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'An error occurred during logout.',
      },
      { status: 500 }
    );
  }
}
