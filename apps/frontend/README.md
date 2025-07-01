# Nexus Frontend Application

A modern Next.js frontend application built with TypeScript, Tailwind CSS, and the App Router, designed for the Nexus workspace.

## Features

- **Next.js 15**: Latest version with App Router and Server Components
- **TypeScript**: Full TypeScript support with strict mode
- **Tailwind CSS**: Modern utility-first CSS framework
- **Turbopack**: Lightning-fast development with Turbopack bundler
- **API Integration**: Built-in API client for backend communication
- **Health Monitoring**: Real-time API status monitoring
- **Responsive Design**: Mobile-first responsive design
- **Production Ready**: Optimized builds and Docker containerization

## Quick Start

### Development
```bash
# Install dependencies
pnpm install

# Start development server with Turbopack
pnpm run dev

# Build for production
pnpm run build

# Start production server
pnpm run start
```

### Docker
```bash
# Build Docker image
docker build -t nexus-frontend .

# Run container
docker run -p 3000:3000 nexus-frontend
```

## Environment Configuration

Create `.env.local` file with your configuration:

```env
# Application Configuration
NEXT_PUBLIC_APP_NAME=Nexus Frontend
NEXT_PUBLIC_APP_VERSION=1.0.0

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_API_TIMEOUT=10000

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=false
NEXT_PUBLIC_ENABLE_DEBUG=true
```

## Project Structure

```
src/
├── app/                 # App Router pages and layouts
│   ├── page.tsx        # Home page
│   ├── layout.tsx      # Root layout
│   └── globals.css     # Global styles
├── components/         # Reusable React components
│   ├── ApiStatus.tsx   # API health status component
│   ├── FeatureCard.tsx # Feature showcase component
│   └── index.ts        # Component exports
└── lib/                # Utility libraries
    └── api.ts          # API client and utilities
```

## Key Components

### ApiStatus
Real-time API health monitoring component that:
- Checks backend API availability
- Displays connection status with visual indicators
- Shows response time metrics
- Auto-refreshes every 30 seconds

### FeatureCard
Reusable card component for showcasing features:
- Clean, modern design
- Icon and text support
- Hover effects and animations
- Responsive layout

### API Client
Comprehensive API client with:
- TypeScript support
- Request/response typing
- Timeout handling
- Error management
- Health check methods

## Available Scripts

- `pnpm run dev` - Start development server with Turbopack
- `pnpm run build` - Build optimized production bundle
- `pnpm run start` - Start production server
- `pnpm run lint` - Run ESLint
- `pnpm run type-check` - Run TypeScript type checking
- `pnpm run clean` - Clean build artifacts

## Technology Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript with strict mode
- **Styling**: Tailwind CSS v4
- **Bundler**: Turbopack for development
- **Linting**: ESLint with Next.js config
- **Package Manager**: pnpm

## Features Showcase

The application demonstrates:

1. **Modern Architecture**: App Router with Server Components
2. **Full-Stack Integration**: Seamless backend API communication
3. **Real-Time Monitoring**: Live API health status
4. **Responsive Design**: Mobile-first approach
5. **Performance**: Optimized builds and lazy loading
6. **Developer Experience**: Hot reload, TypeScript, and modern tooling

## API Integration

The frontend connects to the NestJS backend at `http://localhost:3001/api` by default. Key endpoints:

- `GET /` - Welcome message
- `GET /health` - Comprehensive health check
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

## Deployment

### Production Build
```bash
pnpm run build
pnpm run start
```

### Docker Deployment
```bash
docker build -t nexus-frontend .
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=https://your-api.com nexus-frontend
```

### Environment Variables
Set these for production:
- `NEXT_PUBLIC_API_URL` - Backend API URL
- `NEXT_PUBLIC_APP_NAME` - Application name
- `NODE_ENV=production` - Production mode

## Development Guidelines

1. **Components**: Create reusable components in `src/components/`
2. **Pages**: Use App Router in `src/app/`
3. **Styling**: Use Tailwind CSS classes
4. **API Calls**: Use the provided API client
5. **Types**: Define TypeScript interfaces
6. **Testing**: Add tests for components and utilities

## Contributing

1. Follow the established code style
2. Use TypeScript for all new code
3. Add proper error handling
4. Test responsive design
5. Update documentation
