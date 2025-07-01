/**
 * ESLint configuration for Next.js frontend
 * Extends shared React configuration
 */

module.exports = {
  extends: ['@nexus/eslint-config/react', 'next/core-web-vitals'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  rules: {
    // Next.js specific overrides
    '@next/next/no-html-link-for-pages': 'error',
    '@next/next/no-img-element': 'warn',
    '@next/next/no-unwanted-polyfillio': 'error',
    '@next/next/no-page-custom-font': 'error',

    // React specific adjustments for Next.js
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',

    // Allow console in development
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',

    // TypeScript adjustments
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
