export interface JwtPayload {
  sub: string; // User ID
  iss: string; // Issuer (should be 'supabase')
  iat: number; // Issued at
  exp: number; // Expiration time
  aud: string; // Audience
  role?: string; // User role
  email?: string; // User email
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface TokenRotationRecord {
  id: string;
  userId: string;
  oldRefreshTokenHash: string;
  newRefreshTokenHash: string;
  createdAt: string;
  expiresAt: string;
}

export interface AuthResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}
