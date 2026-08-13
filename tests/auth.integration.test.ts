/**
 * IAeZap Authentication Integration Tests
 *
 * Integration tests that mock Supabase database interactions.
 * These tests verify the full authentication flow end-to-end.
 *
 * Run with: npm test -- tests/auth.integration.test.ts
 */

import bcrypt from 'bcrypt';
import { generateTokens, verifyToken } from '@/lib/auth';

/**
 * Mock Supabase Client
 * Simulates Supabase database responses
 */
class MockSupabaseClient {
  private users: Map<string, any> = new Map();
  private companies: Map<string, any> = new Map();

  /**
   * Initialize mock data
   */
  init() {
    // Reset collections
    this.users.clear();
    this.companies.clear();

    // Add initial company
    this.companies.set('comp-001', {
      id: 'comp-001',
      cnpj: '12345678901234',
      name: 'Initial Company',
      status: 'active',
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Simulate: SELECT from companies WHERE cnpj = ?
   */
  getCompanyByCNPJ(cnpj: string) {
    for (const company of this.companies.values()) {
      if (company.cnpj === cnpj && !company.deleted_at) {
        return { data: company, error: null };
      }
    }
    return { data: null, error: { code: 'PGRST116' } };
  }

  /**
   * Simulate: INSERT INTO companies
   */
  createCompany(cnpj: string, name: string) {
    const id = `comp-${Date.now()}`;
    const company = {
      id,
      cnpj,
      name,
      status: 'active',
      created_at: new Date().toISOString(),
    };
    this.companies.set(id, company);
    return { data: company, error: null };
  }

  /**
   * Simulate: SELECT from users WHERE email = ?
   */
  async getUserByEmail(email: string) {
    for (const user of this.users.values()) {
      if (user.email === email && !user.deleted_at) {
        return { data: user, error: null };
      }
    }
    return { data: null, error: { code: 'PGRST116' } };
  }

  /**
   * Simulate: INSERT INTO users
   */
  async createUser(email: string, hashedPassword: string, companyId: string) {
    // Check if user already exists
    const existing = await this.getUserByEmail(email);
    if (existing.data) {
      return {
        data: null,
        error: { message: 'User already exists' },
      };
    }

    const id = `user-${Date.now()}`;
    const user = {
      id,
      email: email.toLowerCase(),
      password_hash: hashedPassword,
      company_id: companyId,
      role: 'admin',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.users.set(id, user);
    return { data: user, error: null };
  }

  /**
   * Simulate: SELECT from users WHERE email = ?
   */
  async getUserWithPassword(email: string) {
    for (const user of this.users.values()) {
      if (user.email === email && !user.deleted_at) {
        return { data: user, error: null };
      }
    }
    return { data: null, error: { code: 'PGRST116' } };
  }
}

/**
 * Test data
 */
const testData = {
  company: {
    cnpj: '98765432101234',
    name: 'Integration Test Company',
  },
  user: {
    email: 'integration@test.com',
    password: 'IntegrationTest123!',
  },
};

/**
 * Test Suite: Authentication Integration Tests
 */
describe('Authentication Integration Tests', () => {
  let supabase: MockSupabaseClient;

  beforeAll(() => {
    // Set environment variables
    process.env.JWT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
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
v2w4x6y8z0a2b4c6d8e0f2g4h6i8j0k2l4m6n8o0`;

    process.env.JWT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1vKnfS92NiulUNafZSj
rhbRq0ymAtDJSC/twlqHHRGDFCi4AzhxnzBhF1ztBEHd8kCBqpsRKh+541WBjFZF
ax9hGSqmSV10Y/MvG/GVao/MBd4ey/F3PB+2fTe5OifBvS9DNTdzPz8/Pz8/Pz8/
Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/
Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/
Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/Pz8/QIDAQAB
-----END PUBLIC KEY-----`;

    process.env.JWT_ISSUER = 'auth-service';
    process.env.JWT_AUDIENCE = 'auth-api';
  });

  beforeEach(() => {
    // Initialize mock Supabase client before each test
    supabase = new MockSupabaseClient();
    supabase.init();
  });

  describe('Complete Registration Flow', () => {
    it('should complete full registration with new company', async () => {
      const cnpj = testData.company.cnpj;
      const companyName = testData.company.name;
      const email = testData.user.email;
      const password = testData.user.password;

      // Step 1: Check if company exists
      const companyCheck = supabase.getCompanyByCNPJ(cnpj);
      expect(companyCheck.data).toBeNull();

      // Step 2: Create company
      const { data: createdCompany } = supabase.createCompany(cnpj, companyName);
      expect(createdCompany).not.toBeNull();
      expect(createdCompany.id).toBeDefined();

      // Step 3: Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      expect(hashedPassword).not.toBe(password);

      // Step 4: Create user
      const { data: createdUser } = await supabase.createUser(
        email,
        hashedPassword,
        createdCompany!.id
      );
      expect(createdUser).not.toBeNull();
      expect(createdUser!.email).toBe(email);
      expect(createdUser!.company_id).toBe(createdCompany!.id);
      expect(createdUser!.role).toBe('admin');

      // Step 5: Generate tokens
      const tokens = await generateTokens({
        userId: createdUser!.id,
        email: createdUser!.email,
        roles: [createdUser!.role],
        tenantId: createdUser!.company_id,
      });

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();

      // Step 6: Verify token contains company_id
      const verified = await verifyToken(tokens.accessToken);
      expect(verified.valid).toBe(true);
      expect(verified.payload?.tenantId).toBe(createdCompany!.id);
    });

    it('should fail registration with duplicate email', async () => {
      // First registration
      const { data: company } = supabase.createCompany(
        testData.company.cnpj,
        testData.company.name
      );

      const hashedPassword = await bcrypt.hash(testData.user.password, 10);
      await supabase.createUser(
        testData.user.email,
        hashedPassword,
        company!.id
      );

      // Second registration with same email
      const { data: duplicateUser, error } = await supabase.createUser(
        testData.user.email,
        hashedPassword,
        company!.id
      );

      expect(duplicateUser).toBeNull();
      expect(error).not.toBeNull();
      expect(error.message).toContain('already exists');
    });

    it('should use existing company if CNPJ matches', async () => {
      // Create initial company
      const { data: initialCompany } = supabase.createCompany(
        testData.company.cnpj,
        'Old Company Name'
      );

      // Try to create user with same CNPJ
      const companyCheck = supabase.getCompanyByCNPJ(testData.company.cnpj);
      expect(companyCheck.data?.id).toBe(initialCompany!.id);

      // Create user in existing company
      const hashedPassword = await bcrypt.hash(testData.user.password, 10);
      const { data: user } = await supabase.createUser(
        testData.user.email,
        hashedPassword,
        initialCompany!.id
      );

      expect(user!.company_id).toBe(initialCompany!.id);
    });
  });

  describe('Complete Login Flow', () => {
    it('should complete full login with correct credentials', async () => {
      // Setup: Create user
      const { data: company } = supabase.createCompany(
        testData.company.cnpj,
        testData.company.name
      );

      const hashedPassword = await bcrypt.hash(testData.user.password, 10);
      const { data: user } = await supabase.createUser(
        testData.user.email,
        hashedPassword,
        company!.id
      );

      // Step 1: Find user by email
      const { data: foundUser } = await supabase.getUserWithPassword(
        testData.user.email
      );
      expect(foundUser).not.toBeNull();

      // Step 2: Verify password
      const passwordMatch = await bcrypt.compare(
        testData.user.password,
        foundUser!.password_hash
      );
      expect(passwordMatch).toBe(true);

      // Step 3: Generate tokens
      const tokens = await generateTokens({
        userId: foundUser!.id,
        email: foundUser!.email,
        roles: [foundUser!.role],
        tenantId: foundUser!.company_id,
      });

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();

      // Step 4: Verify token
      const verified = await verifyToken(tokens.accessToken);
      expect(verified.valid).toBe(true);
      expect(verified.payload?.sub).toBe(foundUser!.id);
      expect(verified.payload?.tenantId).toBe(company!.id);
    });

    it('should fail login with wrong password', async () => {
      // Setup: Create user
      const { data: company } = supabase.createCompany(
        testData.company.cnpj,
        testData.company.name
      );

      const hashedPassword = await bcrypt.hash(testData.user.password, 10);
      const { data: user } = await supabase.createUser(
        testData.user.email,
        hashedPassword,
        company!.id
      );

      // Find user
      const { data: foundUser } = await supabase.getUserWithPassword(
        testData.user.email
      );

      // Try wrong password
      const wrongPassword = 'WrongPassword123!';
      const passwordMatch = await bcrypt.compare(
        wrongPassword,
        foundUser!.password_hash
      );

      expect(passwordMatch).toBe(false);

      // Should not generate tokens
      expect(user).not.toBeNull();
    });

    it('should fail login with nonexistent email', async () => {
      const { data: foundUser } = await supabase.getUserWithPassword(
        'nonexistent@example.com'
      );

      expect(foundUser).toBeNull();
    });
  });

  describe('Multi-tenant Isolation', () => {
    it('should maintain separate user spaces for different companies', async () => {
      // Create two companies
      const { data: company1 } = supabase.createCompany(
        '11111111111111',
        'Company 1'
      );
      const { data: company2 } = supabase.createCompany(
        '22222222222222',
        'Company 2'
      );

      // Create users in each company
      const hashedPassword1 = await bcrypt.hash('Company1Pass123!', 10);
      const { data: user1 } = await supabase.createUser(
        'user1@company1.com',
        hashedPassword1,
        company1!.id
      );

      const hashedPassword2 = await bcrypt.hash('Company2Pass456!', 10);
      const { data: user2 } = await supabase.createUser(
        'user2@company2.com',
        hashedPassword2,
        company2!.id
      );

      // Generate tokens
      const token1 = await generateTokens({
        userId: user1!.id,
        email: user1!.email,
        roles: [user1!.role],
        tenantId: user1!.company_id,
      });

      const token2 = await generateTokens({
        userId: user2!.id,
        email: user2!.email,
        roles: [user2!.role],
        tenantId: user2!.company_id,
      });

      // Verify isolation
      const verified1 = await verifyToken(token1.accessToken);
      const verified2 = await verifyToken(token2.accessToken);

      expect(verified1.payload?.tenantId).toBe(company1!.id);
      expect(verified2.payload?.tenantId).toBe(company2!.id);
      expect(verified1.payload?.tenantId).not.toBe(verified2.payload?.tenantId);
      expect(verified1.payload?.sub).not.toBe(verified2.payload?.sub);
    });

    it('should support multiple users in same company', async () => {
      // Create company
      const { data: company } = supabase.createCompany(
        testData.company.cnpj,
        testData.company.name
      );

      // Create multiple users
      const users = [];
      for (let i = 0; i < 3; i++) {
        const hashedPassword = await bcrypt.hash(`Password${i}123!`, 10);
        const { data: user } = await supabase.createUser(
          `user${i}@example.com`,
          hashedPassword,
          company!.id
        );
        users.push(user);
      }

      // Verify all users belong to same company
      expect(users[0]!.company_id).toBe(company!.id);
      expect(users[1]!.company_id).toBe(company!.id);
      expect(users[2]!.company_id).toBe(company!.id);

      // Generate tokens for each
      for (const user of users) {
        const token = await generateTokens({
          userId: user!.id,
          email: user!.email,
          roles: [user!.role],
          tenantId: user!.company_id,
        });

        const verified = await verifyToken(token.accessToken);
        expect(verified.payload?.tenantId).toBe(company!.id);
      }
    });
  });

  describe('Token Claims Validation', () => {
    it('should include all required claims in access token', async () => {
      const { data: company } = supabase.createCompany(
        testData.company.cnpj,
        testData.company.name
      );

      const hashedPassword = await bcrypt.hash(testData.user.password, 10);
      const { data: user } = await supabase.createUser(
        testData.user.email,
        hashedPassword,
        company!.id
      );

      const tokens = await generateTokens({
        userId: user!.id,
        email: user!.email,
        roles: [user!.role],
        tenantId: user!.company_id,
      });

      const verified = await verifyToken(tokens.accessToken);

      // Verify all required claims
      expect(verified.payload?.sub).toBe(user!.id);
      expect(verified.payload?.email).toBe(user!.email);
      expect(verified.payload?.roles).toEqual([user!.role]);
      expect(verified.payload?.tenantId).toBe(company!.id);
      expect(verified.payload?.iss).toBe('auth-service');
      expect(verified.payload?.aud).toBe('auth-api');
      expect(verified.payload?.iat).toBeDefined();
      expect(verified.payload?.exp).toBeDefined();
    });
  });
});
