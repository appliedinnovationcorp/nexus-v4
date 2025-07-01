# Nexus Workspace v4

A comprehensive pnpm workspace with organized directory structure for scalable development.

## Workspace Structure

```
├── apps/           # Main applications (web, mobile, desktop, CLI)
├── packages/       # Publishable packages and libraries
├── libs/           # Internal libraries and shared code
├── configs/        # Shared configuration files
├── docs/           # Project documentation
├── templates/      # Project templates and boilerplates
├── examples/       # Example applications and demos
├── services/       # Backend services and microservices
├── components/     # UI components and component libraries
├── utils/          # Utility functions and helpers
├── types/          # Shared TypeScript type definitions
├── schemas/        # Data schemas and validation definitions
├── tests/          # Shared test utilities and fixtures
├── scripts/        # Automation and build scripts
├── plugins/        # Custom plugins and extensions
└── themes/         # UI themes and styling packages
```

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Build all packages:
   ```bash
   pnpm build
   ```

3. Run tests:
   ```bash
   pnpm test
   ```

4. Start development:
   ```bash
   pnpm dev
   ```

## Available Scripts

- `pnpm build` - Build all packages
- `pnpm test` - Run tests in all packages
- `pnpm lint` - Lint all packages
- `pnpm dev` - Start development mode
- `pnpm clean` - Clean all packages
- `pnpm install:all` - Install all dependencies
- `pnpm update:all` - Update all dependencies

## Adding New Packages

To add a new package to any workspace directory:

1. Navigate to the appropriate directory (e.g., `apps/`, `packages/`, etc.)
2. Create your package directory
3. Initialize with `pnpm init`
4. The package will automatically be included in the workspace

## Workspace Configuration

The workspace is configured in `pnpm-workspace.yaml` with all directory patterns included.

## Requirements

- Node.js >= 18.0.0
- pnpm >= 8.0.0
