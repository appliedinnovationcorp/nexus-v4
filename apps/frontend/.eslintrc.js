/**
 * ESLint configuration for Next.js frontend
 * Uses shared Next.js configuration from @nexus/eslint-config
 */

module.exports = {
  extends: ['@nexus/eslint-config/next'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  rules: {
    // Allow console in development
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',

    // TypeScript adjustments for Next.js
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
  },
  overrides: [
    {
      files: ['src/app/**/*.tsx'],
      rules: {
        // App Router specific rules
        'import/no-default-export': 'off',
      },
    },
    {
      files: ['**/*.test.tsx', '**/*.spec.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'jsx-a11y/no-autofocus': 'off',
      },
    },
  ],
};
