/**
 * ESLint configuration for NestJS backend
 * Uses shared Node.js configuration from @nexus/eslint-config
 */

module.exports = {
  extends: ['@nexus/eslint-config/node'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
