# @nexus/eslint-config

Centralized ESLint configuration package for the Nexus workspace, providing
consistent code quality standards across all projects.

## Features

- **Base Configuration**: Common rules for JavaScript/TypeScript projects
- **React Support**: React-specific rules with accessibility and hooks
  validation
- **Next.js Integration**: Optimized configuration for Next.js applications
- **Node.js Backend**: Server-side specific rules and security measures
- **TypeScript Strict**: Enhanced type safety with comprehensive rules
- **Turbo Integration**: Monorepo-specific optimizations
- **Prettier Integration**: Seamless code formatting

## Available Configurations

### Base Configuration (`index.js`)

The foundation configuration for all JavaScript/TypeScript projects.

```javascript
module.exports = {
  extends: ['@nexus/eslint-config'],
};
```

**Includes:**

- ESLint recommended rules
- TypeScript ESLint recommended rules
- Prettier integration
- Import organization and sorting
- Common error prevention rules

### React Configuration (`react.js`)

Specialized configuration for React applications with accessibility support.

```javascript
module.exports = {
  extends: ['@nexus/eslint-config/react'],
};
```

**Includes:**

- All base configuration rules
- React recommended rules
- React Hooks rules
- JSX accessibility (jsx-a11y) rules
- React-specific best practices

### Next.js Configuration (`next.js`)

Optimized configuration for Next.js applications.

```javascript
module.exports = {
  extends: ['@nexus/eslint-config/next'],
};
```

**Includes:**

- All React configuration rules
- Next.js Core Web Vitals rules
- Next.js specific optimizations
- App Router and Pages Router support
- Performance and SEO best practices

### Node.js Configuration (`node.js`)

Backend-focused configuration for Node.js applications.

```javascript
module.exports = {
  extends: ['@nexus/eslint-config/node'],
};
```

**Includes:**

- All base configuration rules
- Node.js environment settings
- Security-focused rules
- Async/await best practices
- Server-side specific optimizations

### TypeScript Strict Configuration (`typescript.js`)

Enhanced TypeScript configuration with strict type checking.

```javascript
module.exports = {
  extends: ['@nexus/eslint-config/typescript'],
};
```

**Includes:**

- All base configuration rules
- Strict TypeScript rules
- Type-aware linting rules
- Advanced type safety checks
- Performance optimizations

### Turbo Configuration (`turbo.js`)

Monorepo-specific configuration for Turbo projects.

```javascript
module.exports = {
  extends: ['@nexus/eslint-config/turbo'],
};
```

**Includes:**

- All base configuration rules
- Turbo-specific rules
- Environment variable validation
- Build script optimizations

## Installation

The package is automatically available in the Nexus workspace. For external use:

```bash
npm install @nexus/eslint-config
# or
pnpm add @nexus/eslint-config
# or
yarn add @nexus/eslint-config
```

## Usage Examples

### Basic TypeScript Project

```javascript
// .eslintrc.js
module.exports = {
  extends: ['@nexus/eslint-config'],
  parserOptions: {
    project: './tsconfig.json',
  },
};
```

### React Application

```javascript
// .eslintrc.js
module.exports = {
  extends: ['@nexus/eslint-config/react'],
  parserOptions: {
    project: './tsconfig.json',
  },
};
```

### Next.js Application

```javascript
// .eslintrc.js
module.exports = {
  extends: ['@nexus/eslint-config/next'],
  parserOptions: {
    project: './tsconfig.json',
  },
};
```

### Node.js Backend

```javascript
// .eslintrc.js
module.exports = {
  extends: ['@nexus/eslint-config/node'],
  parserOptions: {
    project: './tsconfig.json',
  },
};
```

### Monorepo Root

```javascript
// .eslintrc.js
module.exports = {
  root: true,
  extends: ['@nexus/eslint-config', '@nexus/eslint-config/turbo'],
  overrides: [
    {
      files: ['apps/frontend/**/*'],
      extends: ['@nexus/eslint-config/next'],
    },
    {
      files: ['services/backend/**/*'],
      extends: ['@nexus/eslint-config/node'],
    },
  ],
};
```

## Rule Categories

### Error Prevention

- Catch common JavaScript/TypeScript errors
- Prevent runtime exceptions
- Enforce proper async/await usage
- Validate import/export statements

### Code Quality

- Enforce consistent coding patterns
- Prevent code smells and anti-patterns
- Optimize performance-critical code
- Maintain readable and maintainable code

### Type Safety (TypeScript)

- Strict type checking
- Prevent unsafe type assertions
- Enforce proper generic usage
- Validate function signatures

### Accessibility (React)

- WCAG compliance
- Screen reader compatibility
- Keyboard navigation support
- Semantic HTML enforcement

### Security

- Prevent XSS vulnerabilities
- Validate environment variable usage
- Enforce secure coding practices
- Prevent common security pitfalls

### Performance

- Optimize bundle size
- Prevent memory leaks
- Enforce efficient patterns
- Validate resource usage

## Customization

### Adding Custom Rules

```javascript
module.exports = {
  extends: ['@nexus/eslint-config/react'],
  rules: {
    // Override or add custom rules
    'no-console': 'warn',
    '@typescript-eslint/no-explicit-any': 'error',
  },
};
```

### Environment-Specific Overrides

```javascript
module.exports = {
  extends: ['@nexus/eslint-config'],
  overrides: [
    {
      files: ['*.test.ts', '*.spec.ts'],
      rules: {
        // Test-specific rule overrides
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
```

### Project-Specific Settings

```javascript
module.exports = {
  extends: ['@nexus/eslint-config/next'],
  settings: {
    next: {
      rootDir: './apps/frontend',
    },
  },
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
```

## Dependencies

### Core Dependencies

- `@typescript-eslint/eslint-plugin` - TypeScript linting rules
- `@typescript-eslint/parser` - TypeScript parser for ESLint
- `eslint-config-prettier` - Prettier integration
- `eslint-plugin-import` - Import/export validation
- `eslint-plugin-prettier` - Prettier rule integration

### React Dependencies

- `eslint-plugin-react` - React-specific rules
- `eslint-plugin-react-hooks` - React Hooks validation
- `eslint-plugin-jsx-a11y` - Accessibility rules

### Next.js Dependencies

- `eslint-config-next` - Next.js specific rules and optimizations

### Turbo Dependencies

- `eslint-config-turbo` - Turbo monorepo optimizations

### Peer Dependencies

- `eslint` ^9.0.0
- `typescript` ^5.0.0

## Troubleshooting

### Common Issues

#### Configuration Not Found

```bash
Error: Cannot resolve configuration @nexus/eslint-config
```

**Solution**: Ensure the package is installed in your workspace or project.

#### TypeScript Project Not Found

```bash
Error: The file does not match your project config
```

**Solution**: Verify your `tsconfig.json` path in `parserOptions.project`.

#### Prettier Conflicts

```bash
Error: Delete `⏎` prettier/prettier
```

**Solution**: Ensure `eslint-config-prettier` is included (it's automatic in our
configs).

#### Import Resolution Issues

```bash
Error: Unable to resolve path to module
```

**Solution**: Check your TypeScript path mappings and import statements.

### Debug Commands

```bash
# Check ESLint configuration
npx eslint --print-config src/index.ts

# Test specific file
npx eslint src/index.ts

# Check Prettier configuration
npx prettier --find-config-path src/index.ts

# Verify package installation
pnpm list @nexus/eslint-config
```

## Contributing

When modifying configurations:

1. Test changes across all workspace projects
2. Update documentation for new rules
3. Consider backward compatibility
4. Run comprehensive tests before committing

### Testing Changes

```bash
# Test all configurations
pnpm run lint

# Test specific configuration
cd apps/frontend && pnpm run lint

# Test with auto-fix
pnpm run lint:fix
```

## Maintenance

### Regular Updates

- Update ESLint and plugin dependencies
- Review and update rule configurations
- Test compatibility with new TypeScript versions
- Monitor for deprecated rules

### Version Management

- Follow semantic versioning
- Document breaking changes
- Provide migration guides
- Test across all workspace projects

## License

ISC License - Internal use within Nexus workspace.
