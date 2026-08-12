/**
 * Tests for POST /api/auth/register endpoint
 *
 * Run with: npm test -- register.test.ts
 * Or: pnpm test -- register.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

/**
 * Test configuration
 */
const API_URL = process.env.API_URL || 'http://localhost:3000';
const REGISTER_ENDPOINT = `${API_URL}/api/auth/register`;

/**
 * Test data generators
 */
function generateEmail(): string {
  return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@example.com`;
}

const validPassword = 'SecurePass123!';
const validFirstName = 'John';
const validLastName = 'Doe';

/**
 * Test suite for register endpoint
 */
describe('POST /api/auth/register', () => {
  /**
   * Test: Successful registration
   */
  it('should successfully register a new user with valid credentials', async () => {
    const email = generateEmail();

    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: validPassword,
        firstName: validFirstName,
        lastName: validLastName,
        acceptTerms: true,
      }),
    });

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.user).toBeDefined();
    expect(data.user.id).toBeDefined();
    expect(data.user.email).toBe(email);
    expect(data.user.firstName).toBe(validFirstName);
    expect(data.user.lastName).toBe(validLastName);
    expect(data.user.roles).toEqual(['user']);
    expect(data.tokens).toBeDefined();
    expect(data.tokens.accessToken).toBeDefined();
    expect(data.tokens.refreshToken).toBeDefined();
    expect(data.tokens.expiresIn).toBeGreaterThan(0);
    expect(data.tokens.tokenType).toBe('Bearer');
  });

  /**
   * Test: Duplicate email handling
   */
  it('should reject registration with duplicate email', async () => {
    const email = generateEmail();

    // First registration
    const firstResponse = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: validPassword,
        firstName: validFirstName,
        lastName: validLastName,
        acceptTerms: true,
      }),
    });

    expect(firstResponse.status).toBe(201);

    // Second registration with same email
    const secondResponse = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: validPassword,
        firstName: 'Jane',
        lastName: 'Smith',
        acceptTerms: true,
      }),
    });

    expect(secondResponse.status).toBe(409);

    const data = await secondResponse.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('USER_ALREADY_EXISTS');
    expect(data.error.message).toContain('already exists');
  });

  /**
   * Test: Invalid email format
   */
  it('should reject invalid email format', async () => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email',
        password: validPassword,
        firstName: validFirstName,
        lastName: validLastName,
        acceptTerms: true,
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INVALID_CREDENTIALS');
    expect(data.error.details.email).toBeDefined();
  });

  /**
   * Test: Email case insensitivity
   */
  it('should convert email to lowercase', async () => {
    const baseEmail = generateEmail();
    const email = baseEmail.toUpperCase();

    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: validPassword,
        firstName: validFirstName,
        lastName: validLastName,
        acceptTerms: true,
      }),
    });

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.user.email).toBe(baseEmail.toLowerCase());
  });

  /**
   * Test: Password too short
   */
  it('should reject password shorter than 8 characters', async () => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: generateEmail(),
        password: 'Short1!',
        firstName: validFirstName,
        lastName: validLastName,
        acceptTerms: true,
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('INVALID_CREDENTIALS');
    expect(data.error.details.password).toBeDefined();
  });

  /**
   * Test: Password missing uppercase
   */
  it('should reject password without uppercase letter', async () => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: generateEmail(),
        password: 'securepass123!',
        firstName: validFirstName,
        lastName: validLastName,
        acceptTerms: true,
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.details.password).toBeDefined();
  });

  /**
   * Test: Password missing lowercase
   */
  it('should reject password without lowercase letter', async () => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: generateEmail(),
        password: 'SECUREPASS123!',
        firstName: validFirstName,
        lastName: validLastName,
        acceptTerms: true,
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.details.password).toBeDefined();
  });

  /**
   * Test: Password missing number
   */
  it('should reject password without number', async () => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: generateEmail(),
        password: 'SecurePass!',
        firstName: validFirstName,
        lastName: validLastName,
        acceptTerms: true,
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.details.password).toBeDefined();
  });

  /**
   * Test: Password missing special character
   */
  it('should reject password without special character', async () => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: generateEmail(),
        password: 'SecurePass123',
        firstName: validFirstName,
        lastName: validLastName,
        acceptTerms: true,
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.details.password).toBeDefined();
  });

  /**
   * Test: Valid special characters
   */
  it('should accept all valid special characters', async () => {
    const specialChars = ['@', '$', '!', '%', '*', '?', '&'];

    for (const char of specialChars) {
      const password = `SecurePass123${char}`;
      const response = await fetch(REGISTER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: generateEmail(),
          password,
          firstName: validFirstName,
          lastName: validLastName,
          acceptTerms: true,
        }),
      });

      expect(response.status).toBe(201);
    }
  });

  /**
   * Test: First name too short
   */
  it('should reject firstName shorter than 2 characters', async () => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: generateEmail(),
        password: validPassword,
        firstName: 'J',
        lastName: validLastName,
        acceptTerms: true,
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.details.firstName).toBeDefined();
  });

  /**
   * Test: First name too long
   */
  it('should reject firstName longer than 50 characters', async () => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: generateEmail(),
        password: validPassword,
        firstName: 'a'.repeat(51),
        lastName: validLastName,
        acceptTerms: true,
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.details.firstName).toBeDefined();
  });

  /**
   * Test: Last name too short
   */
  it('should reject lastName shorter than 2 characters', async () => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: generateEmail(),
        password: validPassword,
        firstName: validFirstName,
        lastName: 'D',
        acceptTerms: true,
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.details.lastName).toBeDefined();
  });

  /**
   * Test: Last name too long
   */
  it('should reject lastName longer than 50 characters', async () => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: generateEmail(),
        password: validPassword,
        firstName: validFirstName,
        lastName: 'a'.repeat(51),
        acceptTerms: true,
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.details.lastName).toBeDefined();
  });

  /**
   * Test: Missing acceptTerms
   */
  it('should reject when acceptTerms is false', async () => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: generateEmail(),
        password: validPassword,
        firstName: validFirstName,
        lastName: validLastName,
        acceptTerms: false,
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('INVALID_CREDENTIALS');
  });

  /**
   * Test: Missing email field
   */
  it('should reject request with missing email field', async () => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: validPassword,
        firstName: validFirstName,
        lastName: validLastName,
        acceptTerms: true,
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.details.email).toBeDefined();
  });

  /**
   * Test: Missing password field
   */
  it('should reject request with missing password field', async () => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: generateEmail(),
        firstName: validFirstName,
        lastName: validLastName,
        acceptTerms: true,
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.details.password).toBeDefined();
  });

  /**
   * Test: Invalid JSON
   */
  it('should reject invalid JSON in request body', async () => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json {',
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('INVALID_CREDENTIALS');
  });

  /**
   * Test: Empty request body
   */
  it('should reject empty request body', async () => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    });

    expect(response.status).toBe(400);
  });

  /**
   * Test: CORS preflight
   */
  it('should handle OPTIONS request for CORS', async () => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'OPTIONS',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    expect(response.headers.get('access-control-allow-headers')).toBeDefined();
  });

  /**
   * Test: Response includes cookies
   */
  it('should set HTTP cookies in response', async () => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: generateEmail(),
        password: validPassword,
        firstName: validFirstName,
        lastName: validLastName,
        acceptTerms: true,
      }),
      credentials: 'include',
    });

    expect(response.status).toBe(201);

    // Check for Set-Cookie header
    const setCookieHeader = response.headers.get('set-cookie');
    expect(setCookieHeader).toBeDefined();
  });

  /**
   * Test: User roles default to ['user']
   */
  it('should set user roles to [user] by default', async () => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: generateEmail(),
        password: validPassword,
        firstName: validFirstName,
        lastName: validLastName,
        acceptTerms: true,
      }),
    });

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.user.roles).toEqual(['user']);
  });

  /**
   * Test: Token fields are non-empty
   */
  it('should return non-empty tokens', async () => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: generateEmail(),
        password: validPassword,
        firstName: validFirstName,
        lastName: validLastName,
        acceptTerms: true,
      }),
    });

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.tokens.accessToken.length).toBeGreaterThan(0);
    expect(data.tokens.refreshToken.length).toBeGreaterThan(0);
    expect(data.tokens.expiresIn).toBeGreaterThan(0);
  });

  /**
   * Test: Whitespace trimming for names
   */
  it('should trim whitespace from names', async () => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: generateEmail(),
        password: validPassword,
        firstName: '  John  ',
        lastName: '  Doe  ',
        acceptTerms: true,
      }),
    });

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.user.firstName).toBe('John');
    expect(data.user.lastName).toBe('Doe');
  });
});

/**
 * Integration tests
 */
describe('Integration: Register -> Login', () => {
  /**
   * Test: Register then login with new credentials
   */
  it('should be able to login after registration', async () => {
    const email = generateEmail();
    const password = validPassword;

    // Register
    const registerResponse = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        firstName: validFirstName,
        lastName: validLastName,
        acceptTerms: true,
      }),
    });

    expect(registerResponse.status).toBe(201);

    const registerData = await registerResponse.json();
    const registeredUserId = registerData.user.id;
    const registeredEmail = registerData.user.email;

    // Try to login with same credentials
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: registeredEmail,
        password,
      }),
    });

    expect(loginResponse.status).toBe(200);

    const loginData = await loginResponse.json();
    expect(loginData.user.id).toBe(registeredUserId);
    expect(loginData.user.email).toBe(registeredEmail);
  });
});
