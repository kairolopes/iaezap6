import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JwtPayload } from './types';

const JWT_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-secret-key';
const ACCESS_TOKEN_EXPIRY = 3600; // 1 hour in seconds
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateAccessToken(
  userId: string,
  email?: string,
  role?: string
): string {
  const payload: JwtPayload = {
    sub: userId,
    iss: 'supabase',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRY,
    aud: 'authenticated',
    role: role || 'authenticated',
  };

  if (email) {
    payload.email = email;
  }

  return jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS256',
  });
}

export function generateRefreshToken(userId: string): string {
  const payload: JwtPayload = {
    sub: userId,
    iss: 'supabase',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + REFRESH_TOKEN_EXPIRY,
    aud: 'authenticated',
  };

  return jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS256',
  });
}

export function generateTokenPair(
  userId: string,
  email?: string,
  role?: string
): {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} {
  const accessToken = generateAccessToken(userId, email, role);
  const refreshToken = generateRefreshToken(userId);

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRY,
  };
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    }) as JwtPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

export function verifyAccessToken(token: string): JwtPayload | null {
  const payload = verifyToken(token);

  if (!payload) {
    return null;
  }

  // Verify token type
  if (payload.aud !== 'authenticated') {
    return null;
  }

  return payload;
}

export function verifyRefreshToken(token: string): JwtPayload | null {
  const payload = verifyToken(token);

  if (!payload) {
    return null;
  }

  // Refresh tokens should have 'authenticated' audience
  if (payload.aud !== 'authenticated') {
    return null;
  }

  return payload;
}

export function isTokenExpired(payload: JwtPayload): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp < nowSeconds;
}

export function getTokenExpiryTime(token: string): number | null {
  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.max(0, payload.exp - nowSeconds);
}

export function extractUserIdFromToken(token: string): string | null {
  const payload = verifyToken(token);
  return payload?.sub || null;
}
