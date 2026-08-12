import { NextRequest, NextResponse } from 'next/server';
import { isTokenBlacklisted } from './tokenBlacklist';
import { validateToken } from './jwt';

/**
 * Middleware to verify if a token is valid and not blacklisted
 * Use this in your protected API routes
 */
export async function verifyToken(
  request: NextRequest,
  handler: (request: NextRequest, token: string) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid Authorization header',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Token is required',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 401 }
      );
    }

    // Validate token structure and expiration
    if (!validateToken(token)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token is invalid or expired',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 401 }
      );
    }

    // Check if token is blacklisted
    const { isBlacklisted, error: checkError } = await isTokenBlacklisted(token);

    if (checkError) {
      console.error('Error checking token blacklist:', checkError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to verify token',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 500 }
      );
    }

    if (isBlacklisted) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Token has been invalidated. Please log in again.',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 401 }
      );
    }

    // Token is valid, call the handler
    return handler(request, token);
  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while verifying token',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Higher-order function to wrap protected routes
 *
 * Usage:
 * export async function GET(request: NextRequest) {
 *   return withTokenAuth(request, async (req, token) => {
 *     // Your handler logic here
 *     return NextResponse.json({ message: 'Success' });
 *   });
 * }
 */
export function withTokenAuth(
  request: NextRequest,
  handler: (request: NextRequest, token: string) => Promise<NextResponse>
): Promise<NextResponse> {
  return verifyToken(request, handler);
}

/**
 * Extracts Bearer token from Authorization header
 */
export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Checks if request has a valid Bearer token
 */
export function hasValidBearerToken(request: NextRequest): boolean {
  const token = extractBearerToken(request);
  if (!token) {
    return false;
  }
  return validateToken(token);
}
