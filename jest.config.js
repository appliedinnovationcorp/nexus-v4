/**
 * @fileoverview Root Jest configuration for the workspace
 */

module.exports = {
  projects: [
    '<rootDir>/packages/*/jest.config.js',
    '<rootDir>/apps/*/jest.config.js',
    '<rootDir>/services/*/jest.config.js',
  ],
  collectCoverageFrom: [
    'packages/*/src/**/*.{ts,tsx}',
    'apps/*/src/**/*.{ts,tsx}',
    'services/*/src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/*.stories.{ts,tsx}',
    '!**/*.test.{ts,tsx}',
    '!**/*.spec.{ts,tsx}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testMatch: [
    '<rootDir>/packages/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/packages/**/*.{test,spec}.{ts,tsx}',
    '<rootDir>/apps/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/apps/**/*.{test,spec}.{ts,tsx}',
    '<rootDir>/services/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/services/**/*.{test,spec}.{ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/',
  ],
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/jest.setup.js',
  ],
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleNameMapping: {
    '^@nexus/(.*)$': '<rootDir>/packages/$1/src',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
};
