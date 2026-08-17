import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase';
import { verifyAccessToken } from '@/lib/auth/tokens';
import { AUTH_STATUS_CODES } from '@/types/auth';
import { extractTokenFromRequest } from '@/lib/auth/middleware';
import { addUserToCompanySchema } from '@/types/admin';

/**
 * GET /api/admin/users
 *
 * Lists all users in the authenticated user's company
 * Requires authentication with admin role
 *
 * Query Parameters:
 * - role: Filter by role (admin, supervisor, operador)
 * - status: Filter by status (active, inactive, invited, suspended)
 * - limit: Number of results (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 * - search: Search by email or name
 *
 * Success Response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "users": [
 *       {
 *         "id": "uuid",
 *         "email": "user@example.com",
 *         "fullName": "John Doe",
 *         "displayName": "john.doe",
 *         "role": "supervisor",
 *         "status": "active",
 *         "emailVerified": true,
 *         "lastLoginAt": "2026-08-12T10:00:00Z",
 *         "createdAt": "2026-08-12T10:00:00Z",
 *         "updatedAt": "2026-08-12T10:00:00Z"
 *       }
 *     ],
 *     "total": 42,
 *     "limit": 50,
 *     "offset": 0
 *   }
 * }
 *
 * Error Responses:
 * 401 - Unauthorized (missing/invalid token)
 * 403 - Forbidden (insufficient permissions)
 * 500 - Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    // Extract and verify token
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing authorization token',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.UNAUTHORIZED }
      );
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid authorization token',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.UNAUTHORIZED }
      );
    }

    const userId = payload.sub;

    // Get query parameters
    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Get Supabase client
    const supabase = createSupabaseServerClient();

    // First, get the current user's info to verify they're in a company and check their role
    const { data: currentUserData, error: currentUserError } = await supabase
      .from('users')
      .select('id, company_id, role')
      .eq('id', userId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .single();

    if (currentUserError || !currentUserData) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not found or inactive',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.UNAUTHORIZED }
      );
    }

    // Check if user has admin/owner role
    if (!['owner', 'admin'].includes(currentUserData.role)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only admin or owner users can manage users',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.FORBIDDEN }
      );
    }

    const companyId = currentUserData.company_id;

    // Build query
    let query = supabase
      .from('users')
      .select(
        'id, email, full_name, display_name, role, status, email_verified, last_login_at, created_at, updated_at',
        { count: 'exact' }
      )
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (role) {
      query = query.eq('role', role);
    }
    if (status) {
      query = query.eq('status', status);
    }

    // Apply search filter
    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    }

    const { data: users, error: usersError, count } = await query;

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch users',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.INTERNAL_SERVER_ERROR }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          users: (users || []).map(user => ({
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            displayName: user.display_name,
            role: user.role,
            status: user.status,
            emailVerified: user.email_verified,
            lastLoginAt: user.last_login_at,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
          })),
          total: count || 0,
          limit,
          offset,
        },
      },
      { status: AUTH_STATUS_CODES.OK }
    );
  } catch (error) {
    console.error('List users endpoint error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while listing users',
          timestamp: new Date().toISOString(),
        },
      },
      { status: AUTH_STATUS_CODES.INTERNAL_SERVER_ERROR }
    );
  }
}

/**
 * POST /api/admin/users
 *
 * Adds a new user to the authenticated user's company
 * Requires authentication with admin role
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "fullName": "John Doe",
 *   "role": "admin" | "supervisor" | "operador"
 * }
 *
 * Success Response (201):
 * {
 *   "success": true,
 *   "data": {
 *     "user": {
 *       "id": "uuid",
 *       "email": "user@example.com",
 *       "fullName": "John Doe",
 *       "displayName": "john.doe",
 *       "role": "supervisor",
 *       "status": "active",
 *       "emailVerified": false,
 *       "createdAt": "2026-08-12T10:00:00Z",
 *       "updatedAt": "2026-08-12T10:00:00Z"
 *     }
 *   }
 * }
 *
 * Error Responses:
 * 400 - Bad request (validation error)
 * 401 - Unauthorized (missing/invalid token)
 * 403 - Forbidden (insufficient permissions)
 * 409 - Conflict (email already exists in company)
 * 500 - Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    // Extract and verify token
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing authorization token',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.UNAUTHORIZED }
      );
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid authorization token',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.UNAUTHORIZED }
      );
    }

    const userId = payload.sub;

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
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

    const validationResult = addUserToCompanySchema.safeParse(body);
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

    const { email, fullName, role } = validationResult.data;

    // Get Supabase client
    const supabase = createSupabaseServerClient();

    // Get current user info to verify they're in a company and have admin role
    const { data: currentUserData, error: currentUserError } = await supabase
      .from('users')
      .select('id, company_id, role')
      .eq('id', userId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .single();

    if (currentUserError || !currentUserData) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not found or inactive',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.UNAUTHORIZED }
      );
    }

    // Check if user has admin/owner role
    if (!['owner', 'admin'].includes(currentUserData.role)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only admin or owner users can add users to company',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.FORBIDDEN }
      );
    }

    const companyId = currentUserData.company_id;

    // Check if user with this email already exists in the company
    const { data: existingUser, error: existingUserError } = await supabase
      .from('users')
      .select('id, email')
      .eq('company_id', companyId)
      .eq('email', email.toLowerCase())
      .is('deleted_at', null)
      .single();

    // No error means user exists, return conflict
    if (!existingUserError && existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EMAIL_CONFLICT',
            message: 'Email already exists in company',
            details: { email },
            timestamp: new Date().toISOString(),
          },
        },
        { status: 409 }
      );
    }

    // Create new user in company
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([
        {
          company_id: companyId,
          email: email.toLowerCase(),
          full_name: fullName || null,
          role: role,
          status: 'active',
          email_verified: false,
        },
      ])
      .select('id, email, full_name, display_name, role, status, email_verified, created_at, updated_at')
      .single();

    if (createError) {
      console.error('Error creating user:', createError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_CREATE_ERROR',
            message: 'Failed to create user',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.INTERNAL_SERVER_ERROR }
      );
    }

    // Create audit log
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    const userAgent = request.headers.get('user-agent');
    try {
      await supabase
        .from('audit_logs')
        .insert([
          {
            company_id: companyId,
            user_id: userId,
            action: 'USER_CREATED',
            entity_type: 'user',
            entity_id: newUser.id,
            new_values: JSON.stringify({
              email: newUser.email,
              fullName: newUser.full_name,
              role: newUser.role,
            }),
            ip_address: ipAddress || null,
            user_agent: userAgent || null,
          },
        ]);
    } catch (error) {
      console.error('Error creating audit log:', error);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: newUser.id,
            email: newUser.email,
            fullName: newUser.full_name,
            displayName: newUser.display_name,
            role: newUser.role,
            status: newUser.status,
            emailVerified: newUser.email_verified,
            createdAt: newUser.created_at,
            updatedAt: newUser.updated_at,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Add user endpoint error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while adding user',
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  return NextResponse.json({}, { headers, status: 200 });
}
