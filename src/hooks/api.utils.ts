/**
 * API Utility Functions for Admin Hooks
 * Provides common request handling, error parsing, and response validation
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
  };
  timestamp?: string;
}

export interface RequestOptions extends RequestInit {
  queryParams?: Record<string, string | number | boolean>;
}

/**
 * Builds query string from parameter object
 */
export function buildQueryString(params?: Record<string, string | number | boolean>): string {
  if (!params || Object.keys(params).length === 0) {
    return '';
  }

  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      queryParams.append(key, String(value));
    }
  });

  const queryString = queryParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Makes an API request with error handling and response parsing
 */
export async function apiRequest<T>(
  url: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { queryParams, ...fetchOptions } = options;

  // Build full URL with query parameters
  const fullUrl = `${url}${buildQueryString(queryParams)}`;

  // Set default headers
  const headers = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  try {
    const response = await fetch(fullUrl, {
      ...fetchOptions,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: {
          code: data.error?.code || 'UNKNOWN_ERROR',
          message: data.error?.message || `HTTP ${response.status}`,
          details: data.error?.details,
          timestamp: data.error?.timestamp || new Date().toISOString(),
        },
      };
    }

    return data as ApiResponse<T>;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

/**
 * GET request helper
 */
export async function apiGet<T>(url: string, options?: Omit<RequestOptions, 'method'>) {
  return apiRequest<T>(url, {
    ...options,
    method: 'GET',
  });
}

/**
 * POST request helper
 */
export async function apiPost<T>(url: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>) {
  return apiRequest<T>(url, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUT request helper
 */
export async function apiPut<T>(url: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>) {
  return apiRequest<T>(url, {
    ...options,
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE request helper
 */
export async function apiDelete<T>(url: string, options?: Omit<RequestOptions, 'method'>) {
  return apiRequest<T>(url, {
    ...options,
    method: 'DELETE',
  });
}

/**
 * Parses validation errors from API response
 */
export function parseValidationErrors(
  details?: Record<string, unknown>
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!details) {
    return errors;
  }

  Object.entries(details).forEach(([field, value]) => {
    if (Array.isArray(value)) {
      errors[field] = value.join(', ');
    } else if (typeof value === 'string') {
      errors[field] = value;
    } else {
      errors[field] = String(value);
    }
  });

  return errors;
}

/**
 * Formats error message with optional details
 */
export function formatErrorMessage(
  baseMessage: string,
  details?: Record<string, unknown>
): string {
  if (!details || Object.keys(details).length === 0) {
    return baseMessage;
  }

  const detailsText = Object.entries(details)
    .map(([key, value]) => {
      const val = Array.isArray(value) ? value.join(', ') : String(value);
      return `${key}: ${val}`;
    })
    .join('; ');

  return `${baseMessage} - ${detailsText}`;
}

/**
 * Checks if response is a validation error
 */
export function isValidationError(response: ApiResponse<any>): boolean {
  return (
    !response.success &&
    response.error?.code === 'VALIDATION_ERROR' &&
    !!response.error?.details
  );
}

/**
 * Checks if response is an authorization error
 */
export function isAuthError(response: ApiResponse<any>): boolean {
  return (
    !response.success &&
    (response.error?.code === 'UNAUTHORIZED' || response.error?.code === 'FORBIDDEN')
  );
}

/**
 * Checks if response is a network error
 */
export function isNetworkError(response: ApiResponse<any>): boolean {
  return !response.success && response.error?.code === 'NETWORK_ERROR';
}

/**
 * Retries a failed request with exponential backoff
 */
export async function apiRequestWithRetry<T>(
  url: string,
  options: RequestOptions = {},
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<ApiResponse<T>> {
  let lastError: ApiResponse<T> | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await apiRequest<T>(url, options);

    if (response.success) {
      return response;
    }

    lastError = response;

    // Don't retry on validation or authorization errors
    if (isValidationError(response) || isAuthError(response)) {
      return response;
    }

    // Wait before retrying (exponential backoff)
    if (attempt < maxRetries - 1) {
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return lastError || {
    success: false,
    error: {
      code: 'MAX_RETRIES_EXCEEDED',
      message: 'Maximum retry attempts exceeded',
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Merges multiple errors into a single message
 */
export function mergeErrors(errors: string[]): string {
  return errors.filter(e => e && e.length > 0).join('\n');
}
