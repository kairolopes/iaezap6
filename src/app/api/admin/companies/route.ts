import { NextRequest, NextResponse } from 'next/server';
import { withMasterAuth, formatErrorResponse, formatSuccessResponse } from '@/lib/admin/auth';
import { companyOperations } from '@/lib/admin/database';
import { createCompanySchema, ADMIN_STATUS_CODES } from '@/types/admin';

/**
 * POST /api/admin/companies
 *
 * Create a new company with CNPJ
 * Only accessible to master/admin users
 *
 * Request body:
 * {
 *   "name": "Company Name",
 *   "slug": "company-slug",
 *   "cnpj": "12.345.678/0001-90",
 *   "description": "Company description",
 *   "plan": "starter",
 *   "metadata": {}
 * }
 *
 * Success Response (201):
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid",
 *     "name": "Company Name",
 *     "slug": "company-slug",
 *     "cnpj": "12.345.678/0001-90",
 *     "plan": "starter",
 *     "status": "active",
 *     "owner_id": "uuid",
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
 * 409 - Conflict (slug already exists)
 * 500 - Internal server error
 */
async function handleCreateCompany(request: NextRequest, payload: any) {
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
    const validationResult = createCompanySchema.safeParse(body);

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

    // Create company with current user as owner
    const result = await companyOperations.create(payload.sub, companyData);

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
        result.error || 'Failed to create company',
        ADMIN_STATUS_CODES.INTERNAL_SERVER_ERROR
      );
    }

    return formatSuccessResponse(result.data, ADMIN_STATUS_CODES.CREATED);
  } catch (error) {
    console.error('Create company endpoint error:', error);

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

    return formatErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'An error occurred while creating the company',
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
 * GET /api/admin/companies
 *
 * List all companies with optional filters
 * Only accessible to master/admin users
 *
 * Query parameters:
 * - status: 'active' | 'paused' | 'suspended' | 'cancelled'
 * - plan: 'starter' | 'professional' | 'enterprise'
 * - limit: number (default: 10)
 * - offset: number (default: 0)
 *
 * Success Response (200):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "name": "Company Name",
 *       "slug": "company-slug",
 *       "cnpj": "12.345.678/0001-90",
 *       "plan": "starter",
 *       "status": "active",
 *       "owner_id": "uuid",
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
 * 500 - Internal server error
 */
async function handleListCompanies(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const plan = url.searchParams.get('plan');
    const limit = url.searchParams.get('limit');
    const offset = url.searchParams.get('offset');

    const filters: any = {};

    if (status) {
      filters.status = status;
    }

    if (plan) {
      filters.plan = plan;
    }

    if (limit) {
      filters.limit = Math.min(parseInt(limit, 10), 100); // Max 100 per page
    } else {
      filters.limit = 10;
    }

    if (offset) {
      filters.offset = Math.max(0, parseInt(offset, 10));
    }

    const result = await companyOperations.getAll(filters);

    if (!result.success) {
      return formatErrorResponse(
        result.code || 'COMPANY_FETCH_ERROR',
        result.error || 'Failed to fetch companies',
        ADMIN_STATUS_CODES.INTERNAL_SERVER_ERROR
      );
    }

    return formatSuccessResponse(result.data, ADMIN_STATUS_CODES.OK);
  } catch (error) {
    console.error('List companies endpoint error:', error);

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

    return formatErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'An error occurred while fetching companies',
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
 * Main route handlers using master auth middleware
 */
export const GET = withMasterAuth(async (request: NextRequest) => {
  return handleListCompanies(request);
});

export const POST = withMasterAuth(handleCreateCompany);

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
