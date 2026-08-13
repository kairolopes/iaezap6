/**
 * Test Utilities and Helpers
 *
 * Provides helper functions for integration tests including:
 * - API request utilities
 * - JWT decoding
 * - Test data generation
 * - Database cleanup
 */

/**
 * API Request Configuration
 */
export interface ApiRequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

/**
 * API Response
 */
export interface ApiResponse<T = any> {
  status: number;
  data: T;
  headers: Record<string, string>;
  ok: boolean;
}

/**
 * JWT Claims
 */
export interface JwtClaims {
  user_id: string;
  company_id: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  [key: string]: any;
}

/**
 * Test User Data
 */
export interface TestUser {
  email: string;
  password: string;
  companyId?: string;
  userId?: string;
}

/**
 * Test Company Data
 */
export interface TestCompany {
  cnpj: string;
  name: string;
  id?: string;
}

/**
 * Test Context - Stores test data and state
 */
export interface TestContext {
  users: Record<string, TestUser>;
  companies: Record<string, TestCompany>;
  tokens: Record<string, string>;
  createdAt: Date;
  timestamp: number;
}

/**
 * Initialize test context with timestamp-based unique identifiers
 */
export function createTestContext(): TestContext {
  return {
    users: {},
    companies: {},
    tokens: {},
    createdAt: new Date(),
    timestamp: Date.now(),
  };
}

/**
 * Make HTTP request to API
 * Handles JSON serialization, error responses, and retries
 */
export async function apiRequest<T = any>(
  method: string,
  endpoint: string,
  body?: any,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const baseUrl = process.env.TEST_API_URL || 'http://localhost:3000';
  const url = `${baseUrl}${endpoint}`;
  const timeout = options.timeout || 30000;
  const retries = options.retries || 0;

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt <= retries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      let data: T;

      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = (await response.text()) as any;
      }

      return {
        status: response.status,
        data,
        headers: Object.fromEntries(response.headers.entries()),
        ok: response.ok,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempt++;

      if (attempt <= retries) {
        await sleep(100 * attempt); // Exponential backoff
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url}`);
}

/**
 * Decode JWT token without verification
 * Use only for testing purposes
 */
export function decodeJwt(token: string): JwtClaims {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format: expected 3 parts');
    }

    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    throw new Error(`Failed to decode JWT: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string): string {
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new Error('Invalid Authorization header format: expected "Bearer <token>"');
  }
  return parts[1];
}

/**
 * Generate unique test email
 */
export function generateTestEmail(prefix: string, timestamp: number): string {
  return `${prefix}-${timestamp}@example.test`;
}

/**
 * Generate unique test CNPJ (14 digits)
 */
export function generateTestCnpj(baseNumber: number, timestamp: number): string {
  const unique = String(baseNumber + (timestamp % 10000)).padStart(14, '0');
  return unique.slice(0, 14);
}

/**
 * Generate unique company name
 */
export function generateCompanyName(prefix: string, timestamp: number): string {
  return `${prefix} - ${timestamp}`;
}

/**
 * Validate JWT token structure
 */
export function isValidJwt(token: string): boolean {
  try {
    const claims = decodeJwt(token);
    return (
      typeof claims === 'object' &&
      'iat' in claims &&
      'exp' in claims &&
      claims.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  try {
    const claims = decodeJwt(token);
    const nowSeconds = Math.floor(Date.now() / 1000);
    return claims.exp <= nowSeconds;
  } catch {
    return true;
  }
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const timeout = options.timeout || 5000;
  const interval = options.interval || 100;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await sleep(interval);
  }

  throw new Error('Timeout waiting for condition');
}

/**
 * Sleep for specified milliseconds
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a test user by calling registration endpoint
 */
export async function createTestUser(
  email: string,
  password: string,
  company: TestCompany
): Promise<{ userId: string; companyId: string; token: string }> {
  const response = await apiRequest<any>(
    'POST',
    '/api/auth/register',
    {
      email,
      password,
      company_cnpj: company.cnpj,
      company_name: company.name,
    }
  );

  if (response.status !== 201) {
    throw new Error(
      `Failed to create test user: ${response.status} ${JSON.stringify(response.data)}`
    );
  }

  return {
    userId: response.data.user.id,
    companyId: response.data.user.company_id,
    token: response.data.token.accessToken,
  };
}

/**
 * Login test user
 */
export async function loginTestUser(
  email: string,
  password: string
): Promise<{ userId: string; companyId: string; accessToken: string; refreshToken: string }> {
  const response = await apiRequest<any>(
    'POST',
    '/api/auth/login',
    { email, password }
  );

  if (response.status !== 200) {
    throw new Error(
      `Failed to login test user: ${response.status} ${JSON.stringify(response.data)}`
    );
  }

  return {
    userId: response.data.user.id,
    companyId: response.data.user.company_id,
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
  };
}

/**
 * Send webhook message
 */
export async function sendWebhookMessage(
  messageId: string,
  phone: string,
  senderPhone: string,
  senderName: string,
  text: string,
  instanceId: string
): Promise<ApiResponse<any>> {
  return apiRequest(
    'POST',
    '/api/webhooks/z-api/receive',
    {
      status: 'RECEIVED',
      messageId,
      phone,
      senderPhone,
      senderName,
      text,
      momment: Date.now(),
      instanceId,
    }
  );
}

/**
 * Assert API response status
 */
export function assertStatus(
  response: ApiResponse<any>,
  expectedStatus: number | number[],
  message?: string
): void {
  const expectedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      message ||
        `Expected status ${expectedStatuses.join(' or ')}, got ${response.status}: ${JSON.stringify(
          response.data
        )}`
    );
  }
}

/**
 * Assert response has error
 */
export function assertError(
  response: ApiResponse<any>,
  expectedCode?: string,
  message?: string
): void {
  if (response.ok || response.data.success !== false) {
    throw new Error(message || 'Expected error response');
  }

  if (expectedCode && response.data.error?.code !== expectedCode) {
    throw new Error(
      message || `Expected error code ${expectedCode}, got ${response.data.error?.code}`
    );
  }
}

/**
 * Assert response is success
 */
export function assertSuccess(
  response: ApiResponse<any>,
  message?: string
): void {
  if (!response.ok || response.data.success !== true) {
    throw new Error(message || `Expected success response: ${JSON.stringify(response.data)}`);
  }
}

/**
 * Create test data generator
 */
export class TestDataGenerator {
  timestamp: number;

  constructor(timestamp?: number) {
    this.timestamp = timestamp || Date.now();
  }

  email(prefix = 'test-user'): string {
    return generateTestEmail(prefix, this.timestamp);
  }

  cnpj(baseNumber = 11111111111111): string {
    return generateTestCnpj(baseNumber, this.timestamp);
  }

  companyName(prefix = 'Test Company'): string {
    return generateCompanyName(prefix, this.timestamp);
  }

  password(): string {
    return `TestPassword${this.timestamp % 1000}!@#`;
  }

  messageId(prefix = 'msg'): string {
    return `${prefix}-${this.timestamp}-${Math.random().toString(36).substr(2, 9)}`;
  }

  phone(): string {
    return `55819${String(this.timestamp % 99999999).padStart(8, '0')}`;
  }

  instanceId(prefix = 'instance'): string {
    return `${prefix}-${this.timestamp}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Mock response data generators
 */
export const mockResponses = {
  /**
   * Generate mock successful registration response
   */
  registrationSuccess: (overrides?: any) => ({
    success: true,
    user: {
      id: 'user-uuid-' + Date.now(),
      email: 'test@example.com',
      company_id: 'company-uuid-' + Date.now(),
      role: 'admin',
      created_at: new Date().toISOString(),
      ...overrides?.user,
    },
    token: {
      accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
      refreshToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
      expiresIn: 3600,
      tokenType: 'Bearer',
      ...overrides?.token,
    },
    ...overrides,
  }),

  /**
   * Generate mock successful login response
   */
  loginSuccess: (overrides?: any) => ({
    success: true,
    user: {
      id: 'user-uuid-' + Date.now(),
      email: 'test@example.com',
      company_id: 'company-uuid-' + Date.now(),
      role: 'admin',
      ...overrides?.user,
    },
    access_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
    refresh_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
    company_id: 'company-uuid-' + Date.now(),
    expires_in: 3600,
    token_type: 'Bearer',
    ...overrides,
  }),

  /**
   * Generate mock validation error response
   */
  validationError: (fieldErrors?: Record<string, string[]>, overrides?: any) => ({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: fieldErrors || { email: ['Invalid email format'] },
      timestamp: new Date().toISOString(),
      ...overrides?.error,
    },
    ...overrides,
  }),

  /**
   * Generate mock unauthorized error response
   */
  unauthorized: (overrides?: any) => ({
    success: false,
    error: {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
      timestamp: new Date().toISOString(),
      ...overrides?.error,
    },
    ...overrides,
  }),
};

/**
 * Test configuration
 */
export const testConfig = {
  baseUrl: process.env.TEST_API_URL || 'http://localhost:3000',
  timeout: 30000,
  retries: 0,
  verbose: process.env.TEST_VERBOSE === 'true',
};

/**
 * Logger for test debugging
 */
export class TestLogger {
  static debug(message: string, data?: any): void {
    if (testConfig.verbose) {
      console.log(`[TEST DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  static info(message: string, data?: any): void {
    console.log(`[TEST INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }

  static error(message: string, error?: any): void {
    console.error(`[TEST ERROR] ${message}`, error ? JSON.stringify(error, null, 2) : '');
  }

  static group(title: string): void {
    console.group(`[TEST] ${title}`);
  }

  static groupEnd(): void {
    console.groupEnd();
  }
}

export default {
  apiRequest,
  decodeJwt,
  extractBearerToken,
  generateTestEmail,
  generateTestCnpj,
  generateCompanyName,
  isValidJwt,
  isTokenExpired,
  waitFor,
  sleep,
  createTestUser,
  loginTestUser,
  sendWebhookMessage,
  assertStatus,
  assertError,
  assertSuccess,
  TestDataGenerator,
  TestLogger,
  mockResponses,
  testConfig,
  createTestContext,
};
