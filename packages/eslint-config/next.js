/**
 * Next.js-specific ESLint configuration for Nexus workspace
 * Extends React configuration with Next.js specific rules and optimizations
 */

module.exports = {
  extends: ['./react.js', 'next/core-web-vitals'],
  rules: {
    // Next.js specific rules
    '@next/next/no-html-link-for-pages': 'error',
    '@next/next/no-img-element': 'warn',
    '@next/next/no-unwanted-polyfillio': 'error',
    '@next/next/no-page-custom-font': 'error',
    '@next/next/no-css-tags': 'error',
    '@next/next/no-sync-scripts': 'error',
    '@next/next/no-document-import-in-page': 'error',
    '@next/next/no-head-import-in-document': 'error',
    '@next/next/no-script-component-in-head': 'error',
    '@next/next/no-styled-jsx-in-document': 'error',
    '@next/next/no-title-in-document-head': 'error',
    '@next/next/no-typos': 'error',
    '@next/next/no-duplicate-head': 'error',

    // React specific adjustments for Next.js
    'react/react-in-jsx-scope': 'off', // Not needed in Next.js 11+
    'react/prop-types': 'off', // Using TypeScript for prop validation

    // Import rules for Next.js
    'import/no-default-export': 'off', // Next.js requires default exports for pages

    // Development vs Production console rules
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

    // Performance optimizations
    'jsx-a11y/anchor-is-valid': [
      'error',
      {
        components: ['Link'],
        specialLink: ['hrefLeft', 'hrefRight'],
        aspects: ['invalidHref', 'preferButton'],
      },
    ],
  },
  overrides: [
    {
      files: [
        'pages/**/*.tsx',
        'pages/**/*.ts',
        'app/**/*.tsx',
        'app/**/*.ts',
        'src/app/**/*.tsx',
        'src/app/**/*.ts',
        'src/pages/**/*.tsx',
        'src/pages/**/*.ts',
      ],
      rules: {
        // Page and layout specific rules
        'import/no-default-export': 'off',
        'react/display-name': 'off',
      },
    },
    {
      files: ['next.config.js', 'next.config.ts', 'next.config.mjs'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        'no-console': 'off',
        'import/no-default-export': 'off',
      },
    },
    {
      files: ['middleware.ts', 'middleware.js'],
      rules: {
        'import/no-default-export': 'off',
      },
    },
    {
      files: ['**/*.test.tsx', '**/*.spec.tsx', '**/*.test.ts', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'jsx-a11y/no-autofocus': 'off',
        'no-console': 'off',
      },
    },
  ],
  settings: {
    next: {
      rootDir: process.cwd(),
    },
  },
};
