/**
 * JWT Token utilities
 * Handles token creation, validation, and refresh
 */

import { TokenPayload } from '@/types/auth';

/**
 * Extracts the payload from a JWT token (without validation)
 * For validation, use a JWT verification library like jsonwebtoken
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload as TokenPayload;
  } catch (err) {
    console.error('Failed to decode token:', err);
    return null;
  }
}

/**
 * Checks if a token is expired
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) {
    return true;
  }

  // Compare with current time (in seconds)
  const currentTime = Math.floor(Date.now() / 1000);
  return payload.exp < currentTime;
}

/**
 * Gets the remaining time until a token expires (in seconds)
 */
export function getTokenExpiresIn(token: string): number {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) {
    return 0;
  }

  const currentTime = Math.floor(Date.now() / 1000);
  const expiresIn = payload.exp - currentTime;
  return Math.max(0, expiresIn);
}

/**
 * Validates a token's structure and expiration
 */
export function validateToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const payload = decodeToken(token);
  if (!payload) {
    return false;
  }

  // Check if token is expired
  if (isTokenExpired(token)) {
    return false;
  }

  return true;
}

/**
 * Extracts user ID from token
 */
export function extractUserIdFromToken(token: string): string | null {
  const payload = decodeToken(token);
  return payload?.sub || null;
}

/**
 * Extracts email from token
 */
export function extractEmailFromToken(token: string): string | null {
  const payload = decodeToken(token);
  return payload?.email || null;
}

/**
 * Extracts roles from token
 */
export function extractRolesFromToken(token: string): string[] | null {
  const payload = decodeToken(token);
  return payload?.roles || null;
}
