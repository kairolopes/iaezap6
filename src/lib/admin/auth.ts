import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/tokens';
import { extractTokenFromRequestAdvanced } from '@/lib/auth/middleware';
import { ADMIN_STATUS_CODES } from '@/types/admin';

/**
 * Extract and verify token from request
 * Returns the decoded JWT payload if valid, null otherwise
 */
export function extractAndVerifyToken(request: NextRequest) {
  const token = extractTokenFromRequestAdvanced(request);

  if (!token) {
    return null;
  }

  return verifyAccessToken(token);
}

/**
 * Check if user has master/admin role
 * Master role is represented as 'admin' in the JWT token's role claim
 */
export function isMasterUser(payload: any): boolean {
  if (!payload) {
    return false;
  }

  const role = payload.role || payload.roles;

  // Check if user has admin/master role
  if (typeof role === 'string') {
    return role === 'admin' || role === 'master';
  }

  if (Array.isArray(role)) {
    return role.includes('admin') || role.includes('master');
  }

  return false;
}

/**
 * Middleware to verify master/admin authorization
 * Used to protect admin endpoints
 */
export function withMasterAuth(
  handler: (request: NextRequest, payload: any) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    // Verify token
    const payload = extractAndVerifyToken(request);

    if (!payload) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid authorization token',
            timestamp: new Date().toISOString(),
          },
        },
        { status: ADMIN_STATUS_CODES.UNAUTHORIZED }
      );
    }

    // Check for master/admin role
    if (!isMasterUser(payload)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only master/admin users can access this endpoint',
            timestamp: new Date().toISOString(),
          },
        },
        { status: ADMIN_STATUS_CODES.FORBIDDEN }
      );
    }

    // Call the actual handler with the verified payload
    return handler(request, payload);
  };
}

/**
 * Format error response
 */
export function formatErrorResponse(
  code: string,
  message: string,
  statusCode: number,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
        timestamp: new Date().toISOString(),
      },
    },
    { status: statusCode }
  );
}

/**
 * Format success response
 */
export function formatSuccessResponse(data: any, statusCode: number = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
}
