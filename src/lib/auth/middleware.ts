import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from './tokens';

/**
 * Middleware to verify access token in requests
 * Can be used to protect API routes
 */
export function withAuth(handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    const token = extractTokenFromRequest(request);

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing authorization token',
          code: 'MISSING_TOKEN',
        },
        { status: 401 }
      );
    }

    const payload = verifyAccessToken(token);

    if (!payload) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid authorization token',
          code: 'INVALID_TOKEN',
        },
        { status: 401 }
      );
    }

    // Attach user info to request headers for access in handler
    const requestWithUser = new NextRequest(request);
    (requestWithUser as any).user = payload;

    return handler(requestWithUser);
  };
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Get user info from request if authenticated with middleware
 */
export function getUserFromRequest(request: NextRequest): any {
  return (request as any).user || null;
}

/**
 * Extract token from various sources (header, cookie, query param)
 */
export function extractTokenFromRequestAdvanced(request: NextRequest): string | null {
  // Try Authorization header first
  const token = extractTokenFromRequest(request);
  if (token) {
    return token;
  }

  // Try Authorization cookie
  const cookieToken = request.cookies.get('Authorization')?.value;
  if (cookieToken) {
    return cookieToken.startsWith('Bearer ') ? cookieToken.slice(7) : cookieToken;
  }

  // Try access_token cookie
  const accessTokenCookie = request.cookies.get('access_token')?.value;
  if (accessTokenCookie) {
    return accessTokenCookie;
  }

  // Try query parameter (not recommended for sensitive tokens)
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('access_token');
  if (queryToken) {
    return queryToken;
  }

  return null;
}
