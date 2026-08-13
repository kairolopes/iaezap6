import { z } from 'zod';

/**
 * CNPJ Validation Schema
 * Brazilian business tax identification number
 * Format: XX.XXX.XXX/XXXX-XX
 */
export const cnpjSchema = z
  .string()
  .regex(
    /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/,
    'Invalid CNPJ format. Expected: XX.XXX.XXX/XXXX-XX'
  );

/**
 * Create Company Request Schema
 */
export const createCompanySchema = z.object({
  name: z
    .string()
    .min(2, 'Company name must be at least 2 characters')
    .max(255, 'Company name must not exceed 255 characters')
    .trim(),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(100, 'Slug must not exceed 100 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .trim(),
  cnpj: cnpjSchema,
  description: z
    .string()
    .max(1000, 'Description must not exceed 1000 characters')
    .trim()
    .optional(),
  plan: z
    .enum(['starter', 'professional', 'enterprise'])
    .default('starter'),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Add User to Company Request Schema
 */
export const addUserToCompanySchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(255, 'Full name must not exceed 255 characters')
    .trim()
    .optional(),
  role: z
    .enum(['admin', 'supervisor', 'operador'])
    .default('operador'),
});

/**
 * Company Response Schema
 */
export const companyResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  cnpj: z.string(),
  description: z.string().optional(),
  plan: z.enum(['starter', 'professional', 'enterprise']),
  status: z.enum(['active', 'paused', 'suspended', 'cancelled']),
  ownerId: z.string().uuid(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * User in Company Response Schema
 */
export const userInCompanyResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().optional(),
  displayName: z.string().optional(),
  role: z.enum(['admin', 'supervisor', 'operador']),
  status: z.enum(['active', 'inactive', 'invited', 'suspended']),
  emailVerified: z.boolean(),
  lastLoginAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * TypeScript type definitions extracted from Zod schemas
 */
export type CreateCompanyRequest = z.infer<typeof createCompanySchema>;
export type AddUserToCompanyRequest = z.infer<typeof addUserToCompanySchema>;
export type CompanyResponse = z.infer<typeof companyResponseSchema>;
export type UserInCompanyResponse = z.infer<typeof userInCompanyResponseSchema>;

/**
 * API Response types for admin endpoints
 */
export interface AdminApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface AdminApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
  };
}

export type AdminApiResponse<T> = AdminApiSuccessResponse<T> | AdminApiErrorResponse;

/**
 * Validation helper functions
 */
export const validateCreateCompanyRequest = (data: unknown) => {
  return createCompanySchema.safeParse(data);
};

export const validateAddUserToCompanyRequest = (data: unknown) => {
  return addUserToCompanySchema.safeParse(data);
};

export const validateCompanyResponse = (data: unknown) => {
  return companyResponseSchema.safeParse(data);
};

export const validateUserInCompanyResponse = (data: unknown) => {
  return userInCompanyResponseSchema.safeParse(data);
};

/**
 * HTTP Status codes for admin operations
 */
export const ADMIN_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;
