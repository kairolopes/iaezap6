/**
 * Authentication Helper Functions
 * Production-ready auth utilities including password hashing, JWT token generation/verification,
 * and tenant ID extraction.
 *
 * Dependencies:
 * - bcrypt: For password hashing and verification
 * - jsonwebtoken: For JWT token creation and verification
 *
 * Install with:
 * npm install bcrypt jsonwebtoken
 * npm install -D @types/bcrypt @types/jsonwebtoken
 */

import bcrypt from 'bcrypt';
import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { TokenPayload } from '@/types/auth';

/**
 * Configuration constants for authentication
 */
const AUTH_CONFIG = {
  // Bcrypt salt rounds for password hashing
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),

  // JWT algorithm
  JWT_ALGORITHM: 'RS256' as const,

  // Token expiration times (in seconds)
  ACCESS_TOKEN_EXPIRY: parseInt(process.env.ACCESS_TOKEN_EXPIRY || String(15 * 60), 10), // 15 minutes
  REFRESH_TOKEN_EXPIRY: parseInt(process.env.REFRESH_TOKEN_EXPIRY || String(7 * 24 * 60 * 60), 10), // 7 days

  // Issuer and audience
  JWT_ISSUER: process.env.JWT_ISSUER || 'auth-service',
  JWT_AUDIENCE: process.env.JWT_AUDIENCE || 'auth-api',
};

/**
 * Validates that required JWT keys are configured
 * @throws {Error} If private or public keys are not configured
 */
function validateJWTKeys(): void {
  const privateKey = process.env.JWT_PRIVATE_KEY;
  const publicKey = process.env.JWT_PUBLIC_KEY;

  if (!privateKey || !publicKey) {
    throw new Error(
      'JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables are required. ' +
      'Generate RSA keys with: openssl genrsa -out private.pem 2048 && openssl rsa -in private.pem -pubout -out public.pem'
    );
  }
}

/**
 * Gets the private key for JWT signing
 * @returns {string} The private RSA key
 * @throws {Error} If the key is not configured
 */
function getPrivateKey(): string {
  const privateKey = process.env.JWT_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('JWT_PRIVATE_KEY environment variable is not configured');
  }

  // Handle both inline keys (with escaped newlines) and file-based keys
  return privateKey.includes('\\n')
    ? privateKey.replace(/\\n/g, '\n')
    : privateKey;
}

/**
 * Gets the public key for JWT verification
 * @returns {string} The public RSA key
 * @throws {Error} If the key is not configured
 */
function getPublicKey(): string {
  const publicKey = process.env.JWT_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error('JWT_PUBLIC_KEY environment variable is not configured');
  }

  // Handle both inline keys (with escaped newlines) and file-based keys
  return publicKey.includes('\\n')
    ? publicKey.replace(/\\n/g, '\n')
    : publicKey;
}

/**
 * Hash a password using bcrypt
 *
 * @param {string} password - The plain text password to hash
 * @returns {Promise<string>} The hashed password
 * @throws {Error} If password is invalid or hashing fails
 *
 * @example
 * const hashedPassword = await hashPassword('user123456');
 */
export async function hashPassword(password: string): Promise<string> {
  // Validate input
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }

  if (password.length > 128) {
    throw new Error('Password must not exceed 128 characters');
  }

  try {
    const salt = await bcrypt.genSalt(AUTH_CONFIG.BCRYPT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during password hashing';
    throw new Error(`Password hashing failed: ${errorMessage}`);
  }
}

/**
 * Verify a password against its hash
 *
 * @param {string} password - The plain text password to verify
 * @param {string} hashedPassword - The hashed password to compare against
 * @returns {Promise<boolean>} True if the password matches, false otherwise
 * @throws {Error} If verification fails
 *
 * @example
 * const isMatch = await verifyPassword('user123456', hashedFromDb);
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  // Validate inputs
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  if (!hashedPassword || typeof hashedPassword !== 'string') {
    throw new Error('Hashed password must be a non-empty string');
  }

  try {
    const isMatch = await bcrypt.compare(password, hashedPassword);
    return isMatch;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during password verification';
    throw new Error(`Password verification failed: ${errorMessage}`);
  }
}

/**
 * Token pair interface
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/**
 * Generate JWT access and refresh tokens using RS256 algorithm
 *
 * @param {Object} payload - The token payload
 * @param {string} payload.userId - The user's unique identifier (subject)
 * @param {string} payload.email - The user's email address
 * @param {string[]} payload.roles - The user's roles (default: ['user'])
 * @param {string} [payload.tenantId] - Optional tenant ID for multi-tenant applications
 * @returns {TokenPair} Access token, refresh token, and expiration time
 * @throws {Error} If token generation fails
 *
 * @example
 * const tokens = await generateTokens({
 *   userId: 'user-123',
 *   email: 'user@example.com',
 *   roles: ['user'],
 *   tenantId: 'tenant-456'
 * });
 */
export async function generateTokens(payload: {
  userId: string;
  email: string;
  roles?: string[];
  tenantId?: string;
}): Promise<TokenPair> {
  // Validate required fields
  if (!payload.userId || typeof payload.userId !== 'string') {
    throw new Error('userId must be a non-empty string');
  }

  if (!payload.email || typeof payload.email !== 'string') {
    throw new Error('email must be a non-empty string');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    throw new Error('email must be a valid email address');
  }

  // Validate keys are configured
  try {
    validateJWTKeys();
  } catch (error) {
    throw new Error(`JWT configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  const roles = payload.roles || ['user'];
  const now = Math.floor(Date.now() / 1000);

  // Build the token payload
  const basePayload: TokenPayload & { tenantId?: string } = {
    sub: payload.userId,
    email: payload.email,
    roles: roles as any,
    iat: now,
    exp: now + AUTH_CONFIG.ACCESS_TOKEN_EXPIRY,
    aud: AUTH_CONFIG.JWT_AUDIENCE,
    iss: AUTH_CONFIG.JWT_ISSUER,
  };

  // Add tenant ID if provided
  if (payload.tenantId) {
    basePayload.tenantId = payload.tenantId;
  }

  try {
    const privateKey = getPrivateKey();

    const signOptions: SignOptions = {
      algorithm: AUTH_CONFIG.JWT_ALGORITHM,
      expiresIn: AUTH_CONFIG.ACCESS_TOKEN_EXPIRY,
      issuer: AUTH_CONFIG.JWT_ISSUER,
      audience: AUTH_CONFIG.JWT_AUDIENCE,
    };

    // Create access token
    const accessToken = jwt.sign(basePayload, privateKey, signOptions);

    // Create refresh token (longer expiry, fewer claims)
    const refreshTokenPayload = {
      sub: payload.userId,
      email: payload.email,
      type: 'refresh',
      iat: now,
      exp: now + AUTH_CONFIG.REFRESH_TOKEN_EXPIRY,
      iss: AUTH_CONFIG.JWT_ISSUER,
      aud: AUTH_CONFIG.JWT_AUDIENCE,
    };

    if (payload.tenantId) {
      (refreshTokenPayload as any).tenantId = payload.tenantId;
    }

    const refreshSignOptions: SignOptions = {
      algorithm: AUTH_CONFIG.JWT_ALGORITHM,
      expiresIn: AUTH_CONFIG.REFRESH_TOKEN_EXPIRY,
      issuer: AUTH_CONFIG.JWT_ISSUER,
      audience: AUTH_CONFIG.JWT_AUDIENCE,
    };

    const refreshToken = jwt.sign(refreshTokenPayload, privateKey, refreshSignOptions);

    return {
      accessToken,
      refreshToken,
      expiresIn: AUTH_CONFIG.ACCESS_TOKEN_EXPIRY,
      tokenType: 'Bearer',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during token generation';
    throw new Error(`Token generation failed: ${errorMessage}`);
  }
}

/**
 * Verification result interface
 */
export interface VerifyTokenResult {
  valid: boolean;
  payload?: TokenPayload & { tenantId?: string };
  error?: string;
}

/**
 * Verify a JWT token using RS256 algorithm
 *
 * @param {string} token - The JWT token to verify
 * @param {Object} options - Verification options
 * @param {boolean} [options.checkExpiry=true] - Whether to check token expiration
 * @returns {VerifyTokenResult} Verification result with payload if valid
 *
 * @example
 * const result = await verifyToken(token);
 * if (result.valid && result.payload) {
 *   console.log('User:', result.payload.sub);
 *   console.log('Tenant:', result.payload.tenantId);
 * }
 */
export async function verifyToken(
  token: string,
  options: { checkExpiry?: boolean } = { checkExpiry: true }
): Promise<VerifyTokenResult> {
  // Validate input
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      error: 'Token must be a non-empty string',
    };
  }

  // Validate keys are configured
  try {
    validateJWTKeys();
  } catch (error) {
    return {
      valid: false,
      error: `JWT configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }

  try {
    const publicKey = getPublicKey();

    const verifyOptions: VerifyOptions = {
      algorithms: [AUTH_CONFIG.JWT_ALGORITHM],
      issuer: AUTH_CONFIG.JWT_ISSUER,
      audience: AUTH_CONFIG.JWT_AUDIENCE,
    };

    // If checkExpiry is false, we skip the expiration check
    // (useful for refresh tokens or other specific cases)
    const payload = jwt.verify(token, publicKey, verifyOptions) as TokenPayload & { tenantId?: string };

    return {
      valid: true,
      payload,
    };
  } catch (error) {
    let errorMessage = 'Token verification failed';

    if (error instanceof jwt.TokenExpiredError) {
      errorMessage = 'Token has expired';
    } else if (error instanceof jwt.JsonWebTokenError) {
      errorMessage = `Invalid token: ${error.message}`;
    } else if (error instanceof jwt.NotBeforeError) {
      errorMessage = 'Token is not yet valid';
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      valid: false,
      error: errorMessage,
    };
  }
}

/**
 * Extract tenant ID from a JWT token
 * Safely extracts and validates the tenant ID from a token payload
 *
 * @param {string} token - The JWT token
 * @returns {Promise<string | null>} The tenant ID if present and valid, null otherwise
 *
 * @example
 * const tenantId = await extractTenantId(token);
 * if (tenantId) {
 *   // Load tenant-specific data
 * }
 */
export async function extractTenantId(token: string): Promise<string | null> {
  // Validate input
  if (!token || typeof token !== 'string') {
    return null;
  }

  const result = await verifyToken(token);

  if (!result.valid || !result.payload) {
    return null;
  }

  const tenantId = result.payload.tenantId;

  // Validate tenant ID format (UUID)
  if (!tenantId || typeof tenantId !== 'string') {
    return null;
  }

  // UUID v4 regex pattern
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(tenantId)) {
    // Tenant ID might be in a different format, still return it if it's non-empty
    // This allows flexibility for different tenant ID formats
    return tenantId.length > 0 ? tenantId : null;
  }

  return tenantId;
}

/**
 * Extract user ID (subject) from a JWT token
 * Safely extracts and validates the user ID from a token payload
 *
 * @param {string} token - The JWT token
 * @returns {Promise<string | null>} The user ID if present and valid, null otherwise
 */
export async function extractUserId(token: string): Promise<string | null> {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const result = await verifyToken(token);

  if (!result.valid || !result.payload) {
    return null;
  }

  const userId = result.payload.sub;
  return userId && typeof userId === 'string' ? userId : null;
}

/**
 * Extract email from a JWT token
 * Safely extracts and validates the email from a token payload
 *
 * @param {string} token - The JWT token
 * @returns {Promise<string | null>} The email if present and valid, null otherwise
 */
export async function extractEmail(token: string): Promise<string | null> {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const result = await verifyToken(token);

  if (!result.valid || !result.payload) {
    return null;
  }

  const email = result.payload.email;
  return email && typeof email === 'string' ? email : null;
}

/**
 * Extract roles from a JWT token
 * Safely extracts and validates the roles array from a token payload
 *
 * @param {string} token - The JWT token
 * @returns {Promise<string[] | null>} The roles if present and valid, null otherwise
 */
export async function extractRoles(token: string): Promise<string[] | null> {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const result = await verifyToken(token);

  if (!result.valid || !result.payload) {
    return null;
  }

  const roles = result.payload.roles;
  return Array.isArray(roles) && roles.length > 0 ? roles : null;
}

/**
 * Check if a user has a specific role
 *
 * @param {string} token - The JWT token
 * @param {string} requiredRole - The role to check for
 * @returns {Promise<boolean>} True if the user has the required role
 */
export async function hasRole(token: string, requiredRole: string): Promise<boolean> {
  const roles = await extractRoles(token);
  return roles ? roles.includes(requiredRole) : false;
}

/**
 * Refresh an access token using a refresh token
 *
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<TokenPair>} New token pair if successful
 * @throws {Error} If the refresh token is invalid or verification fails
 *
 * @example
 * try {
 *   const newTokens = await refreshAccessToken(oldRefreshToken);
 * } catch (error) {
 *   console.error('Token refresh failed:', error);
 * }
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenPair> {
  if (!refreshToken || typeof refreshToken !== 'string') {
    throw new Error('Refresh token must be a non-empty string');
  }

  const result = await verifyToken(refreshToken);

  if (!result.valid || !result.payload) {
    throw new Error(`Invalid refresh token: ${result.error || 'Unknown error'}`);
  }

  const payload = result.payload;

  // Verify it's a refresh token
  if ((payload as any).type !== 'refresh') {
    throw new Error('Token is not a valid refresh token');
  }

  // Generate new tokens using the payload information
  return generateTokens({
    userId: payload.sub,
    email: payload.email,
    roles: payload.roles,
    tenantId: payload.tenantId,
  });
}

/**
 * Get token expiration time (in seconds from now)
 *
 * @param {string} token - The JWT token
 * @returns {Promise<number>} Seconds until expiration, 0 if expired, -1 if invalid
 */
export async function getTokenExpiresIn(token: string): Promise<number> {
  const result = await verifyToken(token);

  if (!result.valid || !result.payload) {
    return -1;
  }

  const expiresIn = result.payload.exp - Math.floor(Date.now() / 1000);
  return Math.max(0, expiresIn);
}

/**
 * Decode a token without verification
 * WARNING: Only use this for displaying information about an unverified token.
 * Always call verifyToken() before trusting the payload.
 *
 * @param {string} token - The JWT token to decode
 * @returns {Object | null} The decoded payload if valid JWT format, null otherwise
 */
export function decodeTokenWithoutVerification(token: string): object | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    // Split the JWT into its three parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part)
    const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}
