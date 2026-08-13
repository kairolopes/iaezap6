/**
 * Jest Setup File
 * Runs before each test suite
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_ISSUER = 'auth-service';
process.env.JWT_AUDIENCE = 'auth-api';
process.env.BCRYPT_ROUNDS = '10';

// Suppress console logs during tests (optional)
// jest.spyOn(console, 'log').mockImplementation(() => {});
// jest.spyOn(console, 'error').mockImplementation(() => {});
