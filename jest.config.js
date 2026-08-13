/**
 * Jest Configuration for IAeZap
 *
 * Configures Jest to run tests for multi-tenant isolation, API endpoints,
 * and other backend functionality.
 */

module.exports = {
  // Use Node environment for backend tests
  testEnvironment: 'node',

  // Root directory for tests
  roots: ['<rootDir>/tests', '<rootDir>/__tests__'],

  // File patterns to consider as test files
  testMatch: ['**/*.test.ts', '**/*.test.js'],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // TypeScript support via ts-jest
  preset: 'ts-jest',

  // Module name mapper for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Transform files
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        strict: false,
        skipLibCheck: true,
      },
    }],
  },

  // Setup files (run before tests)
  setupFilesAfterEnv: [],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx',
    '!src/**/index.ts',
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },

  // Test timeout (ms)
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks between tests
  restoreMocks: true,

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/dist/',
  ],

  // Globals
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
};
