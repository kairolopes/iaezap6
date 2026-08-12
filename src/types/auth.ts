import { z } from 'zod';

/**
 * Validation schema for login requests
 * Ensures email format and password requirements are met
 */
export const loginRequestSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must not exceed 128 characters'),
  rememberMe: z.boolean().optional().default(false),
});

/**
 * Validation schema for registration requests
 * Includes email, password, and optional profile fields
 */
export const registerRequestSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  firstName: z
    .string({ required_error: 'First name is required' })
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must not exceed 50 characters')
    .trim(),
  lastName: z
    .string({ required_error: 'Last name is required' })
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must not exceed 50 characters')
    .trim(),
  acceptTerms: z
    .boolean({ required_error: 'You must accept terms and conditions' })
    .refine((val) => val === true, 'You must accept terms and conditions'),
});

/**
 * Validation schema for JWT token payloads
 * Contains user identification and token metadata
 */
export const tokenPayloadSchema = z.object({
  sub: z
    .string({ required_error: 'Subject (user ID) is required' })
    .uuid('Invalid user ID format'),
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email format'),
  roles: z
    .array(
      z.enum(['admin', 'moderator', 'user'], {
        errorMap: () => ({ message: 'Invalid role' }),
      })
    )
    .default(['user']),
  iat: z
    .number({ required_error: 'Issued at timestamp is required' })
    .int('Invalid timestamp'),
  exp: z
    .number({ required_error: 'Expiration timestamp is required' })
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
 * Returns tokens and user information
 */
export const authResponseSchema = z.object({
  success: z.literal(true),
  user: z.object({
    id: z.string().uuid('Invalid user ID'),
    email: z.string().email('Invalid email'),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    roles: z.array(z.enum(['admin', 'moderator', 'user'])).default(['user']),
    createdAt: z.string().datetime('Invalid datetime format'),
    updatedAt: z.string().datetime('Invalid datetime format'),
  }),
  tokens: z.object({
    accessToken: z
      .string({ required_error: 'Access token is required' })
      .min(1, 'Access token cannot be empty'),
    refreshToken: z
      .string({ required_error: 'Refresh token is required' })
      .min(1, 'Refresh token cannot be empty'),
    expiresIn: z
      .number({ required_error: 'Token expiration time is required' })
      .positive('Token expiration must be positive'),
    tokenType: z
      .enum(['Bearer'])
      .default('Bearer'),
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
      ],
      {
        errorMap: () => ({ message: 'Invalid error code' }),
      }
    ),
    message: z
      .string({ required_error: 'Error message is required' })
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
    .string({ required_error: 'Refresh token is required' })
    .min(1, 'Refresh token cannot be empty'),
});

/**
 * Validation schema for password reset requests
 */
export const resetPasswordSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
});

/**
 * Validation schema for password reset confirmation
 */
export const resetPasswordConfirmSchema = z.object({
  token: z
    .string({ required_error: 'Reset token is required' })
    .min(1, 'Reset token cannot be empty'),
  password: z
    .string({ required_error: 'New password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
});

/**
 * TypeScript type definitions extracted from Zod schemas
 * These are used for type checking throughout the application
 */

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type TokenPayload = z.infer<typeof tokenPayloadSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type AuthError = z.infer<typeof authErrorSchema>;
export type RefreshToken = z.infer<typeof refreshTokenSchema>;
export type ResetPassword = z.infer<typeof resetPasswordSchema>;
export type ResetPasswordConfirm = z.infer<typeof resetPasswordConfirmSchema>;

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
 * Validation helper functions
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
