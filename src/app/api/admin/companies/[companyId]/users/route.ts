import { NextRequest, NextResponse } from 'next/server';
import { withMasterAuth, formatErrorResponse, formatSuccessResponse } from '@/lib/admin/auth';
import { companyOperations, userOperations } from '@/lib/admin/database';
import { addUserToCompanySchema, ADMIN_STATUS_CODES } from '@/types/admin';

/**
 * POST /api/admin/companies/{companyId}/users
 *
 * Add a user to a company
 * Only accessible to master/admin users
 *
 * Route parameters:
 * - companyId: UUID of the company
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "fullName": "John Doe",
 *   "role": "member"
 * }
 *
 * Success Response (201):
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid",
 *     "company_id": "uuid",
 *     "email": "user@example.com",
 *     "full_name": "John Doe",
 *     "role": "member",
 *     "status": "active",
 *     "email_verified": false,
 *     "created_at": "2026-08-13T10:00:00Z",
 *     "updated_at": "2026-08-13T10:00:00Z"
 *   },
 *   "timestamp": "2026-08-13T10:00:00Z"
 * }
 *
 * Error Responses:
 * 400 - Invalid request (validation error)
 * 401 - Unauthorized (missing or invalid token)
 * 403 - Forbidden (not master/admin)
 * 404 - Company not found
 * 409 - Conflict (user already exists in company)
 * 500 - Internal server error
 */
async function handleAddUser(
  request: NextRequest,
  payload: any,
  { params }: { params: { companyId: string } }
) {
  try {
    const companyId = params.companyId;

    // Validate companyId is a UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(companyId)) {
      return formatErrorResponse(
        'INVALID_COMPANY_ID',
        'Company ID must be a valid UUID',
        ADMIN_STATUS_CODES.BAD_REQUEST
      );
    }

    // Verify company exists
    const companyResult = await companyOperations.getById(companyId);
    if (!companyResult.success) {
      return formatErrorResponse(
        'COMPANY_NOT_FOUND',
        'Company not found',
        ADMIN_STATUS_CODES.NOT_FOUND
      );
    }

    // Parse request body
    const body = await request.json().catch(() => null);

    if (!body) {
      return formatErrorResponse(
        'INVALID_REQUEST',
        'Request body must be valid JSON',
        ADMIN_STATUS_CODES.BAD_REQUEST
      );
    }

    // Validate request using Zod schema
    const validationResult = addUserToCompanySchema.safeParse(body);

    if (!validationResult.success) {
      const fieldErrors = validationResult.error.flatten().fieldErrors;
      const details: Record<string, any> = {};

      for (const [field, errors] of Object.entries(fieldErrors)) {
        details[field] = errors?.join(', ');
      }

      return formatErrorResponse(
        'VALIDATION_ERROR',
        'Request validation failed',
        ADMIN_STATUS_CODES.BAD_REQUEST,
        details
      );
    }

    const userData = validationResult.data;

    // Add user to company
    const result = await userOperations.addToCompany(companyId, userData);

    if (!result.success) {
      if (result.code === 'USER_ALREADY_EXISTS') {
        return formatErrorResponse(
          result.code,
          result.error || 'User already exists in this company',
          ADMIN_STATUS_CODES.CONFLICT
        );
      }

      return formatErrorResponse(
        result.code || 'USER_ADD_ERROR',
        result.error || 'Failed to add user to company',
        ADMIN_STATUS_CODES.INTERNAL_SERVER_ERROR
      );
    }

    return formatSuccessResponse(result.data, ADMIN_STATUS_CODES.CREATED);
  } catch (error) {
    console.error('Add user endpoint error:', error);

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

    return formatErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'An error occurred while adding the user',
      ADMIN_STATUS_CODES.INTERNAL_SERVER_ERROR,
      process.env.NODE_ENV === 'development'
        ? {
            errorType: error instanceof Error ? error.constructor.name : 'Unknown',
            errorMessage,
          }
        : undefined
    );
  }
}

/**
 * GET /api/admin/companies/{companyId}/users
 *
 * List all users in a company with optional filters
 * Only accessible to master/admin users
 *
 * Route parameters:
 * - companyId: UUID of the company
 *
 * Query parameters:
 * - role: 'owner' | 'admin' | 'member' | 'viewer'
 * - status: 'active' | 'inactive' | 'invited' | 'suspended'
 * - limit: number (default: 10)
 * - offset: number (default: 0)
 *
 * Success Response (200):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "company_id": "uuid",
 *       "email": "user@example.com",
 *       "full_name": "John Doe",
 *       "role": "member",
 *       "status": "active",
 *       "email_verified": false,
 *       "last_login_at": null,
 *       "created_at": "2026-08-13T10:00:00Z",
 *       "updated_at": "2026-08-13T10:00:00Z"
 *     }
 *   ],
 *   "timestamp": "2026-08-13T10:00:00Z"
 * }
 *
 * Error Responses:
 * 401 - Unauthorized (missing or invalid token)
 * 403 - Forbidden (not master/admin)
 * 404 - Company not found
 * 500 - Internal server error
 */
async function handleListUsers(
  request: NextRequest,
  payload: any,
  { params }: { params: { companyId: string } }
) {
  try {
    const companyId = params.companyId;

    // Validate companyId is a UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(companyId)) {
      return formatErrorResponse(
        'INVALID_COMPANY_ID',
        'Company ID must be a valid UUID',
        ADMIN_STATUS_CODES.BAD_REQUEST
      );
    }

    // Verify company exists
    const companyResult = await companyOperations.getById(companyId);
    if (!companyResult.success) {
      return formatErrorResponse(
        'COMPANY_NOT_FOUND',
        'Company not found',
        ADMIN_STATUS_CODES.NOT_FOUND
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    const status = url.searchParams.get('status');
    const limit = url.searchParams.get('limit');
    const offset = url.searchParams.get('offset');

    const filters: any = {};

    if (role) {
      filters.role = role;
    }

    if (status) {
      filters.status = status;
    }

    if (limit) {
      filters.limit = Math.min(parseInt(limit, 10), 100); // Max 100 per page
    } else {
      filters.limit = 10;
    }

    if (offset) {
      filters.offset = Math.max(0, parseInt(offset, 10));
    }

    // Get company users
    const result = await userOperations.getCompanyUsers(companyId, filters);

    if (!result.success) {
      return formatErrorResponse(
        result.code || 'USER_FETCH_ERROR',
        result.error || 'Failed to fetch company users',
        ADMIN_STATUS_CODES.INTERNAL_SERVER_ERROR
      );
    }

    return formatSuccessResponse(result.data, ADMIN_STATUS_CODES.OK);
  } catch (error) {
    console.error('List users endpoint error:', error);

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

    return formatErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'An error occurred while fetching users',
      ADMIN_STATUS_CODES.INTERNAL_SERVER_ERROR,
      process.env.NODE_ENV === 'development'
        ? {
            errorType: error instanceof Error ? error.constructor.name : 'Unknown',
            errorMessage,
          }
        : undefined
    );
  }
}

/**
 * Wrapper for POST with master auth and params
 */
async function postWithAuth(request: NextRequest, context: any) {
  const { withMasterAuth } = await import('@/lib/admin/auth');

  return withMasterAuth(async (req, payload) => handleAddUser(req, payload, context))(
    request
  );
}

/**
 * Wrapper for GET with master auth and params
 */
async function getWithAuth(request: NextRequest, context: any) {
  const { withMasterAuth } = await import('@/lib/admin/auth');

  return withMasterAuth(async (req, payload) => handleListUsers(req, payload, context))(
    request
  );
}

export const POST = postWithAuth;
export const GET = getWithAuth;

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
