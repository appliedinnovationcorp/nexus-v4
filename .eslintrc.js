/**
 * Root ESLint configuration for Nexus workspace
 * Uses shared configurations from @nexus/eslint-config
 */

module.exports = {
  root: true,
  extends: ['@nexus/eslint-config', '@nexus/eslint-config/turbo'],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.next/',
    '.turbo/',
    'coverage/',
    '*.min.js',
    '*.bundle.js',
  ],
  overrides: [
    {
      // Next.js frontend application
      files: ['apps/frontend/**/*'],
      extends: ['@nexus/eslint-config/next'],
    },
    {
      // NestJS backend service
      files: ['services/backend/**/*'],
      extends: ['@nexus/eslint-config/node'],
    },
    {
      // Shared packages with strict TypeScript
      files: ['packages/**/*'],
      extends: ['@nexus/eslint-config/typescript'],
    },
    {
      // Build and automation scripts
      files: ['scripts/**/*'],
      extends: ['@nexus/eslint-config/node'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
