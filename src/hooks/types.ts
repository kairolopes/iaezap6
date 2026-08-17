/**
 * Type definitions for Admin Hooks
 * Re-exports and extends types from @/types/admin for use in hooks
 */

export type {
  CompanyResponse,
  CreateCompanyRequest,
  UserInCompanyResponse,
  AddUserToCompanyRequest,
  AdminApiResponse,
  AdminApiSuccessResponse,
  AdminApiErrorResponse,
  UserRole,
  UserStatus,
  CompanyPlan,
  CompanyStatus,
} from '@/types/admin';

/**
 * Hook state type definitions
 */

export interface BaseHookState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

export interface DataHookState<T> extends BaseHookState {
  data: T | null;
}

export interface ListHookState<T> extends BaseHookState {
  data: T[] | null;
  total: number | null;
  limit: number;
  offset: number;
}

export interface DeleteHookState extends BaseHookState {
  deletedId: string | null;
}

/**
 * Hook options type definitions
 */

export interface FetchOptions {
  signal?: AbortSignal;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface SearchOptions {
  search?: string;
}

export interface CompanyFilterOptions extends PaginationOptions {
  status?: 'active' | 'paused' | 'suspended' | 'cancelled';
  plan?: 'starter' | 'professional' | 'enterprise';
}

export interface UserFilterOptions extends PaginationOptions, SearchOptions {
  role?: 'owner' | 'admin' | 'member' | 'viewer';
  status?: 'active' | 'inactive' | 'invited' | 'suspended';
}

/**
 * Error types
 */

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface ValidationErrors {
  [fieldName: string]: string | string[];
}

/**
 * Response wrapper types
 */

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

export type ApiResponseWrapper<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Pagination response wrapper
 */

export interface PaginatedResponse<T> {
  users?: T[];
  data?: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Mutation result types
 */

export interface MutationResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  success: boolean;
}
