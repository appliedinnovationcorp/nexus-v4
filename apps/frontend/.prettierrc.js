/**
 * Prettier configuration for Next.js frontend
 * Uses shared configuration with JSX-specific settings
 */

const baseConfig = require('@nexus/prettier-config');

module.exports = {
  ...baseConfig,
  // JSX-specific overrides
  jsxSingleQuote: false,

  // Additional overrides for React/JSX files
  overrides: [
    ...baseConfig.overrides,
    {
      files: ['*.jsx', '*.tsx'],
      options: {
        jsxSingleQuote: false,
        printWidth: 100,
      },
    },
  ],
};
