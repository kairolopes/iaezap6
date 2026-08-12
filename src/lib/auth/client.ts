import { TokenResponse, AuthResponse } from './types';

/**
 * Client for interacting with the refresh token endpoint
 * Can be used in browser or Node.js environments
 */
export class RefreshTokenClient {
  private endpoint: string;
  private timeout: number;

  constructor(endpoint: string = '/api/auth/refresh', timeout: number = 10000) {
    this.endpoint = endpoint;
    this.timeout = timeout;
  }

  /**
   * Refresh the access token using a refresh token
   * @param refreshToken - The refresh token to use for obtaining a new access token
   * @returns TokenResponse containing new access and refresh tokens
   * @throws Error if the refresh fails
   */
  async refresh(refreshToken: string): Promise<TokenResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const json: AuthResponse<TokenResponse> = await response.json();

      if (!response.ok) {
        throw new RefreshTokenError(
          json.error || 'Unknown error',
          json.code || 'UNKNOWN_ERROR',
          response.status
        );
      }

      if (!json.success || !json.data) {
        throw new RefreshTokenError(
          'Invalid response format',
          'INVALID_RESPONSE',
          response.status
        );
      }

      return json.data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof RefreshTokenError) {
        throw error;
      }

      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new RefreshTokenError(
          'Network error: could not reach refresh endpoint',
          'NETWORK_ERROR',
          0
        );
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new RefreshTokenError(
          'Request timeout',
          'TIMEOUT',
          0
        );
      }

      throw new RefreshTokenError(
        error instanceof Error ? error.message : 'Unknown error',
        'UNKNOWN_ERROR',
        0
      );
    }
  }
}

/**
 * Custom error class for refresh token failures
 */
export class RefreshTokenError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'RefreshTokenError';
    Object.setPrototypeOf(this, RefreshTokenError.prototype);
  }

  /**
   * Check if this error is retryable
   */
  isRetryable(): boolean {
    return this.statusCode === 0 || this.statusCode >= 500;
  }

  /**
   * Check if this error indicates invalid/expired token (user needs to login again)
   */
  isAuthenticationError(): boolean {
    return ['INVALID_REFRESH_TOKEN', 'EXPIRED_REFRESH_TOKEN', 'REVOKED_REFRESH_TOKEN'].includes(
      this.code
    );
  }
}

/**
 * Utility class for managing token lifecycle with automatic refresh
 */
export class TokenManager {
  private client: RefreshTokenClient;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number | null = null;
  private refreshTimeout: NodeJS.Timeout | null = null;
  private refreshThreshold: number = 5 * 60 * 1000; // 5 minutes before expiry

  constructor(
    endpoint?: string,
    private onTokenRefresh?: (tokens: TokenResponse) => void,
    private onAuthError?: (error: RefreshTokenError) => void
  ) {
    this.client = new RefreshTokenClient(endpoint);
  }

  /**
   * Initialize the token manager with initial tokens
   */
  setTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiresAt = Date.now() + expiresIn * 1000;
    this.scheduleRefresh();
  }

  /**
   * Get the current access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Get the current refresh token
   */
  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  /**
   * Check if tokens are available
   */
  hasTokens(): boolean {
    return !!this.accessToken && !!this.refreshToken;
  }

  /**
   * Check if access token is about to expire
   */
  isExpiringSoon(): boolean {
    if (!this.expiresAt) return false;
    return Date.now() >= this.expiresAt - this.refreshThreshold;
  }

  /**
   * Manually refresh the access token
   * @throws RefreshTokenError if refresh fails
   */
  async refreshNow(): Promise<void> {
    if (!this.refreshToken) {
      throw new RefreshTokenError(
        'No refresh token available',
        'NO_REFRESH_TOKEN',
        0
      );
    }

    try {
      const tokens = await this.client.refresh(this.refreshToken);
      this.setTokens(tokens.accessToken, tokens.refreshToken, tokens.expiresIn);

      this.onTokenRefresh?.(tokens);
    } catch (error) {
      if (error instanceof RefreshTokenError && error.isAuthenticationError()) {
        this.onAuthError?.(error);
        this.clear();
      }
      throw error;
    }
  }

  /**
   * Clear all tokens
   */
  clear(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = null;
    this.cancelScheduledRefresh();
  }

  /**
   * Schedule automatic refresh before token expires
   */
  private scheduleRefresh(): void {
    this.cancelScheduledRefresh();

    if (!this.expiresAt) return;

    const timeUntilRefresh = this.expiresAt - Date.now() - this.refreshThreshold;

    if (timeUntilRefresh > 0) {
      this.refreshTimeout = setTimeout(() => {
        this.refreshNow().catch((error) => {
          console.error('Automatic token refresh failed:', error);
        });
      }, timeUntilRefresh);
    } else {
      // Token is already expiring soon, refresh immediately
      this.refreshNow().catch((error) => {
        console.error('Immediate token refresh failed:', error);
      });
    }
  }

  /**
   * Cancel scheduled refresh
   */
  private cancelScheduledRefresh(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }

  /**
   * Get a header object for API requests
   */
  getAuthHeader(): Record<string, string> {
    if (!this.accessToken) {
      return {};
    }
    return {
      Authorization: `Bearer ${this.accessToken}`,
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.cancelScheduledRefresh();
    this.clear();
  }
}

/**
 * Create a singleton instance for application-wide token management
 */
let tokenManagerInstance: TokenManager | null = null;

export function createTokenManager(
  onTokenRefresh?: (tokens: TokenResponse) => void,
  onAuthError?: (error: RefreshTokenError) => void
): TokenManager {
  if (!tokenManagerInstance) {
    tokenManagerInstance = new TokenManager(undefined, onTokenRefresh, onAuthError);
  }
  return tokenManagerInstance;
}

export function getTokenManager(): TokenManager | null {
  return tokenManagerInstance;
}

export function destroyTokenManager(): void {
  if (tokenManagerInstance) {
    tokenManagerInstance.destroy();
    tokenManagerInstance = null;
  }
}
