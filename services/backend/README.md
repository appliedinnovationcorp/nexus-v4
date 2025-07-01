# Nexus Backend Service

A robust NestJS backend service built for the Nexus workspace with modern features and best practices.

## Features

- **NestJS Framework**: Built with the progressive Node.js framework
- **TypeScript**: Full TypeScript support with strict mode
- **Swagger Documentation**: Auto-generated API documentation
- **Environment Configuration**: Flexible configuration management
- **Health Checks**: Built-in health monitoring endpoints
- **Validation**: Request/response validation with class-validator
- **CORS Support**: Configurable cross-origin resource sharing
- **Docker Ready**: Production-ready Docker configuration

## Quick Start

### Development
```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Build for production
pnpm run build

# Start production server
pnpm run start:prod
```

### Docker
```bash
# Build Docker image
docker build -t nexus-backend .

# Run container
docker run -p 3001:3000 nexus-backend
```

## API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:3001/api/docs
- **Health Check**: http://localhost:3001/api/health
- **Ready Check**: http://localhost:3001/api/health/ready
- **Live Check**: http://localhost:3001/api/health/live

## Configuration

Environment variables can be configured in `.env` file:

```env
NODE_ENV=development
PORT=3001
API_PREFIX=api
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=3600
```

## Project Structure

```
src/
├── common/           # Shared DTOs and utilities
│   └── dto/         # Data transfer objects
├── config/          # Configuration modules
├── health/          # Health check endpoints
├── app.controller.ts
├── app.module.ts
├── app.service.ts
└── main.ts
```

## Available Scripts

- `pnpm run build` - Build the application
- `pnpm run dev` - Start development server with hot reload
- `pnpm run start` - Start production server
- `pnpm run start:prod` - Start optimized production server
- `pnpm run test` - Run unit tests
- `pnpm run test:e2e` - Run end-to-end tests
- `pnpm run lint` - Lint and fix code
- `pnpm run format` - Format code with Prettier

## Health Monitoring

The service includes comprehensive health checks:

- **Memory Usage**: Monitors heap and RSS memory
- **Disk Usage**: Monitors storage availability
- **Application Status**: Ready and live endpoints for Kubernetes

## Development Guidelines

1. **API Design**: Follow RESTful principles
2. **Validation**: Use DTOs with class-validator decorators
3. **Documentation**: Add Swagger decorators to all endpoints
4. **Error Handling**: Use NestJS exception filters
5. **Testing**: Write unit and integration tests
6. **Security**: Implement authentication and authorization

## Deployment

The service is containerized and ready for deployment to:
- Docker containers
- Kubernetes clusters
- Cloud platforms (AWS, GCP, Azure)

## Contributing

1. Follow the established code style
2. Add tests for new features
3. Update documentation
4. Ensure all health checks pass
