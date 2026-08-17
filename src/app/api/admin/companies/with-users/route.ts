import { NextRequest, NextResponse } from 'next/server';
import { withMasterAuth, formatErrorResponse, formatSuccessResponse } from '@/lib/admin/auth';
import { companyOperations } from '@/lib/admin/database';
import { createCompanyWithUsersSchema, ADMIN_STATUS_CODES } from '@/types/admin';

/**
 * POST /api/admin/companies/with-users
 *
 * Create a new company with initial users in one atomic operation
 * Only accessible to master/admin users
 *
 * Request body:
 * {
 *   "name": "Company Name",
 *   "slug": "company-slug",
 *   "cnpj": "12.345.678/0001-90",
 *   "description": "Company description",
 *   "plan": "starter",
 *   "users": [
 *     {
 *       "email": "user1@example.com",
 *       "fullName": "User One",
 *       "role": "admin"
 *     },
 *     {
 *       "email": "user2@example.com",
 *       "fullName": "User Two",
 *       "role": "member"
 *     }
 *   ],
 *   "metadata": {}
 * }
 *
 * Success Response (201):
 * {
 *   "success": true,
 *   "data": {
 *     "company": {
 *       "id": "uuid",
 *       "name": "Company Name",
 *       "slug": "company-slug",
 *       "cnpj": "12.345.678/0001-90",
 *       "plan": "starter",
 *       "status": "active",
 *       "owner_id": "uuid",
 *       "created_at": "2026-08-17T10:00:00Z",
 *       "updated_at": "2026-08-17T10:00:00Z"
 *     },
 *     "users": [
 *       {
 *         "id": "uuid",
 *         "company_id": "uuid",
 *         "email": "user1@example.com",
 *         "full_name": "User One",
 *         "role": "admin",
 *         "status": "active",
 *         "created_at": "2026-08-17T10:00:00Z",
 *         "updated_at": "2026-08-17T10:00:00Z"
 *       }
 *     ]
 *   },
 *   "timestamp": "2026-08-17T10:00:00Z"
 * }
 *
 * Error Responses:
 * 400 - Invalid request (validation error)
 * 401 - Unauthorized (missing or invalid token)
 * 403 - Forbidden (not master/admin)
 * 409 - Conflict (slug already exists)
 * 500 - Internal server error
 */
async function handleCreateCompanyWithUsers(request: NextRequest, payload: any) {
  try {
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
    const validationResult = createCompanyWithUsersSchema.safeParse(body);

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

    const companyData = validationResult.data;

    // Create company with users (atomic operation)
    const result = await companyOperations.createWithUsers(payload.sub, companyData);

    if (!result.success) {
      if (result.code === 'SLUG_CONFLICT') {
        return formatErrorResponse(
          result.code,
          result.error || 'Company slug already exists',
          ADMIN_STATUS_CODES.CONFLICT
        );
      }

      return formatErrorResponse(
        result.code || 'COMPANY_CREATE_ERROR',
        result.error || 'Failed to create company with users',
        ADMIN_STATUS_CODES.INTERNAL_SERVER_ERROR
      );
    }

    return formatSuccessResponse(result.data, ADMIN_STATUS_CODES.CREATED);
  } catch (error) {
    console.error('Create company with users endpoint error:', error);

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

    return formatErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'An error occurred while creating the company with users',
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

export const POST = withMasterAuth(handleCreateCompanyWithUsers);

/**
 * OPTIONS handler for CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  const headers = {
    'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  return NextResponse.json({}, { headers, status: 200 });
}
