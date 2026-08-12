import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  isTokenExpired,
} from '@/lib/auth/tokens';
import {
  storeTokenRotation,
  isTokenRevoked,
} from '@/lib/auth/supabase';
import { RefreshTokenRequest, AuthResponse, TokenResponse } from '@/lib/auth/types';

const ACCESS_TOKEN_EXPIRY = 3600; // 1 hour in seconds

export async function POST(request: NextRequest) {
  try {
    // Validate content type
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          error: 'Content-Type must be application/json',
          code: 'INVALID_CONTENT_TYPE',
        },
        { status: 400 }
      );
    }

    // Parse request body
    let body: RefreshTokenRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          error: 'Invalid JSON in request body',
          code: 'INVALID_JSON',
        },
        { status: 400 }
      );
    }

    // Validate refresh token presence
    const { refreshToken } = body;
    if (!refreshToken || typeof refreshToken !== 'string') {
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          error: 'Refresh token is required and must be a string',
          code: 'MISSING_REFRESH_TOKEN',
        },
        { status: 400 }
      );
    }

    // Verify and decode refresh token
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          error: 'Invalid refresh token',
          code: 'INVALID_REFRESH_TOKEN',
        },
        { status: 401 }
      );
    }

    // Check if token is expired
    if (isTokenExpired(payload)) {
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          error: 'Refresh token has expired',
          code: 'EXPIRED_REFRESH_TOKEN',
        },
        { status: 401 }
      );
    }

    const userId = payload.sub;

    // Check if the refresh token has been revoked
    const tokenHash = hashToken(refreshToken);
    const isRevoked = await isTokenRevoked(tokenHash);
    if (isRevoked) {
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          error: 'Refresh token has been revoked',
          code: 'REVOKED_REFRESH_TOKEN',
        },
        { status: 401 }
      );
    }

    // Generate new access token with same user info
    const newAccessToken = generateAccessToken(
      userId,
      payload.email,
      payload.role
    );

    // Token rotation: Generate new refresh token
    const newRefreshToken = generateRefreshToken(userId);

    // Store token rotation record in database
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7); // 7 days

    await storeTokenRotation(
      userId,
      tokenHash,
      hashToken(newRefreshToken),
      expirationDate
    );

    // Prepare response
    const tokenResponse: TokenResponse = {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY,
      tokenType: 'Bearer',
    };

    const response: AuthResponse<TokenResponse> = {
      success: true,
      data: tokenResponse,
    };

    // Return response with appropriate headers
    const httpResponse = NextResponse.json(response, { status: 200 });

    // Set secure headers
    httpResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    httpResponse.headers.set('Pragma', 'no-cache');
    httpResponse.headers.set('Expires', '0');

    return httpResponse;
  } catch (error) {
    console.error('Refresh token endpoint error:', error);

    return NextResponse.json<AuthResponse>(
      {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

// Optionally handle OPTIONS request for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
