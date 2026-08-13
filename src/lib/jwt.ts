import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

/**
 * JWT Claims structure for IAeZap
 */
export interface JwtClaims {
  user_id: string;
  company_id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

/**
 * JWT Configuration
 */
interface JwtConfig {
  privateKey: string;
  publicKey: string;
  algorithm: 'RS256';
  issuer: string;
  audience: string;
  accessTokenExpiry: number; // in seconds
  refreshTokenExpiry: number; // in seconds
}

/**
 * Get JWT configuration from environment variables
 */
function getJwtConfig(): JwtConfig {
  const privateKey = process.env.JWT_PRIVATE_KEY;
  const publicKey = process.env.JWT_PUBLIC_KEY;

  if (!privateKey || !publicKey) {
    throw new Error(
      'JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables are required. ' +
      'Generate RSA keys with: openssl genrsa -out private.key 2048 && openssl rsa -in private.key -pubout -out public.key'
    );
  }

  return {
    privateKey: privateKey.replace(/\\n/g, '\n'),
    publicKey: publicKey.replace(/\\n/g, '\n'),
    algorithm: 'RS256',
    issuer: process.env.JWT_ISSUER || 'iaezap',
    audience: process.env.JWT_AUDIENCE || 'iaezap-api',
    accessTokenExpiry: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRY || '3600', 10), // 1 hour
    refreshTokenExpiry: parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRY || '604800', 10), // 7 days
  };
}

/**
 * Sign a JWT token with RS256
 * @param claims JWT claims to include in the token
 * @param expiresIn Token expiration time in seconds (optional, uses accessTokenExpiry if not provided)
 * @returns Signed JWT token
 */
export function signToken(claims: JwtClaims, expiresIn?: number): string {
  const config = getJwtConfig();

  const payload = {
    ...claims,
    iss: config.issuer,
    aud: config.audience,
  };

  return jwt.sign(payload, config.privateKey, {
    algorithm: config.algorithm,
    expiresIn: expiresIn || config.accessTokenExpiry,
  });
}

/**
 * Generate access token
 * @param userId User ID
 * @param companyId Company ID
 * @param email User email
 * @param role User role
 * @returns Signed access token
 */
export function generateAccessToken(
  userId: string,
  companyId: string,
  email: string,
  role: string
): string {
  const config = getJwtConfig();

  const claims: JwtClaims = {
    user_id: userId,
    company_id: companyId,
    email,
    role,
  };

  return signToken(claims, config.accessTokenExpiry);
}

/**
 * Generate refresh token
 * @param userId User ID
 * @param companyId Company ID
 * @returns Signed refresh token
 */
export function generateRefreshToken(
  userId: string,
  companyId: string
): string {
  const config = getJwtConfig();

  const claims: JwtClaims = {
    user_id: userId,
    company_id: companyId,
    email: '',
    role: 'refresh',
  };

  return signToken(claims, config.refreshTokenExpiry);
}

/**
 * Generate token pair (access + refresh)
 * @param userId User ID
 * @param companyId Company ID
 * @param email User email
 * @param role User role
 * @returns Object containing access token, refresh token, and expiry
 */
export function generateTokenPair(
  userId: string,
  companyId: string,
  email: string,
  role: string
): {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
} {
  const config = getJwtConfig();
  const accessToken = generateAccessToken(userId, companyId, email, role);
  const refreshToken = generateRefreshToken(userId, companyId);

  return {
    accessToken,
    refreshToken,
    expiresIn: config.accessTokenExpiry,
    tokenType: 'Bearer',
  };
}

/**
 * Verify and decode a JWT token
 * @param token JWT token to verify
 * @returns Decoded token claims if valid, null otherwise
 */
export function verifyToken(token: string): JwtClaims | null {
  try {
    const config = getJwtConfig();

    const decoded = jwt.verify(token, config.publicKey, {
      algorithms: [config.algorithm],
      issuer: config.issuer,
      audience: config.audience,
    }) as JwtClaims;

    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Extract claims from a token without verifying the signature
 * Warning: Only use this if you trust the token source
 * @param token JWT token
 * @returns Decoded claims if valid JWT format, null otherwise
 */
export function extractClaimsWithoutVerification(token: string): JwtClaims | null {
  try {
    const decoded = jwt.decode(token) as JwtClaims | null;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Get expiration time of a token in seconds
 * @param token JWT token
 * @returns Remaining seconds until expiration, null if invalid
 */
export function getTokenExpiryTime(token: string): number | null {
  const claims = extractClaimsWithoutVerification(token);
  if (!claims || !claims.exp) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.max(0, claims.exp - nowSeconds);
}

/**
 * Check if a token is expired
 * @param token JWT token
 * @returns true if expired, false if valid
 */
export function isTokenExpired(token: string): boolean {
  const expiryTime = getTokenExpiryTime(token);
  return expiryTime === null || expiryTime <= 0;
}

/**
 * Extract Bearer token from Authorization header
 * @param request NextRequest
 * @returns Token string if found, null otherwise
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
 * Advanced token extraction from multiple sources
 * Priority: Authorization header > Cookie > Query parameter
 * @param request NextRequest
 * @returns Token string if found, null otherwise
 */
export function extractTokenFromRequestAdvanced(request: NextRequest): string | null {
  // Try Authorization header first
  const headerToken = extractTokenFromRequest(request);
  if (headerToken) {
    return headerToken;
  }

  // Try Authorization cookie
  const authCookie = request.cookies.get('Authorization')?.value;
  if (authCookie) {
    return authCookie.startsWith('Bearer ') ? authCookie.slice(7) : authCookie;
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

/**
 * Type for middleware protected request
 */
export interface AuthenticatedNextRequest extends NextRequest {
  user?: JwtClaims;
}

/**
 * Get user claims from authenticated request
 * @param request AuthenticatedNextRequest
 * @returns User claims if authenticated, null otherwise
 */
export function getUserFromRequest(request: AuthenticatedNextRequest): JwtClaims | null {
  return request.user || null;
}

/**
 * Middleware to protect routes with JWT authentication
 * Usage: return withAuth(handler)(request, context);
 * @param handler Route handler function
 * @returns Wrapped handler with authentication
 */
export function withAuth(
  handler: (request: AuthenticatedNextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
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

    const claims = verifyToken(token);

    if (!claims) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired authorization token',
          code: 'INVALID_TOKEN',
        },
        { status: 401 }
      );
    }

    // Attach user claims to request
    const authenticatedRequest = request as AuthenticatedNextRequest;
    authenticatedRequest.user = claims;

    return handler(authenticatedRequest);
  };
}

/**
 * Middleware to protect routes with optional authentication
 * Similar to withAuth but returns error details instead of rejecting
 * @param handler Route handler function
 * @returns Wrapped handler with optional authentication
 */
export function withOptionalAuth(
  handler: (request: AuthenticatedNextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const token = extractTokenFromRequest(request);
    const authenticatedRequest = request as AuthenticatedNextRequest;

    if (token) {
      const claims = verifyToken(token);
      if (claims) {
        authenticatedRequest.user = claims;
      }
    }

    return handler(authenticatedRequest);
  };
}

/**
 * Middleware to protect routes and require specific roles
 * @param handler Route handler function
 * @param requiredRoles Array of roles that are allowed
 * @returns Wrapped handler with role-based authentication
 */
export function withRoleAuth(
  handler: (request: AuthenticatedNextRequest) => Promise<NextResponse>,
  requiredRoles: string[]
): (request: NextRequest) => Promise<NextResponse> {
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

    const claims = verifyToken(token);

    if (!claims) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired authorization token',
          code: 'INVALID_TOKEN',
        },
        { status: 401 }
      );
    }

    if (!requiredRoles.includes(claims.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'User does not have the required role',
          code: 'INSUFFICIENT_PERMISSIONS',
        },
        { status: 403 }
      );
    }

    const authenticatedRequest = request as AuthenticatedNextRequest;
    authenticatedRequest.user = claims;

    return handler(authenticatedRequest);
  };
}

/**
 * Utility to generate RSA key pair for development/testing
 * In production, generate keys securely and store in environment variables
 * Usage: Run once and add keys to .env.local
 * Command: node -e "require('./src/lib/jwt').generateRSAKeyPair().then(keys => console.log(JSON.stringify(keys, null, 2)))"
 */
export async function generateRSAKeyPair(): Promise<{
  privateKey: string;
  publicKey: string;
}> {
  // Check if crypto is available
  if (typeof require !== 'undefined') {
    const crypto = require('crypto');
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return {
      privateKey,
      publicKey,
    };
  }

  throw new Error('RSA key generation requires Node.js crypto module');
}
