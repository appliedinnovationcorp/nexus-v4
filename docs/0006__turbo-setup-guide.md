# Turbo Setup Guide

## Overview

Turbo has been configured to optimize build performance across the workspace
with intelligent caching and task orchestration.

## Configuration

### Pipeline Tasks

- **build**: Builds packages with dependency ordering
- **test**: Runs tests after build completion
- **lint**: Lints code without dependencies
- **dev**: Development mode (no caching, persistent)
- **clean**: Cleans build artifacts
- **type-check**: TypeScript type checking

### Key Features

- **Dependency Graph**: Tasks run in correct order based on dependencies
- **Incremental Builds**: Only rebuilds changed packages
- **Remote Caching**: Can be configured for team sharing
- **Parallel Execution**: Runs independent tasks simultaneously

## Usage

```bash
# Build all packages
pnpm build

# Run tests
pnpm test

# Start development
pnpm dev

# Lint all packages
pnpm lint

# Type check
pnpm type-check

# Clean all build artifacts
pnpm clean
```

## Adding Tasks to Packages

When creating new packages, add these scripts to their `package.json`:

```json
{
  "scripts": {
    "build": "your-build-command",
    "test": "your-test-command",
    "lint": "your-lint-command",
    "dev": "your-dev-command",
    "clean": "your-clean-command",
    "type-check": "tsc --noEmit"
  }
}
```

## Performance Benefits

- **Caching**: Turbo caches task outputs and skips unchanged work
- **Parallelization**: Runs tasks across CPU cores efficiently
- **Dependency Awareness**: Ensures correct build order automatically
