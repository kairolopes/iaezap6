import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase';
import { verifyAccessToken } from '@/lib/auth/tokens';
import { AUTH_STATUS_CODES } from '@/types/auth';
import { extractTokenFromRequest } from '@/lib/auth/middleware';

/**
 * Validation schema for role change requests
 *
 * Role hierarchy matches the `user_role` Postgres enum defined in
 * src/lib/auth/001_create_companies_users_roles.sql: owner > admin > member > viewer
 */
const changeRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
});

type ChangeRoleRequest = z.infer<typeof changeRoleSchema>;

/**
 * Helper function to check if user can modify another user's role
 * Owner can modify anyone (except self). Admin can modify member/viewer only.
 */
function canModifyUserRole(actorRole: string, targetRole: string, isSameUser: boolean): boolean {
  if (isSameUser) {
    return false; // Users can't modify their own role
  }

  if (actorRole === 'owner') {
    return true; // Owners can modify anyone
  }

  if (actorRole === 'admin') {
    // Admins can't promote/demote owners or other admins
    return ['member', 'viewer'].includes(targetRole);
  }

  return false; // Only admins and owners can modify roles
}

/**
 * Helper function to create audit log entry
 */
async function createAuditLog(
  supabase: any,
  companyId: string,
  userId: string,
  targetUserId: string,
  oldRole: string,
  newRole: string,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await supabase
      .from('audit_logs')
      .insert([
        {
          company_id: companyId,
          user_id: userId,
          action: 'ROLE_CHANGED',
          entity_type: 'user',
          entity_id: targetUserId,
          old_values: JSON.stringify({ role: oldRole }),
          new_values: JSON.stringify({ role: newRole }),
          ip_address: ipAddress || null,
          user_agent: userAgent || null,
        },
      ]);
  } catch (error) {
    console.error('Error creating audit log:', error);
  }
}

/**
 * PUT /api/admin/users/{id}/role
 *
 * Changes a user's role within the company
 * Requires admin role
 *
 * Request body:
 * {
 *   "role": "admin" | "supervisor" | "operador"
 * }
 *
 * Success Response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "user": {
 *       "id": "uuid",
 *       "email": "user@example.com",
 *       "fullName": "John Doe",
 *       "role": "supervisor",
 *       "status": "active",
 *       "updatedAt": "2026-08-12T10:00:00Z"
 *     }
 *   }
 * }
 *
 * Error Responses:
 * 400 - Bad request (invalid role)
 * 401 - Unauthorized (missing/invalid token)
 * 403 - Forbidden (insufficient permissions)
 * 404 - User not found
 * 500 - Internal server error
 */
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const targetUserId = params.id;

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

    const currentUserId = payload.sub;

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

    const validationResult = changeRoleSchema.safeParse(body);
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

    const { role: newRole } = validationResult.data;

    // Get Supabase client
    const supabase = createSupabaseServerClient();

    // Get current user info
    const { data: currentUserData, error: currentUserError } = await supabase
      .from('users')
      .select('id, company_id, role')
      .eq('id', currentUserId)
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

    // Check permissions
    if (!['owner', 'admin'].includes(currentUserData.role)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only admin or owner users can change user roles',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.FORBIDDEN }
      );
    }

    const companyId = currentUserData.company_id;

    // Get target user info
    const { data: targetUserData, error: targetUserError } = await supabase
      .from('users')
      .select('id, company_id, role, email, full_name, status')
      .eq('id', targetUserId)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .single();

    if (targetUserError || !targetUserData) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User not found',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.NOT_FOUND }
      );
    }

    // Check if user can modify target user
    const isSameUser = currentUserId === targetUserId;
    if (!canModifyUserRole(currentUserData.role, targetUserData.role, isSameUser)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: isSameUser
              ? 'You cannot modify your own role'
              : 'Insufficient permissions to modify this user role',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.FORBIDDEN }
      );
    }

    // Prevent demoting the last owner of the company
    if (targetUserData.role === 'owner' && newRole !== 'owner') {
      const { data: otherOwners, error: ownerError } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', companyId)
        .eq('role', 'owner')
        .neq('id', targetUserId)
        .is('deleted_at', null);

      if (ownerError || !otherOwners || otherOwners.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Cannot demote the last owner of the company',
              timestamp: new Date().toISOString(),
            },
          },
          { status: AUTH_STATUS_CODES.FORBIDDEN }
        );
      }
    }

    // Update user role
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        role: newRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId)
      .eq('company_id', companyId)
      .select('id, email, full_name, role, status, updated_at')
      .single();

    if (updateError) {
      console.error('Error updating user role:', updateError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update user role',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.INTERNAL_SERVER_ERROR }
      );
    }

    // Create audit log
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    const userAgent = request.headers.get('user-agent');
    await createAuditLog(
      supabase,
      companyId,
      currentUserId,
      targetUserId,
      targetUserData.role,
      newRole,
      ipAddress || undefined,
      userAgent || undefined
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            fullName: updatedUser.full_name,
            role: updatedUser.role,
            status: updatedUser.status,
            updatedAt: updatedUser.updated_at,
          },
        },
      },
      { status: AUTH_STATUS_CODES.OK }
    );
  } catch (error) {
    console.error('Change role endpoint error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while changing user role',
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
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  return NextResponse.json({}, { headers, status: 200 });
}
