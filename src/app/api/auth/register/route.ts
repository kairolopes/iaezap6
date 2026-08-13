import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { AUTH_STATUS_CODES, TOKEN_EXPIRATION } from '@/types/auth';
import { generateTokenPair } from '@/lib/jwt';
import { createSupabaseServerClient } from '@/lib/supabase';

/**
 * POST /api/auth/register
 *
 * Creates a new company (if needed) and registers a new user
 * Validates input, checks for existing company by CNPJ,
 * hashes password with bcrypt, and generates JWT tokens
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePass123!",
 *   "company_cnpj": "12345678901234",
 *   "company_name": "My Company"
 * }
 *
 * Success Response (201):
 * {
 *   "success": true,
 *   "user": {
 *     "id": "uuid",
 *     "email": "user@example.com",
 *     "company_id": "uuid",
 *     "role": "admin",
 *     "created_at": "2026-08-13T10:00:00Z"
 *   },
 *   "token": {
 *     "accessToken": "eyJhbGciOiJSUzI1NiIs...",
 *     "refreshToken": "eyJhbGciOiJSUzI1NiIs...",
 *     "expiresIn": 3600,
 *     "tokenType": "Bearer"
 *   }
 * }
 *
 * Error Responses:
 * 400 - Invalid request (validation error)
 * 409 - Company or user already exists
 * 500 - Internal server error
 */

/**
 * Validation schema for registration requests
 */
const registerSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  company_cnpj: z
    .string()
    .regex(/^\d{14}$/, 'CNPJ must be exactly 14 digits'),
  company_name: z
    .string()
    .min(3, 'Company name must be at least 3 characters')
    .max(255, 'Company name must not exceed 255 characters')
    .trim(),
});

type RegisterRequest = z.infer<typeof registerSchema>;

/**
 * Check if company exists by CNPJ
 */
async function getCompanyByCNPJ(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  cnpj: string
) {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('id, cnpj, name')
      .eq('cnpj', cnpj)
      .eq('deleted_at', null)
      .single();

    if (error) {
      // No company found (expected error for single() when no match)
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error checking company by CNPJ:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Unexpected error checking company:', err);
    return null;
  }
}

/**
 * Create a new company
 */
async function createCompany(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  cnpj: string,
  name: string
) {
  try {
    const { data, error } = await supabase
      .from('companies')
      .insert([
        {
          cnpj,
          name,
          status: 'active',
          created_at: new Date().toISOString(),
        },
      ])
      .select('id, cnpj, name, created_at')
      .single();

    if (error) {
      console.error('Error creating company:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Unexpected error creating company:', err);
    return null;
  }
}

/**
 * Check if user already exists by email
 */
async function getUserByEmail(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  email: string
) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .eq('deleted_at', null)
      .single();

    if (error) {
      // No user found (expected error for single() when no match)
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error checking user by email:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Unexpected error checking user:', err);
    return null;
  }
}

/**
 * Create a new user in the users table
 */
async function createUser(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  email: string,
  hashedPassword: string,
  companyId: string
) {
  try {
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          email: email.toLowerCase(),
          password_hash: hashedPassword,
          company_id: companyId,
          role: 'admin', // First user is admin
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select('id, email, company_id, role, created_at')
      .single();

    if (error) {
      console.error('Error creating user:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Unexpected error creating user:', err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
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

    // Validate request using Zod schema
    const validationResult = registerSchema.safeParse(body);

    if (!validationResult.success) {
      const fieldErrors = validationResult.error.flatten().fieldErrors;
      const errorMessage = Object.entries(fieldErrors)
        .map(([field, errors]) => `${field}: ${errors?.join(', ')}`)
        .join('; ');

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

    const { email, password, company_cnpj, company_name } = validationResult.data;

    // Initialize Supabase client with service role key
    const supabase = createSupabaseServerClient();

    // Step 1: Check if user already exists
    const existingUser = await getUserByEmail(supabase, email);
    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_ALREADY_EXISTS',
            message: 'An account with this email already exists',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.CONFLICT }
      );
    }

    // Step 2: Check if company exists by CNPJ, or create new one
    let company = await getCompanyByCNPJ(supabase, company_cnpj);

    if (!company) {
      // Company doesn't exist, create it
      company = await createCompany(supabase, company_cnpj, company_name);

      if (!company) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'COMPANY_CREATION_FAILED',
              message: 'Failed to create company',
              timestamp: new Date().toISOString(),
            },
          },
          { status: AUTH_STATUS_CODES.INTERNAL_SERVER_ERROR }
        );
      }
    }

    // Step 3: Hash password with bcrypt (10 salt rounds)
    let hashedPassword: string;
    try {
      hashedPassword = await bcrypt.hash(password, 10);
    } catch (err) {
      console.error('Error hashing password:', err);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PASSWORD_HASH_ERROR',
            message: 'Failed to process password',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.INTERNAL_SERVER_ERROR }
      );
    }

    // Step 4: Create user with company_id
    const user = await createUser(supabase, email, hashedPassword, company.id);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_CREATION_FAILED',
            message: 'Failed to create user account',
            timestamp: new Date().toISOString(),
          },
        },
        { status: AUTH_STATUS_CODES.INTERNAL_SERVER_ERROR }
      );
    }

    // Step 5: Generate JWT tokens
    const tokenPair = generateTokenPair(
      user.id,
      user.company_id,
      user.email,
      user.role
    );

    // Prepare response
    const response = {
      success: true as const,
      user: {
        id: user.id,
        email: user.email,
        company_id: user.company_id,
        role: user.role,
        created_at: user.created_at,
      },
      token: tokenPair,
    };

    // Create response with cookies
    const jsonResponse = NextResponse.json(response, {
      status: AUTH_STATUS_CODES.CREATED,
    });

    // Set refresh token in HTTP-only cookie
    if (tokenPair.refreshToken) {
      jsonResponse.cookies.set({
        name: 'refresh_token',
        value: tokenPair.refreshToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: TOKEN_EXPIRATION.REFRESH,
        path: '/',
      });
    }

    // Set access token in non-HTTP-only cookie for client access
    if (tokenPair.accessToken) {
      jsonResponse.cookies.set({
        name: 'access_token',
        value: tokenPair.accessToken,
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: tokenPair.expiresIn,
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  return NextResponse.json({}, { headers, status: 200 });
}
