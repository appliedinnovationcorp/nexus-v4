# Packages Directory

This directory contains shared packages and configurations used across the Nexus
workspace.

## Available Packages

### @nexus/eslint-config

Centralized ESLint configuration providing consistent code quality standards
across all projects.

**Features:**

- Base configuration for JavaScript/TypeScript
- React-specific rules for frontend applications
- Node.js-specific rules for backend services
- Strict TypeScript configuration for enhanced type safety
- Prettier integration for consistent formatting
- Accessibility rules for React components
- Import organization and sorting

**Usage:**

```javascript
// .eslintrc.js
module.exports = {
  extends: ['@nexus/eslint-config'], // Base config
  // or
  extends: ['@nexus/eslint-config/react'], // React config
  // or
  extends: ['@nexus/eslint-config/node'], // Node.js config
  // or
  extends: ['@nexus/eslint-config/typescript'], // Strict TypeScript config
};
```

### @nexus/prettier-config

Shared Prettier configuration ensuring consistent code formatting across all
projects.

**Features:**

- Consistent indentation (2 spaces)
- Single quotes for JavaScript/TypeScript
- Trailing commas for better diffs
- Line width of 100 characters
- File-specific overrides for JSON, Markdown, YAML, etc.
- JSX-specific formatting rules

**Usage:**

```javascript
// .prettierrc.js
module.exports = require('@nexus/prettier-config');
```

## Configuration Files

Each package includes:

- `package.json` - Package metadata and dependencies
- Configuration files (index.js, react.js, node.js, typescript.js)
- Peer dependencies for required tools

## Development Workflow

### Automated Code Quality

The workspace includes automated scripts for maintaining code quality:

```bash
# Check formatting and linting
pnpm run lint
pnpm run format:check

# Auto-fix issues
pnpm run lint:fix
pnpm run format

# Comprehensive quality check
./scripts/lint-and-format.sh
./scripts/lint-and-format.sh --fix
```

### IDE Integration

VS Code settings are configured to:

- Format on save with Prettier
- Auto-fix ESLint issues on save
- Organize imports automatically
- Use consistent tab size and line endings
- Exclude build directories from search

## Rules and Standards

### ESLint Rules

- **Error Prevention**: Catch common JavaScript/TypeScript errors
- **Best Practices**: Enforce modern JavaScript patterns
- **Code Style**: Consistent formatting and naming conventions
- **TypeScript**: Strict type checking and safety rules
- **React**: Component best practices and accessibility
- **Node.js**: Server-side specific rules and security

### Prettier Formatting

- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes for JS/TS, double quotes for JSX
- **Line Length**: 100 characters maximum
- **Trailing Commas**: Always in multiline structures
- **Semicolons**: Always required
- **Bracket Spacing**: Enabled for object literals

## Extending Configurations

### Custom Rules

To add project-specific rules:

```javascript
// .eslintrc.js
module.exports = {
  extends: ['@nexus/eslint-config/react'],
  rules: {
    // Override or add custom rules
    'no-console': 'warn',
    '@typescript-eslint/no-explicit-any': 'error',
  },
};
```

## Troubleshooting

### Common Issues

1. **ESLint not finding config**: Ensure the package is installed in the
   workspace
2. **Prettier conflicts**: Check that eslint-config-prettier is included
3. **TypeScript errors**: Verify tsconfig.json includes all necessary files
4. **Import resolution**: Check path mappings in TypeScript configuration

### Debug Commands

```bash
# Check ESLint configuration
npx eslint --print-config src/index.ts

# Check Prettier configuration
npx prettier --find-config-path src/index.ts

# Verify workspace packages
pnpm list --depth=0
```
