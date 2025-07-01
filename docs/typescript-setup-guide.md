# TypeScript Setup Guide

## Overview
TypeScript has been configured across the workspace with shared configurations and path mapping for seamless development.

## Configuration Files

### Root Configuration
- `tsconfig.json` - Main workspace TypeScript configuration
- Includes path mapping for all workspace directories
- Configured for modern ES2022 target with strict mode

### Shared Configurations (`configs/`)
- `tsconfig.base.json` - Base configuration for all packages
- `tsconfig.node.json` - Node.js specific configuration
- `tsconfig.react.json` - React/JSX specific configuration

## Path Mapping
The following path aliases are available across the workspace:

```typescript
import { something } from '@/apps/my-app'
import { Component } from '@/components/ui'
import { utility } from '@/utils/helpers'
import { MyType } from '@/types/common'
import { schema } from '@/schemas/validation'
import { config } from '@/configs/app'
```

## Package Setup

### For Node.js Packages
Create `tsconfig.json` in your package:
```json
{
  "extends": "../../configs/tsconfig.node.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

### For React Packages
Create `tsconfig.json` in your package:
```json
{
  "extends": "../../configs/tsconfig.react.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

## Build Scripts
Add these scripts to your package.json:

```json
{
  "scripts": {
    "build": "tsc",
    "type-check": "tsc --noEmit",
    "dev": "tsc --watch"
  }
}
```

## Features Enabled
- **Strict Mode**: Enhanced type safety
- **Path Mapping**: Clean imports across workspace
- **Incremental Compilation**: Faster builds
- **Declaration Files**: Automatic .d.ts generation
- **Source Maps**: Better debugging experience
- **Composite Projects**: Optimized for monorepos
