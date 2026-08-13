import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase';
import { verifyAccessToken } from '@/lib/auth/tokens';
import { AUTH_STATUS_CODES } from '@/types/auth';
import { extractTokenFromRequest } from '@/lib/auth/middleware';

/**
 * Validation schema for user update requests
 */
const updateUserSchema = z.object({
  role: z.enum(['owner', 'admin', 'member', 'viewer']).optional(),
  status: z.enum(['active', 'inactive', 'invited', 'suspended']).optional(),
  fullName: z.string().max(255).optional(),
  displayName: z.string().max(100).optional(),
});

type UpdateUserRequest = z.infer<typeof updateUserSchema>;

/**
 * Validation schema for role change requests
 */
const changeRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
});

type ChangeRoleRequest = z.infer<typeof changeRoleSchema>;

/**
 * Helper function to check if user can modify another user
 * Owner can modify anyone, Admin can modify non-owners
 */
function canModifyUser(actorRole: string, targetRole: string, isSameUser: boolean): boolean {
  if (isSameUser) {
    return false; // Users can't modify themselves
  }

  if (actorRole === 'owner') {
    return true; // Owners can modify anyone
  }

  if (actorRole === 'admin') {
    // Admins can't modify owners
    return targetRole !== 'owner';
  }

  return false; // Only admins and owners can modify
}

/**
 * Helper function to create audit log entry
 */
async function createAuditLog(
  supabase: any,
  companyId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  oldValues?: any,
  newValues?: any,
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
          action,
          entity_type: entityType,
          entity_id: entityId,
          old_values: oldValues ? JSON.stringify(oldValues) : null,
          new_values: newValues ? JSON.stringify(newValues) : null,
          ip_address: ipAddress,
          user_agent: userAgent,
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
 * Requires admin or owner role
 *
 * Request body:
 * {
 *   "role": "admin" | "member" | "viewer"
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
 *       "role": "admin",
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
    const body = await request.json().catch(() => null);
    if (!body) {
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
    if (!['admin', 'owner'].includes(currentUserData.role)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only admin and owner users can change user roles',
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
    if (!canModifyUser(currentUserData.role, targetUserData.role, isSameUser)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: currentUserData.role === 'admin' && targetUserData.role === 'owner'
              ? 'Admins cannot modify owners'
              : isSameUser
              ? 'You cannot modify your own role'
              : 'Insufficient permissions to modify this user',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.FORBIDDEN }
      );
    }

    // Prevent demoting the last owner
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
      'ROLE_CHANGED',
      'user',
      targetUserId,
      { role: targetUserData.role },
      { role: newRole },
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
 * DELETE /api/admin/users/{id}
 *
 * Removes a user from the company (soft delete)
 * Requires admin or owner role
 *
 * Success Response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "message": "User removed from company",
 *     "userId": "uuid"
 *   }
 * }
 *
 * Error Responses:
 * 401 - Unauthorized (missing/invalid token)
 * 403 - Forbidden (insufficient permissions)
 * 404 - User not found
 * 500 - Internal server error
 */
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
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
    if (!['admin', 'owner'].includes(currentUserData.role)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only admin and owner users can remove users',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.FORBIDDEN }
      );
    }

    const companyId = currentUserData.company_id;

    // Check if trying to delete self
    if (currentUserId === targetUserId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You cannot remove yourself from the company',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.FORBIDDEN }
      );
    }

    // Get target user info
    const { data: targetUserData, error: targetUserError } = await supabase
      .from('users')
      .select('id, company_id, role, email, full_name')
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
    if (!canModifyUser(currentUserData.role, targetUserData.role, false)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: currentUserData.role === 'admin' && targetUserData.role === 'owner'
              ? 'Admins cannot remove owners'
              : 'Insufficient permissions to remove this user',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.FORBIDDEN }
      );
    }

    // Prevent removing the last owner
    if (targetUserData.role === 'owner') {
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
              message: 'Cannot remove the last owner of the company',
              timestamp: new Date().toISOString(),
            },
          },
          { status: AUTH_STATUS_CODES.FORBIDDEN }
        );
      }
    }

    // Soft delete the user
    const { error: deleteError } = await supabase
      .from('users')
      .update({
        deleted_at: new Date().toISOString(),
        status: 'inactive',
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId)
      .eq('company_id', companyId);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to remove user',
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
      'USER_DELETED',
      'user',
      targetUserId,
      {
        id: targetUserData.id,
        email: targetUserData.email,
        fullName: targetUserData.full_name,
        role: targetUserData.role,
      },
      null,
      ipAddress || undefined,
      userAgent || undefined
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          message: 'User removed from company',
          userId: targetUserId,
        },
      },
      { status: AUTH_STATUS_CODES.OK }
    );
  } catch (error) {
    console.error('Delete user endpoint error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while removing user',
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
    'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  return NextResponse.json({}, { headers, status: 200 });
}
