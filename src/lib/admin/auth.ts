import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { extractTokenFromRequestAdvanced } from '@/lib/auth/middleware';
import { ADMIN_STATUS_CODES } from '@/types/admin';

/**
 * Extract and verify token from request
 * Returns the decoded JWT payload if valid, null otherwise
 * Uses RS256 verification with proper issuer and audience validation
 */
export async function extractAndVerifyToken(request: NextRequest) {
  const token = extractTokenFromRequestAdvanced(request);

  if (!token) {
    return null;
  }

  const result = await verifyToken(token);

  if (!result.valid || !result.payload) {
    return null;
  }

  return result.payload;
}

/**
 * Check if user has master/admin role
 * Master roles: 'admin', 'master', 'owner' (system owner)
 */
export function isMasterUser(payload: any): boolean {
  if (!payload) {
    return false;
  }

  const role = payload.role || payload.roles;

  // Check if user has admin/master/owner role
  if (typeof role === 'string') {
    return role === 'admin' || role === 'master' || role === 'owner';
  }

  if (Array.isArray(role)) {
    return role.includes('admin') || role.includes('master') || role.includes('owner');
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
    const payload = await extractAndVerifyToken(request);

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
