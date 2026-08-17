import { z } from 'zod';

/**
 * ===========================
 * COMPANY MANAGEMENT TYPES
 * ===========================
 * Comprehensive type definitions for company and user state management
 * Consistent with database schema and existing auth/admin types
 */

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

/**
 * Available user roles in the system
 * Hierarchy: owner > admin > member > viewer
 */
export const USER_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

/**
 * User account status
 */
export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  INVITED: 'invited',
  SUSPENDED: 'suspended',
} as const;

export type UserStatus = typeof USER_STATUS[keyof typeof USER_STATUS];

/**
 * Company subscription plans
 */
export const COMPANY_PLANS = {
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
} as const;

export type CompanyPlan = typeof COMPANY_PLANS[keyof typeof COMPANY_PLANS];

/**
 * Company operational status
 */
export const COMPANY_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  SUSPENDED: 'suspended',
  CANCELLED: 'cancelled',
} as const;

export type CompanyStatus = typeof COMPANY_STATUS[keyof typeof COMPANY_STATUS];

/**
 * Company management error codes
 */
export const COMPANY_ERROR_CODES = {
  INVALID_COMPANY: 'INVALID_COMPANY',
  COMPANY_NOT_FOUND: 'COMPANY_NOT_FOUND',
  COMPANY_ALREADY_EXISTS: 'COMPANY_ALREADY_EXISTS',
  INVALID_SLUG: 'INVALID_SLUG',
  INVALID_CNPJ: 'INVALID_CNPJ',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_IN_COMPANY: 'USER_ALREADY_IN_COMPANY',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_ROLE: 'INVALID_ROLE',
  CANNOT_REMOVE_LAST_OWNER: 'CANNOT_REMOVE_LAST_OWNER',
  CANNOT_DOWNGRADE_OWNER: 'CANNOT_DOWNGRADE_OWNER',
  PLAN_LIMIT_EXCEEDED: 'PLAN_LIMIT_EXCEEDED',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  INVALID_INPUT: 'INVALID_INPUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type CompanyErrorCode = typeof COMPANY_ERROR_CODES[keyof typeof COMPANY_ERROR_CODES];

// ============================================================================
// CORE ENTITY TYPES
// ============================================================================

/**
 * Company entity
 * Represents an organization in the multi-tenant system
 */
export interface Company {
  id: string; // UUID
  name: string;
  slug: string; // URL-friendly identifier
  cnpj?: string; // Brazilian CNPJ (optional, formatted XX.XXX.XXX/XXXX-XX)
  description?: string;
  plan: CompanyPlan;
  status: CompanyStatus;
  ownerId: string; // UUID - creator/owner user
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/**
 * User entity
 * Represents a user account within a company
 */
export interface User {
  id: string; // UUID
  email: string;
  fullName?: string;
  displayName?: string;
  avatarUrl?: string;
  role: UserRole;
  status: UserStatus;
  companyId: string; // UUID - tenant identifier
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  lastLoginAt?: Date;
  lastActivityAt?: Date;
  preferences?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/**
 * Company member relationship
 * Tracks user membership and role in company
 */
export interface CompanyMember {
  userId: string; // UUID
  companyId: string; // UUID
  role: UserRole;
  joinedAt: Date;
  invitedBy?: string; // UUID of inviting user
  inviteAcceptedAt?: Date;
}

/**
 * Audit log entry
 * Tracks all changes to companies and users
 */
export interface AuditLog {
  id: string; // UUID
  companyId: string; // UUID
  userId?: string; // UUID of user who made the change
  action: string;
  entityType: string;
  entityId?: string; // UUID of affected entity
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// ============================================================================
// REQUEST/INPUT TYPES
// ============================================================================

/**
 * Request payload for creating a company
 */
export interface CreateCompanyInput {
  name: string;
  slug: string;
  cnpj?: string;
  description?: string;
  plan?: CompanyPlan;
  metadata?: Record<string, unknown>;
}

/**
 * Request payload for updating a company
 */
export interface UpdateCompanyInput {
  name?: string;
  slug?: string;
  cnpj?: string;
  description?: string;
  plan?: CompanyPlan;
  status?: CompanyStatus;
  metadata?: Record<string, unknown>;
}

/**
 * Request payload for creating a user in a company
 */
export interface CreateUserInput {
  email: string;
  fullName?: string;
  displayName?: string;
  role?: UserRole;
  inviteEmail?: boolean; // Whether to send invitation email
}

/**
 * Request payload for updating a user
 */
export interface UpdateUserInput {
  fullName?: string;
  displayName?: string;
  avatarUrl?: string;
  role?: UserRole;
  status?: UserStatus;
  preferences?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Request payload for updating user role
 */
export interface UpdateUserRoleInput {
  role: UserRole;
}

/**
 * Request payload for inviting users in bulk
 */
export interface BulkInviteInput {
  users: Array<{
    email: string;
    fullName?: string;
    role?: UserRole;
  }>;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Detailed company response
 */
export interface CompanyResponse {
  id: string;
  name: string;
  slug: string;
  cnpj?: string;
  description?: string;
  plan: CompanyPlan;
  status: CompanyStatus;
  ownerId: string;
  metadata?: Record<string, unknown>;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  memberCount?: number;
}

/**
 * User response within company context
 */
export interface UserResponse {
  id: string;
  email: string;
  fullName?: string;
  displayName?: string;
  avatarUrl?: string;
  role: UserRole;
  status: UserStatus;
  companyId: string;
  emailVerified: boolean;
  lastLoginAt?: string; // ISO string
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

/**
 * Company member response with metadata
 */
export interface CompanyMemberResponse {
  user: UserResponse;
  role: UserRole;
  joinedAt: string; // ISO string
  invitedBy?: string;
  inviteAcceptedAt?: string; // ISO string
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Company management error details
 */
export interface CompanyError {
  code: CompanyErrorCode;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
  timestamp: string; // ISO string
}

/**
 * Error response wrapper
 */
export interface ErrorResponse {
  success: false;
  error: CompanyError;
}

/**
 * Success response wrapper
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string; // ISO string
}

/**
 * Generic API response type
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  timestamp: string;
}

// ============================================================================
// STATE MANAGEMENT TYPES
// ============================================================================

/**
 * Company state in state management
 */
export interface CompanyState {
  current?: Company;
  list: Company[];
  loading: boolean;
  error: CompanyError | null;
  lastUpdated?: Date;
}

/**
 * User state in state management
 */
export interface UserState {
  byId: Record<string, User>;
  allIds: string[];
  currentCompanyUsers: string[]; // User IDs in current company
  loading: boolean;
  error: CompanyError | null;
  lastUpdated?: Date;
}

/**
 * Company members state
 */
export interface CompanyMembersState {
  byCompanyId: Record<string, CompanyMember[]>;
  loading: boolean;
  error: CompanyError | null;
  lastUpdated?: Date;
}

/**
 * Combined company management state
 */
export interface CompanyManagementState {
  companies: CompanyState;
  users: UserState;
  members: CompanyMembersState;
  selectedCompanyId?: string;
}

// ============================================================================
// AUTHORIZATION/PERMISSION TYPES
// ============================================================================

/**
 * User context for authorization checks
 */
export interface CompanyContext {
  userId: string;
  companyId: string;
  userRole: UserRole;
  isCompanyOwner: boolean;
  isCompanyAdmin: boolean;
  timestamp: Date;
}

/**
 * Permission definition
 */
export interface Permission {
  action: string;
  resource: string;
  requiredRole?: UserRole;
  description: string;
}

/**
 * Role-based access control configuration
 */
export interface RBACConfig {
  roles: Record<UserRole, Permission[]>;
  roleHierarchy: Record<UserRole, UserRole[]>; // Permissions inherited from higher roles
}

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

/**
 * CNPJ validation schema
 * Format: XX.XXX.XXX/XXXX-XX (14 digits)
 */
export const cnpjSchema = z
  .string()
  .regex(
    /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/,
    'Invalid CNPJ format. Expected: XX.XXX.XXX/XXXX-XX'
  )
  .or(z.string().regex(/^\d{14}$/, 'Invalid CNPJ format. Expected: 14 digits'));

/**
 * Company slug validation
 */
export const slugSchema = z
  .string()
  .min(2, 'Slug must be at least 2 characters')
  .max(100, 'Slug must not exceed 100 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens');

/**
 * Create company validation schema
 */
export const createCompanySchema = z.object({
  name: z
    .string()
    .min(2, 'Company name must be at least 2 characters')
    .max(255, 'Company name must not exceed 255 characters')
    .trim(),
  slug: slugSchema,
  cnpj: cnpjSchema.optional(),
  description: z
    .string()
    .max(1000, 'Description must not exceed 1000 characters')
    .trim()
    .optional(),
  plan: z.enum(['starter', 'professional', 'enterprise']).default('starter'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Update company validation schema
 */
export const updateCompanySchema = z.object({
  name: z
    .string()
    .min(2, 'Company name must be at least 2 characters')
    .max(255, 'Company name must not exceed 255 characters')
    .trim()
    .optional(),
  slug: slugSchema.optional(),
  cnpj: cnpjSchema.optional(),
  description: z
    .string()
    .max(1000, 'Description must not exceed 1000 characters')
    .trim()
    .optional(),
  plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
  status: z.enum(['active', 'paused', 'suspended', 'cancelled']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Company response validation schema
 */
export const companyResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  cnpj: z.string().optional(),
  description: z.string().optional(),
  plan: z.enum(['starter', 'professional', 'enterprise']),
  status: z.enum(['active', 'paused', 'suspended', 'cancelled']),
  ownerId: z.string().uuid(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  memberCount: z.number().optional(),
});

/**
 * Create user validation schema
 */
export const createUserSchema = z.object({
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
  displayName: z
    .string()
    .max(100, 'Display name must not exceed 100 characters')
    .trim()
    .optional(),
  role: z
    .enum(['owner', 'admin', 'member', 'viewer'])
    .default('member'),
  inviteEmail: z.boolean().default(true).optional(),
});

/**
 * Update user validation schema
 */
export const updateUserSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(255, 'Full name must not exceed 255 characters')
    .trim()
    .optional(),
  displayName: z
    .string()
    .max(100, 'Display name must not exceed 100 characters')
    .trim()
    .optional(),
  avatarUrl: z.string().url('Invalid URL format').optional(),
  role: z
    .enum(['owner', 'admin', 'member', 'viewer'])
    .optional(),
  status: z
    .enum(['active', 'inactive', 'invited', 'suspended'])
    .optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Update user role validation schema
 */
export const updateUserRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
});

/**
 * User response validation schema
 */
export const userResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().optional(),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
  status: z.enum(['active', 'inactive', 'invited', 'suspended']),
  companyId: z.string().uuid(),
  emailVerified: z.boolean(),
  lastLoginAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Company error validation schema
 */
export const companyErrorSchema = z.object({
  code: z.enum([
    'INVALID_COMPANY',
    'COMPANY_NOT_FOUND',
    'COMPANY_ALREADY_EXISTS',
    'INVALID_SLUG',
    'INVALID_CNPJ',
    'INSUFFICIENT_PERMISSIONS',
    'USER_NOT_FOUND',
    'USER_ALREADY_IN_COMPANY',
    'INVALID_EMAIL',
    'INVALID_ROLE',
    'CANNOT_REMOVE_LAST_OWNER',
    'CANNOT_DOWNGRADE_OWNER',
    'PLAN_LIMIT_EXCEEDED',
    'INVALID_STATE_TRANSITION',
    'INVALID_INPUT',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  statusCode: z.number().int().min(400).max(599),
  timestamp: z.string().datetime(),
});

/**
 * Bulk invite validation schema
 */
export const bulkInviteSchema = z.object({
  users: z.array(
    z.object({
      email: z.string().email('Invalid email format'),
      fullName: z.string().optional(),
      role: z.enum(['owner', 'admin', 'member', 'viewer']).optional(),
    })
  ).min(1, 'At least one user must be invited'),
});

// ============================================================================
// INFERRED ZODA TYPES
// ============================================================================

export type CreateCompanyRequest = z.infer<typeof createCompanySchema>;
export type UpdateCompanyRequest = z.infer<typeof updateCompanySchema>;
export type CreateUserRequest = z.infer<typeof createUserSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserSchema>;
export type UpdateUserRoleRequest = z.infer<typeof updateUserRoleSchema>;
export type BulkInviteRequest = z.infer<typeof bulkInviteSchema>;

// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================

/**
 * Validate create company request
 */
export const validateCreateCompanyRequest = (data: unknown) => {
  return createCompanySchema.safeParse(data);
};

/**
 * Validate update company request
 */
export const validateUpdateCompanyRequest = (data: unknown) => {
  return updateCompanySchema.safeParse(data);
};

/**
 * Validate create user request
 */
export const validateCreateUserRequest = (data: unknown) => {
  return createUserSchema.safeParse(data);
};

/**
 * Validate update user request
 */
export const validateUpdateUserRequest = (data: unknown) => {
  return updateUserSchema.safeParse(data);
};

/**
 * Validate update user role request
 */
export const validateUpdateUserRoleRequest = (data: unknown) => {
  return updateUserRoleSchema.safeParse(data);
};

/**
 * Validate company response
 */
export const validateCompanyResponse = (data: unknown) => {
  return companyResponseSchema.safeParse(data);
};

/**
 * Validate user response
 */
export const validateUserResponse = (data: unknown) => {
  return userResponseSchema.safeParse(data);
};

/**
 * Validate bulk invite request
 */
export const validateBulkInvite = (data: unknown) => {
  return bulkInviteSchema.safeParse(data);
};

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if value is a valid Company
 */
export const isCompany = (value: unknown): value is Company => {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.slug === 'string' &&
    ['starter', 'professional', 'enterprise'].includes(obj.plan as string) &&
    ['active', 'paused', 'suspended', 'cancelled'].includes(obj.status as string)
  );
};

/**
 * Check if value is a valid User
 */
export const isUser = (value: unknown): value is User => {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.email === 'string' &&
    typeof obj.companyId === 'string' &&
    ['owner', 'admin', 'member', 'viewer'].includes(obj.role as string) &&
    ['active', 'inactive', 'invited', 'suspended'].includes(obj.status as string)
  );
};

/**
 * Check if user has role
 */
export const hasRole = (user: User, role: UserRole | UserRole[]): boolean => {
  const roles = Array.isArray(role) ? role : [role];
  return roles.includes(user.role);
};

/**
 * Check if user has minimum role level
 * Role hierarchy: owner > admin > member > viewer
 */
export const hasMinimumRole = (user: User, requiredRole: UserRole): boolean => {
  const roleHierarchy: Record<UserRole, number> = {
    owner: 4,
    admin: 3,
    member: 2,
    viewer: 1,
  };
  return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
};

// ============================================================================
// HTTP STATUS CODES
// ============================================================================

export const COMPANY_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ============================================================================
// ERROR FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a company error
 */
export const createCompanyError = (
  code: CompanyErrorCode,
  message: string,
  statusCode: number = 400,
  details?: Record<string, unknown>
): ErrorResponse => ({
  success: false,
  error: {
    code,
    message,
    details,
    statusCode,
    timestamp: new Date().toISOString(),
  },
});

/**
 * Create a success response
 */
export const createSuccessResponse = <T>(data: T): SuccessResponse<T> => ({
  success: true,
  data,
  timestamp: new Date().toISOString(),
});

/**
 * Create a paginated response
 */
export const createPaginatedResponse = <T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): PaginatedResponse<T> => {
  const totalPages = Math.ceil(total / limit);
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
    timestamp: new Date().toISOString(),
  };
};

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Type for query filters when fetching companies
 */
export interface CompanyFilters {
  status?: CompanyStatus;
  plan?: CompanyPlan;
  ownerId?: string;
  search?: string; // Search in name and slug
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Type for query filters when fetching users
 */
export interface UserFilters {
  status?: UserStatus;
  role?: UserRole;
  companyId?: string;
  search?: string; // Search in email and fullName
  emailVerified?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number; // 1-indexed, default: 1
  limit?: number; // default: 20, max: 100
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Query options combining filters and pagination
 */
export interface QueryOptions<F> extends PaginationOptions {
  filters?: F;
}
