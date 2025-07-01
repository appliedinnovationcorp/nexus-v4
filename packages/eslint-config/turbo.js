/**
 * Turbo-specific ESLint configuration for Nexus workspace
 * Extends base configuration with Turbo-specific optimizations
 */

module.exports = {
  extends: ['./index.js', 'turbo'],
  rules: {
    // Turbo-specific rules
    'turbo/no-undeclared-env-vars': 'error',

    // Allow console in build scripts and configuration files
    'no-console': 'off',

    // Relax some rules for configuration files
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  overrides: [
    {
      files: ['turbo.json', '*.config.js', '*.config.ts'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
};
