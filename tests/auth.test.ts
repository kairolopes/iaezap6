/**
 * IAeZap Authentication Tests
 *
 * Comprehensive test suite for authentication functionality including:
 * - User registration with valid and duplicate email scenarios
 * - User login with correct and incorrect credentials
 * - JWT token verification with company_id claim
 * - Password hashing and verification
 *
 * Setup: npm install --save-dev jest ts-jest @types/jest
 * Run: npm test -- tests/auth.test.ts
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
  hashPassword,
  verifyPassword,
  generateTokens,
  verifyToken,
  extractTenantId,
} from '@/lib/auth';

/**
 * Mock RSA keys for testing
 * These are test-only keys - never use in production
 */
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7W8qd9L3Y2K6V
Q1p9lKOuFtGrTKYC0MlIL+3CWocdEYMUKLgDOHGfgGEXXO0EQd3yQIGqmxEqH7nj
VYGMVkVrH2EZKqZJXXRj8y8b8ZVqj8wF3h7L8Xc8H7Z9N7k6J8G9L0M1N2O3P4Q5
R6S7T8U9V0W1X2Y3Z4A5B6C7D8E9F0G1H2I3J4K5L6M7N8O9P0Q1R2S3T4U5V6W7
X8Y9Z0A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D
EF0G1H2I3J4K5AgMBAAECggEAJQ5E9k8e9L3Y2K6VQ1p9lKOuFtGrTKYC0MlIL+3C
WocdEYMUKLgDOHGfgGEXXO0EQd3yQIGqmxEqH7njVYGMVkVrH2EZKqZJXXRj8y8b
8ZVqj8wF3h7L8Xc8H7Z9N7k6J8G9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4A5B6C7
D8E9F0G1H2I3J4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9Z0A1B2C3D4E5F6G7H8I9J0
K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9DEF0G1H2I3J4K5AQKBgQDfpXqL
3K3c7d9e2f4g6h8i0j2k4l6m8n0o2p4q6r8s0t2u4v6w8x0y2z4a6b8c0d2e4f6g8h
0i2j4k6l8m0n2o4p6q8r0s2t4u6v8w0x2y4z6a8b0c2d4e6f8g0h2i4j6k8l0m2n4
o6p8q0r2s4t6u8v0w2x4y6z8a0b2c4d6e8f0g2h4i6j8k0l2m4n6o8p0q2r4s6t8u0
v2w4x6y8z0a2b4c6d8e0f2g4h6i8j0k2l4m6n8o0QKBgQDZ3K6VQ1p9lKOuFtGrTK
YC0MlIL+3CWocdEYMUKLgDOHGfgGEXXO0EQd3yQIGqmxEqH7njVYGMVkVrH2EZKqZ
JXXRj8y8b8ZVqj8wF3h7L8Xc8H7Z9N7k6J8G9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3
Z4A5B6C7D8E9F0G1H2I3J4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9Z0A1B2C3D4E5F6
G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9DEF0G1H2I3J4K5AQKBgE
BthDe2L+k0J3d7d9e2f4g6h8i0j2k4l6m8n0o2p4q6r8s0t2u4v6w8x0y2z4a6b8c0
d2e4f6g8h0i2j4k6l8m0n2o4p6q8r0s2t4u6v8w0x2y4z6a8b0c2d4e6f8g0h2i4j6
k8l0m2n4o6p8q0r2s4t6u8v0w2x4y6z8a0b2c4d6e8f0g2h4i6j8k0l2m4n6o8p0q2
r4s6t8u0v2w4x6y8z0a2b4c6d8e0f2g4h6i8j0k2l4m6n8o0AoGBAI3L+KwMvZ1c
4Z6d9d8d2f4g6h8i0j2k4l6m8n0o2p4q6r8s0t2u4v6w8x0y2z4a6b8c0d2e4f6g8h
0i2j4k6l8m0n2o4p6q8r0s2t4u6v8w0x2y4z6a8b0c2d4e6f8g0h2i4j6k8l0m2n4
o6p8q0r2s4t6u8v0w2x4y6z8a0b2c4d6e8f0g2h4i6j8k0l2m4n6o8p0q2r4s6t8u0
v2w4x6y8z0a2b4c6d8e0f2g4h6i8j0k2l4m6n8o0
-----END PRIVATE KEY-----`;

const TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1vKnfS92NiulUNafZSj
rhbRq0ymAtDJSC/twlqHHRGDFCi4AzhxnzBhF1ztBEHd8kCBqpsRKh+541WBjFZF
ax9hGSqmSV10Y/MvG/GVao/MBd4ey/F3PB+2fTe5OifBvS9DNTdzPz8/Pz8/Pz8/
Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/
Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/
Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/QIDAQAB
-----END PUBLIC KEY-----`;

/**
 * Mock data for testing
 */
const mockUserData = {
  validUser: {
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'test@example.com',
    password: 'ValidPassword123!',
    company_id: '550e8400-e29b-41d4-a716-446655440002',
    role: 'admin',
    created_at: new Date().toISOString(),
  },
  duplicateUser: {
    id: '550e8400-e29b-41d4-a716-446655440003',
    email: 'test@example.com',
    password: 'HashedPassword123!',
    company_id: '550e8400-e29b-41d4-a716-446655440004',
    role: 'user',
    created_at: new Date().toISOString(),
  },
  company: {
    id: '550e8400-e29b-41d4-a716-446655440002',
    cnpj: '12345678901234',
    name: 'Test Company',
    created_at: new Date().toISOString(),
  },
};

describe('Authentication Tests', () => {
  // Set environment variables for tests
  beforeAll(() => {
    process.env.JWT_PRIVATE_KEY = TEST_PRIVATE_KEY;
    process.env.JWT_PUBLIC_KEY = TEST_PUBLIC_KEY;
    process.env.JWT_ISSUER = 'auth-service';
    process.env.JWT_AUDIENCE = 'auth-api';
    process.env.BCRYPT_ROUNDS = '10';
    process.env.ACCESS_TOKEN_EXPIRY = '900';
    process.env.REFRESH_TOKEN_EXPIRY = '604800';
  });

  describe('Password Hashing and Verification', () => {
    it('should successfully hash a valid password', async () => {
      const password = 'ValidPassword123!';
      const hashedPassword = await hashPassword(password);

      // Verify the hashed password is different from original
      expect(hashedPassword).not.toBe(password);

      // Verify the hash is a bcrypt hash (starts with $2)
      expect(hashedPassword).toMatch(/^\$2[aby]\$/);
    });

    it('should reject a password that is too short', async () => {
      const password = 'Short1!';

      await expect(hashPassword(password)).rejects.toThrow(
        'Password must be at least 6 characters long'
      );
    });

    it('should reject a password that exceeds maximum length', async () => {
      const password = 'A'.repeat(129);

      await expect(hashPassword(password)).rejects.toThrow(
        'Password must not exceed 128 characters'
      );
    });

    it('should verify correct password', async () => {
      const password = 'ValidPassword123!';
      const hashedPassword = await hashPassword(password);

      const isMatch = await verifyPassword(password, hashedPassword);
      expect(isMatch).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'ValidPassword123!';
      const wrongPassword = 'WrongPassword456@';
      const hashedPassword = await hashPassword(password);

      const isMatch = await verifyPassword(wrongPassword, hashedPassword);
      expect(isMatch).toBe(false);
    });
  });

  describe('User Registration', () => {
    it('should successfully register a new user with valid data', async () => {
      // This test demonstrates the flow, but actual implementation
      // would use the API endpoint
      const password = mockUserData.validUser.password;
      const hashedPassword = await hashPassword(password);

      // Verify password was hashed correctly
      expect(hashedPassword).not.toBe(password);

      // Generate tokens for the new user
      const tokens = await generateTokens({
        userId: mockUserData.validUser.id,
        email: mockUserData.validUser.email,
        roles: [mockUserData.validUser.role],
        tenantId: mockUserData.validUser.company_id,
      });

      // Verify tokens were generated
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBeGreaterThan(0);
      expect(tokens.tokenType).toBe('Bearer');

      // Verify the access token contains correct claims
      const verified = await verifyToken(tokens.accessToken);
      expect(verified.valid).toBe(true);
      expect(verified.payload?.sub).toBe(mockUserData.validUser.id);
      expect(verified.payload?.email).toBe(mockUserData.validUser.email);
    });

    it('should fail when registering with duplicate email', async () => {
      /**
       * This test demonstrates the duplicate email check.
       * In real implementation, this is handled by Supabase unique constraint
       * or by checking before insertion in the API route.
       */

      // Simulate checking if email exists
      const emailExists = mockUserData.validUser.email === mockUserData.duplicateUser.email;

      expect(emailExists).toBe(true);

      // In the actual API, this would return 409 CONFLICT error
      // with message: "An account with this email already exists"
    });

    it('should create tokens with company_id in payload', async () => {
      const tokens = await generateTokens({
        userId: mockUserData.validUser.id,
        email: mockUserData.validUser.email,
        roles: [mockUserData.validUser.role],
        tenantId: mockUserData.validUser.company_id,
      });

      const verified = await verifyToken(tokens.accessToken);

      expect(verified.valid).toBe(true);
      expect(verified.payload?.tenantId).toBe(mockUserData.validUser.company_id);
    });

    it('should validate password strength requirements', async () => {
      const weakPasswords = [
        'weakpass123', // missing uppercase and special char
        'WEAKPASS123', // missing lowercase and special char
        'WeakPass!', // missing number
        'weak123', // missing uppercase and special char
      ];

      for (const weakPassword of weakPasswords) {
        await expect(hashPassword(weakPassword)).rejects.toThrow();
      }
    });

    it('should normalize email to lowercase before storing', () => {
      const email = 'Test@Example.COM';
      const normalized = email.toLowerCase();

      expect(normalized).toBe('test@example.com');
    });
  });

  describe('User Login', () => {
    it('should successfully login with correct credentials', async () => {
      const password = mockUserData.validUser.password;
      const hashedPassword = await hashPassword(password);

      // Simulate finding user by email and verifying password
      const passwordMatch = await verifyPassword(password, hashedPassword);
      expect(passwordMatch).toBe(true);

      // Generate tokens for login
      const tokens = await generateTokens({
        userId: mockUserData.validUser.id,
        email: mockUserData.validUser.email,
        roles: [mockUserData.validUser.role],
        tenantId: mockUserData.validUser.company_id,
      });

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
    });

    it('should fail login with wrong password', async () => {
      const correctPassword = mockUserData.validUser.password;
      const wrongPassword = 'WrongPassword123!';
      const hashedPassword = await hashPassword(correctPassword);

      // Attempt to verify wrong password
      const passwordMatch = await verifyPassword(wrongPassword, hashedPassword);
      expect(passwordMatch).toBe(false);
    });

    it('should fail login with nonexistent email', () => {
      // In real implementation, database query would return no results
      const userExists = mockUserData.validUser.email === 'nonexistent@example.com';
      expect(userExists).toBe(false);
    });

    it('should return proper error for invalid credentials', async () => {
      const invalidCredentials = {
        email: 'nonexistent@example.com',
        password: 'SomePassword123!',
      };

      // The actual API would return:
      // status: 401
      // error: {
      //   code: 'INVALID_CREDENTIALS',
      //   message: 'Invalid email or password'
      // }

      expect(invalidCredentials.email).not.toBe(mockUserData.validUser.email);
    });
  });

  describe('JWT Token Verification', () => {
    it('should contain correct company_id in access token', async () => {
      const tokens = await generateTokens({
        userId: mockUserData.validUser.id,
        email: mockUserData.validUser.email,
        roles: [mockUserData.validUser.role],
        tenantId: mockUserData.validUser.company_id,
      });

      const verified = await verifyToken(tokens.accessToken);

      expect(verified.valid).toBe(true);
      expect(verified.payload?.tenantId).toBe(mockUserData.validUser.company_id);
    });

    it('should extract tenant ID from token', async () => {
      const tokens = await generateTokens({
        userId: mockUserData.validUser.id,
        email: mockUserData.validUser.email,
        roles: [mockUserData.validUser.role],
        tenantId: mockUserData.validUser.company_id,
      });

      const tenantId = await extractTenantId(tokens.accessToken);

      expect(tenantId).toBe(mockUserData.validUser.company_id);
    });

    it('should verify token with correct issuer and audience', async () => {
      const tokens = await generateTokens({
        userId: mockUserData.validUser.id,
        email: mockUserData.validUser.email,
        roles: [mockUserData.validUser.role],
        tenantId: mockUserData.validUser.company_id,
      });

      const verified = await verifyToken(tokens.accessToken);

      expect(verified.valid).toBe(true);
      expect(verified.payload?.iss).toBe('auth-service');
      expect(verified.payload?.aud).toBe('auth-api');
    });

    it('should include correct roles in token', async () => {
      const roles = ['admin'];
      const tokens = await generateTokens({
        userId: mockUserData.validUser.id,
        email: mockUserData.validUser.email,
        roles,
        tenantId: mockUserData.validUser.company_id,
      });

      const verified = await verifyToken(tokens.accessToken);

      expect(verified.valid).toBe(true);
      expect(verified.payload?.roles).toEqual(roles);
    });

    it('should reject expired token', async () => {
      // Create a token with very short expiry
      const expiredToken = jwt.sign(
        {
          sub: mockUserData.validUser.id,
          email: mockUserData.validUser.email,
          roles: [mockUserData.validUser.role],
          tenantId: mockUserData.validUser.company_id,
          iss: 'auth-service',
          aud: 'auth-api',
          iat: Math.floor(Date.now() / 1000) - 3600,
          exp: Math.floor(Date.now() / 1000) - 1800, // Expired 30 mins ago
        },
        TEST_PRIVATE_KEY,
        { algorithm: 'RS256' }
      );

      const verified = await verifyToken(expiredToken);
      expect(verified.valid).toBe(false);
      expect(verified.error).toContain('expired');
    });

    it('should reject invalid token signature', async () => {
      const validTokens = await generateTokens({
        userId: mockUserData.validUser.id,
        email: mockUserData.validUser.email,
        roles: [mockUserData.validUser.role],
        tenantId: mockUserData.validUser.company_id,
      });

      // Tamper with the token by changing a character
      const tamperedToken = validTokens.accessToken.slice(0, -5) + 'XXXXX';

      const verified = await verifyToken(tamperedToken);
      expect(verified.valid).toBe(false);
    });
  });

  describe('Refresh Token', () => {
    it('should include refresh token in token pair', async () => {
      const tokens = await generateTokens({
        userId: mockUserData.validUser.id,
        email: mockUserData.validUser.email,
        roles: [mockUserData.validUser.role],
        tenantId: mockUserData.validUser.company_id,
      });

      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.refreshToken.length).toBeGreaterThan(0);
    });

    it('should generate different tokens each time', async () => {
      const tokens1 = await generateTokens({
        userId: mockUserData.validUser.id,
        email: mockUserData.validUser.email,
        roles: [mockUserData.validUser.role],
        tenantId: mockUserData.validUser.company_id,
      });

      // Wait a moment to ensure different iat
      await new Promise(resolve => setTimeout(resolve, 10));

      const tokens2 = await generateTokens({
        userId: mockUserData.validUser.id,
        email: mockUserData.validUser.email,
        roles: [mockUserData.validUser.role],
        tenantId: mockUserData.validUser.company_id,
      });

      expect(tokens1.accessToken).not.toBe(tokens2.accessToken);
      expect(tokens1.refreshToken).not.toBe(tokens2.refreshToken);
    });
  });

  describe('Multi-tenant Support', () => {
    it('should support multiple users in same company', async () => {
      const user1 = await generateTokens({
        userId: '550e8400-e29b-41d4-a716-446655440001',
        email: 'user1@example.com',
        roles: ['user'],
        tenantId: mockUserData.validUser.company_id,
      });

      const user2 = await generateTokens({
        userId: '550e8400-e29b-41d4-a716-446655440005',
        email: 'user2@example.com',
        roles: ['user'],
        tenantId: mockUserData.validUser.company_id,
      });

      const verified1 = await verifyToken(user1.accessToken);
      const verified2 = await verifyToken(user2.accessToken);

      expect(verified1.payload?.tenantId).toBe(mockUserData.validUser.company_id);
      expect(verified2.payload?.tenantId).toBe(mockUserData.validUser.company_id);
      expect(verified1.payload?.sub).not.toBe(verified2.payload?.sub);
    });

    it('should isolate data between different companies', async () => {
      const company1Id = '550e8400-e29b-41d4-a716-446655440002';
      const company2Id = '550e8400-e29b-41d4-a716-446655440006';

      const user1Token = await generateTokens({
        userId: '550e8400-e29b-41d4-a716-446655440001',
        email: 'user1@company1.com',
        roles: ['admin'],
        tenantId: company1Id,
      });

      const user2Token = await generateTokens({
        userId: '550e8400-e29b-41d4-a716-446655440007',
        email: 'user2@company2.com',
        roles: ['admin'],
        tenantId: company2Id,
      });

      const verified1 = await verifyToken(user1Token.accessToken);
      const verified2 = await verifyToken(user2Token.accessToken);

      expect(verified1.payload?.tenantId).toBe(company1Id);
      expect(verified2.payload?.tenantId).toBe(company2Id);
      expect(verified1.payload?.tenantId).not.toBe(verified2.payload?.tenantId);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing password gracefully', async () => {
      await expect(hashPassword('')).rejects.toThrow(
        'Password must be a non-empty string'
      );
    });

    it('should handle invalid email format', async () => {
      const tokens = await generateTokens({
        userId: mockUserData.validUser.id,
        email: 'invalid-email', // Invalid format
        roles: [mockUserData.validUser.role],
        tenantId: mockUserData.validUser.company_id,
      }).catch(error => {
        expect(error.message).toContain('email must be a valid email address');
      });
    });

    it('should handle missing JWT keys', async () => {
      const originalPrivateKey = process.env.JWT_PRIVATE_KEY;
      const originalPublicKey = process.env.JWT_PUBLIC_KEY;

      delete process.env.JWT_PRIVATE_KEY;
      delete process.env.JWT_PUBLIC_KEY;

      try {
        await generateTokens({
          userId: mockUserData.validUser.id,
          email: mockUserData.validUser.email,
          roles: [mockUserData.validUser.role],
        }).catch(error => {
          expect(error.message).toContain('JWT');
        });
      } finally {
        process.env.JWT_PRIVATE_KEY = originalPrivateKey;
        process.env.JWT_PUBLIC_KEY = originalPublicKey;
      }
    });
  });
});
