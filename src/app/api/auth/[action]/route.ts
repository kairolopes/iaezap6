import { NextRequest, NextResponse } from 'next/server';
import {
  validateLoginRequest,
  validateRegisterRequest,
  validateRefreshToken,
  AUTH_STATUS_CODES,
  TOKEN_EXPIRATION,
  type LoginRequest,
  type RegisterRequest,
  type RefreshToken,
  type AuthResponse,
  type AuthError,
} from '@/types/auth';
import {
  hashPassword,
  verifyPassword,
  generateTokens,
  verifyToken,
  refreshAccessToken,
  extractTenantId,
} from '@/lib/auth';
import {
  authenticateUser,
  registerUser,
  getUserInfo,
  createSupabaseServerClient,
} from '@/lib/supabase';
import { getTokenExpiresIn } from '@/lib/jwt';

/**
 * Type for the route parameters
 */
interface RouteParams {
  action: string;
}

/**
 * Type-safe response union
 */
type ApiResponse<T = any> = NextResponse<T>;

/**
 * Unified Authentication Handler
 * Supports multiple auth endpoints through dynamic routing
 *
 * Endpoints:
 * - POST /api/auth/register - Create new user account
 * - POST /api/auth/login - Authenticate user and return tokens
 * - POST /api/auth/refresh - Refresh access token using refresh token
 */

/**
 * Handles user registration
 * Creates a new user account with email, password, and profile information
 * Associated with a company upon creation
 */
async function handleRegister(request: NextRequest): Promise<ApiResponse> {
  try {
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
        } as AuthError,
        { status: AUTH_STATUS_CODES.BAD_REQUEST }
      );
    }

    // Validate request using Zod schema
    const validationResult = validateRegisterRequest(body);

    if (!validationResult.success) {
      const fieldErrors = validationResult.error.flatten().fieldErrors;

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Validation failed',
            details: fieldErrors as Record<string, any>,
            timestamp: new Date().toISOString(),
          },
        } as AuthError,
        { status: AUTH_STATUS_CODES.BAD_REQUEST }
      );
    }

    const { email, password, firstName, lastName, acceptTerms } = validationResult.data as RegisterRequest;

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
        } as AuthError,
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
          } as AuthError,
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
          } as AuthError,
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
        } as AuthError,
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
        } as AuthError,
        { status: AUTH_STATUS_CODES.INTERNAL_SERVER_ERROR }
      );
    }

    const user = registrationResult.data.user;
    const session = registrationResult.data.session;
    const userMetadata = user.user_metadata || {};

    // Generate RS256 tokens using the new auth utility
    const tokens = await generateTokens({
      userId: user.id,
      email: user.email || email,
      roles: userMetadata.roles ? [userMetadata.roles].flat() : ['user'],
      tenantId: userMetadata.company_id || userMetadata.tenant_id,
    });

    const response: AuthResponse = {
      success: true,
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
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        tokenType: tokens.tokenType,
      },
    };

    // Create response with cookies
    const jsonResponse = NextResponse.json(response, {
      status: AUTH_STATUS_CODES.CREATED,
    });

    // Set refresh token in HTTP-only cookie
    if (tokens.refreshToken) {
      jsonResponse.cookies.set({
        name: 'refresh_token',
        value: tokens.refreshToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: TOKEN_EXPIRATION.REFRESH,
        path: '/',
      });
    }

    // Set access token in non-HTTP-only cookie for client access
    if (tokens.accessToken) {
      jsonResponse.cookies.set({
        name: 'access_token',
        value: tokens.accessToken,
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: tokens.expiresIn,
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
      } as AuthError,
      { status: AUTH_STATUS_CODES.INTERNAL_SERVER_ERROR }
    );
  }
}

/**
 * Handles user login
 * Authenticates user with email and password
 * Returns JWT tokens (access + refresh) with user info, company_id, and role
 */
async function handleLogin(request: NextRequest): Promise<ApiResponse> {
  try {
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
        } as AuthError,
        { status: AUTH_STATUS_CODES.BAD_REQUEST }
      );
    }

    // Validate request using Zod schema
    const validationResult = validateLoginRequest(body);

    if (!validationResult.success) {
      const fieldErrors = validationResult.error.flatten().fieldErrors;

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Validation failed',
            details: fieldErrors as Record<string, any>,
            timestamp: new Date().toISOString(),
          },
        } as AuthError,
        { status: AUTH_STATUS_CODES.BAD_REQUEST }
      );
    }

    const { email, password, rememberMe } = validationResult.data as LoginRequest;

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
        } as AuthError,
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
        } as AuthError,
        { status: AUTH_STATUS_CODES.UNAUTHORIZED }
      );
    }

    // Get additional user information
    const userMetadata = user.user_metadata || {};
    const userEmail = user.email || email;

    // Generate RS256 tokens with company_id and role information
    const tokens = await generateTokens({
      userId: user.id,
      email: userEmail,
      roles: userMetadata.roles ? [userMetadata.roles].flat() : ['user'],
      tenantId: userMetadata.company_id || userMetadata.tenant_id,
    });

    const expiresIn = tokens.expiresIn;

    // Build response with tokens containing user info + company_id + role
    const response: AuthResponse = {
      success: true,
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
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn,
        tokenType: tokens.tokenType,
      },
    };

    // Create response with optional cookie for "Remember Me"
    const jsonResponse = NextResponse.json(response, {
      status: AUTH_STATUS_CODES.OK,
    });

    // Set HTTP-only cookie with refresh token if "Remember Me" is enabled
    if (rememberMe && tokens.refreshToken) {
      const refreshTokenExpiry = new Date();
      refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days

      jsonResponse.cookies.set({
        name: 'refresh_token',
        value: tokens.refreshToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: TOKEN_EXPIRATION.REFRESH, // 7 days in seconds
        path: '/',
      });
    }

    // Also set the access token in a cookie for convenience (non-httpOnly for client access)
    if (tokens.accessToken) {
      jsonResponse.cookies.set({
        name: 'access_token',
        value: tokens.accessToken,
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: expiresIn,
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
      } as AuthError,
      { status: AUTH_STATUS_CODES.INTERNAL_SERVER_ERROR }
    );
  }
}

/**
 * Handles token refresh
 * Takes a refresh token and returns a new access token
 * The refresh token is verified and must not be expired
 */
async function handleRefresh(request: NextRequest): Promise<ApiResponse> {
  try {
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
        } as AuthError,
        { status: AUTH_STATUS_CODES.BAD_REQUEST }
      );
    }

    // Validate request using Zod schema
    const validationResult = validateRefreshToken(body);

    if (!validationResult.success) {
      const fieldErrors = validationResult.error.flatten().fieldErrors;

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Validation failed',
            details: fieldErrors as Record<string, any>,
            timestamp: new Date().toISOString(),
          },
        } as AuthError,
        { status: AUTH_STATUS_CODES.BAD_REQUEST }
      );
    }

    const { refreshToken } = validationResult.data as RefreshToken;

    // Verify the refresh token using RS256
    const verifyResult = await verifyToken(refreshToken);

    if (!verifyResult.valid || !verifyResult.payload) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: verifyResult.error || 'Invalid or expired refresh token',
            timestamp: new Date().toISOString(),
          },
        } as AuthError,
        { status: AUTH_STATUS_CODES.UNAUTHORIZED }
      );
    }

    const payload = verifyResult.payload;
    const userId = payload.sub;
    const userEmail = payload.email;
    const userRoles = payload.roles || ['user'];
    const tenantId = payload.tenantId;

    // Generate new tokens
    const newTokens = await generateTokens({
      userId,
      email: userEmail,
      roles: userRoles,
      tenantId,
    });

    // Build response
    const response: AuthResponse = {
      success: true,
      user: {
        id: userId,
        email: userEmail,
        roles: userRoles,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      tokens: {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresIn: newTokens.expiresIn,
        tokenType: newTokens.tokenType,
      },
    };

    // Create response
    const jsonResponse = NextResponse.json(response, {
      status: AUTH_STATUS_CODES.OK,
    });

    // Update the access token cookie
    jsonResponse.cookies.set({
      name: 'access_token',
      value: newTokens.accessToken,
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: newTokens.expiresIn,
      path: '/',
    });

    // Optionally update the refresh token cookie
    if (newTokens.refreshToken) {
      jsonResponse.cookies.set({
        name: 'refresh_token',
        value: newTokens.refreshToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: TOKEN_EXPIRATION.REFRESH,
        path: '/',
      });
    }

    // Set cache control headers to prevent caching of tokens
    jsonResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    jsonResponse.headers.set('Pragma', 'no-cache');
    jsonResponse.headers.set('Expires', '0');

    return jsonResponse;
  } catch (error) {
    console.error('Refresh endpoint error:', error);

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred during token refresh',
          details:
            process.env.NODE_ENV === 'development'
              ? {
                  errorType: error instanceof Error ? error.constructor.name : 'Unknown',
                  errorMessage,
                }
              : undefined,
          timestamp: new Date().toISOString(),
        },
      } as AuthError,
      { status: AUTH_STATUS_CODES.INTERNAL_SERVER_ERROR }
    );
  }
}

/**
 * Main route handler
 * Dispatcher that routes requests to the appropriate handler based on the action parameter
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<ApiResponse> {
  try {
    const params = await context.params;
    const action = params.action?.toLowerCase() || '';

    // Route to appropriate handler
    switch (action) {
      case 'register':
        return await handleRegister(request);

      case 'login':
        return await handleLogin(request);

      case 'refresh':
        return await handleRefresh(request);

      default:
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_CREDENTIALS',
              message: `Unknown authentication action: ${action}. Valid actions are: register, login, refresh`,
              timestamp: new Date().toISOString(),
            },
          } as AuthError,
          { status: AUTH_STATUS_CODES.BAD_REQUEST }
        );
    }
  } catch (error) {
    console.error('Auth route handler error:', error);

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred in the authentication service',
          details:
            process.env.NODE_ENV === 'development'
              ? {
                  errorType: error instanceof Error ? error.constructor.name : 'Unknown',
                  errorMessage,
                }
              : undefined,
          timestamp: new Date().toISOString(),
        },
      } as AuthError,
      { status: AUTH_STATUS_CODES.INTERNAL_SERVER_ERROR }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight requests
 */
export async function OPTIONS(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse> {
  const headers = {
    'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  return NextResponse.json({}, { headers, status: 200 });
}

/**
 * Unsupported method handler
 */
export async function GET(request: NextRequest): Promise<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Method GET not allowed for authentication endpoints',
        timestamp: new Date().toISOString(),
      },
    } as AuthError,
    { status: AUTH_STATUS_CODES.BAD_REQUEST }
  );
}
