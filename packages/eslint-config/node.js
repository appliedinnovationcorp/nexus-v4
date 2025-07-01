/**
 * Node.js-specific ESLint configuration for Nexus workspace
 * Extends base configuration with Node.js specific rules
 */

module.exports = {
  extends: ['./index.js'],
  env: {
    node: true,
    browser: false,
  },
  rules: {
    // Node.js specific rules
    'no-console': 'off', // Console is acceptable in Node.js
    'no-process-exit': 'error',
    'no-process-env': 'off', // Environment variables are common in Node.js

    // Require/import rules for Node.js
    '@typescript-eslint/no-var-requires': 'off',
    'import/no-dynamic-require': 'warn',

    // Buffer and global rules
    'no-buffer-constructor': 'error',
    'no-new-require': 'error',
    'no-path-concat': 'error',

    // Async/await and Promise rules
    'no-async-promise-executor': 'error',
    'no-await-in-loop': 'warn',
    'no-promise-executor-return': 'error',
    'prefer-promise-reject-errors': 'error',
    'require-atomic-updates': 'error',

    // Security rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',

    // Performance rules
    'no-sync': 'warn',
  },
  overrides: [
    {
      files: ['*.config.js', '*.config.ts', 'scripts/**/*'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    {
      files: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'test/**/*'],
      env: {
        jest: true,
        mocha: true,
      },
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        'no-unused-expressions': 'off',
      },
    },
  ],
};
