/**
 * Root ESLint configuration for Nexus workspace
 * Uses shared configuration from @nexus/eslint-config
 */

module.exports = {
  root: true,
  extends: ['@nexus/eslint-config'],
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
      files: ['apps/frontend/**/*'],
      extends: ['@nexus/eslint-config/react'],
    },
    {
      files: ['services/backend/**/*'],
      extends: ['@nexus/eslint-config/node'],
    },
    {
      files: ['packages/**/*'],
      extends: ['@nexus/eslint-config/typescript'],
    },
    {
      files: ['scripts/**/*'],
      extends: ['@nexus/eslint-config/node'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
