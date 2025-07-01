/**
 * ESLint configuration for Next.js frontend
 * Uses shared Next.js configuration from @nexus/eslint-config
 */

module.exports = {
  extends: ['@nexus/eslint-config/next'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
