import { z } from 'zod';

/**
 * ===========================
 * MULTI-TENANT TYPES (Core Domain Models)
 * ===========================
 * These interfaces represent the fundamental data structures
 * for the IAeZap multi-tenant system
 */

/**
 * Company type for multi-tenant system
 * Represents an organization/business using IAeZap
 */
export interface Company {
  id: string; // UUID
  cnpj: string; // Brazilian CNPJ (14 digits)
  name: string;
  createdAt: Date;
  updatedAt?: Date;
  isActive?: boolean;
}

/**
 * User type for multi-tenant system
 * Represents a user account associated with a company
 */
export interface User {
  id: string; // UUID
  email: string;
  role: UserRole;
  company_id: string; // UUID - links user to their company
  created_at: Date;
  updated_at?: Date;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  lastLoginAt?: Date;
}

/**
 * AuthToken type for multi-tenant system
 * Contains JWT tokens and associated user/company context
 */
export interface AuthToken {
  access_token: string;
  refresh_token: string;
  user: User;
  company_id: string; // Redundant with user.company_id for convenience
  expiresIn: number; // seconds
  tokenType: 'Bearer';
  issuedAt: Date;
}

/**
 * LoginResponse type
 * Returned after successful login
 */
export interface LoginResponse {
  success: true;
  data: {
    token: AuthToken;
    user: User;
  };
}

/**
 * RegisterResponse type
 * Returned after successful registration
 */
export interface RegisterResponse {
  success: true;
  data: {
    user: Omit<User, 'created_at' | 'updated_at'> & {
      created_at: string; // ISO string
    };
    token: AuthToken;
    company: Company;
  };
}

/**
 * ===========================
 * VALIDATION SCHEMAS (Zod)
 * ===========================
 * These schemas handle runtime validation of input data
 */

/**
 * Validation schema for Company
 */
export const companySchema = z.object({
  id: z.string().uuid('Invalid company ID'),
  cnpj: z
    .string()
    .regex(/^\d{14}$/, 'CNPJ must be 14 digits'),
  name: z
    .string()
    .min(3, 'Company name must be at least 3 characters')
    .max(255, 'Company name must not exceed 255 characters')
    .trim(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  isActive: z.boolean().optional().default(true),
});

/**
 * Validation schema for User
 */
export const userSchema = z.object({
  id: z.string().uuid('Invalid user ID'),
  email: z
    .string()
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  role: z.enum(['admin', 'moderator', 'user']),
  company_id: z.string().uuid('Invalid company ID'),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  lastLoginAt: z.coerce.date().optional(),
});

/**
 * Validation schema for AuthToken
 */
export const authTokenSchema = z.object({
  access_token: z
    .string()
    .min(1, 'Access token cannot be empty'),
  refresh_token: z
    .string()
    .min(1, 'Refresh token cannot be empty'),
  user: userSchema,
  company_id: z.string().uuid('Invalid company ID'),
  expiresIn: z
    .number()
    .positive('Expiration must be positive'),
  tokenType: z.enum(['Bearer']).default('Bearer'),
  issuedAt: z.coerce.date(),
});

/**
 * Validation schema for login requests
 * Ensures email format and password requirements are met
 */
export const loginRequestSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must not exceed 128 characters'),
  rememberMe: z.boolean().optional().default(false),
  company_id: z.string().uuid('Invalid company ID').optional(),
});

/**
 * Validation schema for registration requests
 * Includes email, password, company info, and profile fields
 * Supports both new company creation and joining existing company
 */
export const registerRequestSchema = z.object({
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
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must not exceed 50 characters')
    .trim(),
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must not exceed 50 characters')
    .trim(),
  // Multi-tenant fields
  companyName: z
    .string()
    .min(3, 'Company name must be at least 3 characters')
    .max(255, 'Company name must not exceed 255 characters')
    .trim(),
  cnpj: z
    .string()
    .regex(/^\d{14}$/, 'CNPJ must be 14 digits')
    .optional(),
  acceptTerms: z
    .boolean()
    .refine((val) => val === true, 'You must accept terms and conditions'),
});

/**
 * Validation schema for JWT token payloads
 * Contains user identification and token metadata
 */
export const tokenPayloadSchema = z.object({
  sub: z
    .string()
    .uuid('Invalid user ID format'),
  email: z
    .string()
    .email('Invalid email format'),
  roles: z
    .array(
      z.enum(['admin', 'moderator', 'user'])
    )
    .default(['user']),
  iat: z
    .number()
    .int('Invalid timestamp'),
  exp: z
    .number()
    .int('Invalid timestamp'),
  aud: z
    .string()
    .optional()
    .default('auth-api'),
  iss: z
    .string()
    .optional()
    .default('auth-service'),
});

/**
 * Validation schema for successful authentication responses
 * Returns tokens, user information, and company context
 */
export const authResponseSchema = z.object({
  success: z.literal(true),
  user: z.object({
    id: z.string().uuid('Invalid user ID'),
    email: z.string().email('Invalid email'),
    role: z.enum(['admin', 'moderator', 'user']),
    company_id: z.string().uuid('Invalid company ID'),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    created_at: z.string().datetime('Invalid datetime format'),
    updated_at: z.string().datetime('Invalid datetime format').optional(),
    isActive: z.boolean().optional(),
    lastLoginAt: z.string().datetime('Invalid datetime format').optional(),
  }),
  company: z.object({
    id: z.string().uuid('Invalid company ID'),
    cnpj: z.string().regex(/^\d{14}$/, 'Invalid CNPJ'),
    name: z.string(),
    createdAt: z.string().datetime('Invalid datetime format'),
  }).optional(),
  tokens: z.object({
    access_token: z
      .string()
      .min(1, 'Access token cannot be empty'),
    refresh_token: z
      .string()
      .min(1, 'Refresh token cannot be empty'),
    expiresIn: z
      .number()
      .positive('Token expiration must be positive'),
    tokenType: z
      .enum(['Bearer'])
      .default('Bearer'),
    issuedAt: z.string().datetime('Invalid datetime format'),
  }),
});

/**
 * Validation schema for authentication error responses
 * Standardized error format for API responses
 */
export const authErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.enum(
      [
        'INVALID_CREDENTIALS',
        'USER_NOT_FOUND',
        'USER_ALREADY_EXISTS',
        'INVALID_EMAIL',
        'WEAK_PASSWORD',
        'EMAIL_NOT_VERIFIED',
        'ACCOUNT_LOCKED',
        'TOKEN_EXPIRED',
        'INVALID_TOKEN',
        'UNAUTHORIZED',
        'FORBIDDEN',
        'INTERNAL_SERVER_ERROR',
        'RATE_LIMIT_EXCEEDED',
      ]
    ),
    message: z
      .string()
      .min(1, 'Error message cannot be empty'),
    details: z
      .record(z.string(), z.any())
      .optional(),
    timestamp: z
      .string()
      .datetime('Invalid datetime format')
      .optional(),
  }),
  statusCode: z
    .number()
    .int()
    .min(400, 'Status code must be 400 or higher')
    .max(599, 'Status code must be 599 or lower')
    .optional(),
});

/**
 * Validation schema for refresh token requests
 */
export const refreshTokenSchema = z.object({
  refreshToken: z
    .string()
    .min(1, 'Refresh token cannot be empty'),
});

/**
 * Validation schema for password reset requests
 */
export const resetPasswordSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
});

/**
 * Validation schema for password reset confirmation
 */
export const resetPasswordConfirmSchema = z.object({
  token: z
    .string()
    .min(1, 'Reset token cannot be empty'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
});

/**
 * ===========================
 * TYPE EXPORTS (Zod Inferred Types)
 * ===========================
 * These are automatically derived from Zod schemas
 */

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type TokenPayload = z.infer<typeof tokenPayloadSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type AuthError = z.infer<typeof authErrorSchema>;
export type RefreshToken = z.infer<typeof refreshTokenSchema>;
export type ResetPassword = z.infer<typeof resetPasswordSchema>;
export type ResetPasswordConfirm = z.infer<typeof resetPasswordConfirmSchema>;

// Multi-tenant types
export type CompanyType = z.infer<typeof companySchema>;
export type UserType = z.infer<typeof userSchema>;
export type AuthTokenType = z.infer<typeof authTokenSchema>;

/**
 * Combined response type for authentication endpoints
 * Can be either a successful response or an error
 */
export type AuthResponseData = AuthResponse | AuthError;

/**
 * User object type extracted from successful auth responses
 */
export type AuthUser = AuthResponse['user'];

/**
 * Token object type extracted from successful auth responses
 */
export type AuthTokens = AuthResponse['tokens'];

/**
 * Role type for authorization
 */
export type UserRole = 'admin' | 'moderator' | 'user';

/**
 * Error code type for error handling
 */
export type AuthErrorCode = z.infer<typeof authErrorSchema>['error']['code'];

/**
 * ===========================
 * VALIDATION HELPER FUNCTIONS
 * ===========================
 * Safe parsing functions for all types
 */

export const validateLoginRequest = (data: unknown) => {
  return loginRequestSchema.safeParse(data);
};

export const validateRegisterRequest = (data: unknown) => {
  return registerRequestSchema.safeParse(data);
};

export const validateTokenPayload = (data: unknown) => {
  return tokenPayloadSchema.safeParse(data);
};

export const validateAuthResponse = (data: unknown) => {
  return authResponseSchema.safeParse(data);
};

export const validateAuthError = (data: unknown) => {
  return authErrorSchema.safeParse(data);
};

export const validateRefreshToken = (data: unknown) => {
  return refreshTokenSchema.safeParse(data);
};

export const validateResetPassword = (data: unknown) => {
  return resetPasswordSchema.safeParse(data);
};

export const validateResetPasswordConfirm = (data: unknown) => {
  return resetPasswordConfirmSchema.safeParse(data);
};

// Multi-tenant validation helpers
export const validateCompany = (data: unknown) => {
  return companySchema.safeParse(data);
};

export const validateUser = (data: unknown) => {
  return userSchema.safeParse(data);
};

export const validateAuthToken = (data: unknown) => {
  return authTokenSchema.safeParse(data);
};

/**
 * Type guards for discriminating between response types
 */

export const isAuthResponse = (data: unknown): data is AuthResponse => {
  const result = authResponseSchema.safeParse(data);
  return result.success;
};

export const isAuthError = (data: unknown): data is AuthError => {
  const result = authErrorSchema.safeParse(data);
  return result.success;
};

/**
 * HTTP Status codes for auth operations
 */
export const AUTH_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/**
 * Default token expiration times (in seconds)
 */
export const TOKEN_EXPIRATION = {
  ACCESS: 15 * 60, // 15 minutes
  REFRESH: 7 * 24 * 60 * 60, // 7 days
  RESET_PASSWORD: 1 * 60 * 60, // 1 hour
} as const;

/**
 * ===========================
 * MULTI-TENANT UTILITIES
 * ===========================
 * Helper types and utilities for multi-tenant operations
 */

/**
 * Type guard to check if a value is a valid Company
 */
export const isCompany = (value: unknown): value is Company => {
  const result = companySchema.safeParse(value);
  return result.success;
};

/**
 * Type guard to check if a value is a valid User
 */
export const isUser = (value: unknown): value is User => {
  const result = userSchema.safeParse(value);
  return result.success;
};

/**
 * Type guard to check if a value is a valid AuthToken
 */
export const isAuthToken = (value: unknown): value is AuthToken => {
  const result = authTokenSchema.safeParse(value);
  return result.success;
};

/**
 * Utility type for pagination responses
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Utility type for API request/response context
 */
export interface RequestContext {
  userId: string;
  companyId: string;
  role: UserRole;
  timestamp: Date;
}

/**
 * Utility type for multi-tenant filter
 */
export interface TenantFilter {
  company_id: string;
  userId?: string;
}

/**
 * Create a user context from a User object
 */
export const createUserContext = (user: User): RequestContext => ({
  userId: user.id,
  companyId: user.company_id,
  role: user.role,
  timestamp: new Date(),
});

/**
 * Extract company_id from auth token
 */
export const getCompanyIdFromToken = (token: AuthToken): string => {
  return token.company_id;
};

/**
 * Extract user info from auth token
 */
export const getUserFromToken = (token: AuthToken): User => {
  return token.user;
};
