import { NextRequest, NextResponse } from 'next/server';
import {
  verifyToken,
  extractTokenFromRequest,
  extractTokenFromRequestAdvanced,
  JwtClaims,
  AuthenticatedNextRequest,
} from '@/lib/jwt';
import { isTokenBlacklisted } from '@/lib/tokenBlacklist';

/**
 * Extended authenticated request with user context
 */
export interface AuthContext {
  user_id: string;
  company_id: string;
  email: string;
  role: string;
  is_authenticated: boolean;
  token?: string;
  claims?: JwtClaims;
}

/**
 * Authenticated request with attached context
 */
export interface ContextualNextRequest extends NextRequest {
  auth?: AuthContext;
}

/**
 * Authentication error details
 */
export interface AuthError {
  code: string;
  message: string;
  status: number;
  details?: Record<string, any>;
}

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean;
  context?: AuthContext;
  error?: AuthError;
  request?: ContextualNextRequest;
}

/**
 * Options for authentication middleware
 */
export interface AuthOptions {
  /**
   * Whether to use advanced token extraction (header, cookie, query)
   * Default: false (header only)
   */
  advanced?: boolean;

  /**
   * Whether to check token blacklist
   * Default: true
   */
  checkBlacklist?: boolean;

  /**
   * Whether to allow optional authentication (non-authenticated requests pass through)
   * Default: false (authentication required)
   */
  optional?: boolean;

  /**
   * Required roles for this route
   * If provided, user must have one of these roles
   */
  requiredRoles?: string[];

  /**
   * Exclude certain paths from authentication
   * Useful for public API endpoints
   */
  excludePaths?: string[];
}

/**
 * Verify JWT token and extract user context
 * This is the core authentication logic
 *
 * @param token JWT token string
 * @param options Authentication options
 * @returns Authentication result with user context
 */
export async function verifyAuthentication(
  token: string,
  options: AuthOptions = {}
): Promise<AuthResult> {
  const {
    checkBlacklist = true,
    requiredRoles,
  } = options;

  try {
    // Verify token signature and expiration
    const claims = verifyToken(token);

    if (!claims) {
      return {
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token signature verification failed or token is expired',
          status: 401,
        },
      };
    }

    // Check token blacklist if enabled
    if (checkBlacklist) {
      try {
        const { isBlacklisted } = await isTokenBlacklisted(token);

        if (isBlacklisted) {
          return {
            success: false,
            error: {
              code: 'BLACKLISTED_TOKEN',
              message: 'Token has been invalidated. Please log in again.',
              status: 401,
            },
          };
        }
      } catch (error) {
        console.error('Error checking token blacklist:', error);
        // Don't fail if blacklist check fails, but log it
        // In production, you might want to fail closed
      }
    }

    // Check required roles
    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(claims.role)) {
        return {
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: `User role '${claims.role}' does not have required permissions. Required roles: ${requiredRoles.join(', ')}`,
            status: 403,
            details: {
              userRole: claims.role,
              requiredRoles,
            },
          },
        };
      }
    }

    // Build authentication context
    const context: AuthContext = {
      user_id: claims.user_id,
      company_id: claims.company_id,
      email: claims.email,
      role: claims.role,
      is_authenticated: true,
      token,
      claims,
    };

    return {
      success: true,
      context,
    };
  } catch (error) {
    console.error('Authentication verification error:', error);
    return {
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'An error occurred during authentication',
        status: 500,
      },
    };
  }
}

/**
 * Extract token from request and verify authentication
 *
 * @param request NextRequest
 * @param options Authentication options
 * @returns Authentication result
 */
export async function authenticateRequest(
  request: NextRequest,
  options: AuthOptions = {}
): Promise<AuthResult> {
  const { advanced = false, optional = false } = options;

  try {
    // Extract token from request
    const token = advanced
      ? extractTokenFromRequestAdvanced(request)
      : extractTokenFromRequest(request);

    // Handle missing token
    if (!token) {
      if (optional) {
        // Return unauthenticated context for optional routes
        const context: AuthContext = {
          user_id: '',
          company_id: '',
          email: '',
          role: '',
          is_authenticated: false,
        };
        return {
          success: true,
          context,
          request: request as ContextualNextRequest,
        };
      }

      return {
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization token is required. Provide it in the Authorization header as "Bearer <token>" or in cookies.',
          status: 401,
        },
      };
    }

    // Verify the token
    const result = await verifyAuthentication(token, options);

    if (result.success && result.context) {
      // Attach context to request and return
      const contextualRequest = request as ContextualNextRequest;
      contextualRequest.auth = result.context;
      return {
        ...result,
        request: contextualRequest,
      };
    }

    return result;
  } catch (error) {
    console.error('Request authentication error:', error);
    return {
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'An error occurred during authentication',
        status: 500,
      },
    };
  }
}

/**
 * Middleware to protect routes with JWT authentication
 *
 * Usage in API route:
 * ```ts
 * export async function GET(request: NextRequest) {
 *   const authResult = await authMiddleware(request);
 *   if (!authResult.success) {
 *     return NextResponse.json(
 *       { success: false, error: authResult.error },
 *       { status: authResult.error?.status }
 *     );
 *   }
 *   // Access user context: authResult.request?.auth
 *   return NextResponse.json({ success: true });
 * }
 * ```
 *
 * @param request NextRequest
 * @param options Authentication options
 * @returns Authentication result with request context attached
 */
export async function authMiddleware(
  request: NextRequest,
  options: AuthOptions = {}
): Promise<AuthResult> {
  return authenticateRequest(request, options);
}

/**
 * Check if request path should be excluded from authentication
 *
 * @param pathname Request pathname
 * @param excludePaths List of paths to exclude (supports glob patterns)
 * @returns true if path should be excluded
 */
export function shouldExcludePath(pathname: string, excludePaths: string[] = []): boolean {
  if (!excludePaths || excludePaths.length === 0) {
    return false;
  }

  for (const pattern of excludePaths) {
    // Simple glob pattern matching
    const regex = patternToRegex(pattern);
    if (regex.test(pathname)) {
      return true;
    }
  }

  return false;
}

/**
 * Convert glob pattern to regex
 * Supports: *, **, ?
 *
 * @param pattern Glob pattern
 * @returns RegExp
 */
function patternToRegex(pattern: string): RegExp {
  let regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  return new RegExp(`^${regexPattern}$`);
}

/**
 * Create a protected route handler wrapper
 *
 * Usage:
 * ```ts
 * const protectedHandler = withAuth(async (request, context) => {
 *   console.log(context.user_id);
 *   return NextResponse.json({ success: true });
 * });
 *
 * export const GET = protectedHandler;
 * ```
 *
 * @param handler Route handler function
 * @param options Authentication options
 * @returns Wrapped route handler
 */
export function withAuth(
  handler: (request: ContextualNextRequest, context: AuthContext) => Promise<NextResponse>,
  options: AuthOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Check if path should be excluded
    if (options.excludePaths && shouldExcludePath(new URL(request.url).pathname, options.excludePaths)) {
      const contextualRequest = request as ContextualNextRequest;
      contextualRequest.auth = {
        user_id: '',
        company_id: '',
        email: '',
        role: '',
        is_authenticated: false,
      };
      return handler(contextualRequest, contextualRequest.auth);
    }

    const result = await authMiddleware(request, options);

    if (!result.success || !result.context) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: result.error?.code,
            message: result.error?.message,
          },
        },
        { status: result.error?.status || 401 }
      );
    }

    // Request context is already attached by authMiddleware
    const contextualRequest = result.request || (request as ContextualNextRequest);
    return handler(contextualRequest, result.context);
  };
}

/**
 * Create an optional authentication wrapper
 * Non-authenticated requests still pass through with empty context
 *
 * Usage:
 * ```ts
 * const optionalAuthHandler = withOptionalAuth(async (request, context) => {
 *   if (context.is_authenticated) {
 *     // User is authenticated
 *   } else {
 *     // User is not authenticated
 *   }
 *   return NextResponse.json({ success: true });
 * });
 * ```
 *
 * @param handler Route handler function
 * @param options Authentication options
 * @returns Wrapped route handler
 */
export function withOptionalAuth(
  handler: (request: ContextualNextRequest, context: AuthContext) => Promise<NextResponse>,
  options: AuthOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const result = await authMiddleware(request, {
      ...options,
      optional: true,
    });

    if (!result.context) {
      // Fallback to unauthenticated context
      result.context = {
        user_id: '',
        company_id: '',
        email: '',
        role: '',
        is_authenticated: false,
      };
    }

    const contextualRequest = result.request || (request as ContextualNextRequest);
    contextualRequest.auth = result.context;

    return handler(contextualRequest, result.context);
  };
}

/**
 * Create a role-protected route handler wrapper
 *
 * Usage:
 * ```ts
 * const adminHandler = withRoleAuth(
 *   async (request, context) => {
 *     return NextResponse.json({ role: context.role });
 *   },
 *   ['admin']
 * );
 *
 * export const GET = adminHandler;
 * ```
 *
 * @param handler Route handler function
 * @param requiredRoles List of roles that are allowed
 * @param options Authentication options
 * @returns Wrapped route handler
 */
export function withRoleAuth(
  handler: (request: ContextualNextRequest, context: AuthContext) => Promise<NextResponse>,
  requiredRoles: string[],
  options: AuthOptions = {}
) {
  return withAuth(handler, {
    ...options,
    requiredRoles,
  });
}

/**
 * Utility to get authentication context from request
 * Use inside route handlers that have been wrapped with withAuth
 *
 * @param request ContextualNextRequest
 * @returns AuthContext or null if not authenticated
 */
export function getAuthContext(request: ContextualNextRequest): AuthContext | null {
  return request.auth || null;
}

/**
 * Check if request is authenticated
 *
 * @param request ContextualNextRequest
 * @returns true if authenticated
 */
export function isAuthenticated(request: ContextualNextRequest): boolean {
  return request.auth?.is_authenticated || false;
}

/**
 * Check if user has a specific role
 *
 * @param request ContextualNextRequest
 * @param role Role to check
 * @returns true if user has the role
 */
export function hasRole(request: ContextualNextRequest, role: string): boolean {
  return request.auth?.role === role;
}

/**
 * Check if user has any of the specified roles
 *
 * @param request ContextualNextRequest
 * @param roles Roles to check
 * @returns true if user has any of the roles
 */
export function hasAnyRole(request: ContextualNextRequest, roles: string[]): boolean {
  return request.auth ? roles.includes(request.auth.role) : false;
}

/**
 * Check if user belongs to a specific company
 *
 * @param request ContextualNextRequest
 * @param companyId Company ID to check
 * @returns true if user belongs to company
 */
export function belongsToCompany(request: ContextualNextRequest, companyId: string): boolean {
  return request.auth?.company_id === companyId;
}
