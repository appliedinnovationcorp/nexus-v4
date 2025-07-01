# NestJS Backend Service - Docker Setup

This directory contains the Docker configuration for the NestJS backend service with a multi-stage build optimized for production.

## 🐳 Multi-Stage Dockerfile

The Dockerfile uses a two-stage build process:

### Stage 1: Builder
- **Base**: `node:20-alpine`
- **Purpose**: Install dependencies and build the application
- **Actions**:
  - Install all dependencies (including devDependencies)
  - Generate Prisma client
  - Build the NestJS application
  - Install production-only dependencies

### Stage 2: Runtime
- **Base**: `node:20-alpine`
- **Purpose**: Minimal runtime environment
- **Includes**:
  - `dist/` folder (compiled application)
  - `node_modules/` (production dependencies only)
  - `prisma/` folder (schema and generated client)
  - `package.json` (for runtime metadata)

## 📦 Image Optimization

The multi-stage build results in a lean production image:

- **Development image**: ~1.5GB
- **Production image**: ~220MB (85% reduction)
- **Security**: Non-root user execution
- **Init system**: Tini for proper signal handling

## 🚀 Building the Image

### Using the build script (recommended):

```bash
# Build with defaults
./build.sh

# Build specific version
./build.sh --tag v1.0.0

# Build and push to registry
./build.sh --tag v1.0.0 --push

# Build for ARM64
./build.sh --platform linux/arm64

# Build without cache
./build.sh --no-cache
```

### Using Docker directly:

```bash
# From project root
docker build -f services/backend/Dockerfile -t nexus/backend:latest .

# Multi-platform build
docker buildx build --platform linux/amd64,linux/arm64 -f services/backend/Dockerfile -t nexus/backend:latest .
```

## 🏃 Running the Container

### Using Docker Compose (recommended):

```bash
# Start the backend service
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop the service
docker-compose down
```

### Using Docker directly:

```bash
# Run with environment variables
docker run -d \
  --name nexus-backend \
  -p 3001:3001 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e MONGODB_URL="mongodb://user:pass@host:27017/db" \
  -e REDIS_URL="redis://:pass@host:6379" \
  nexus/backend:latest

# Run with volume mounts
docker run -d \
  --name nexus-backend \
  -p 3001:3001 \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/uploads:/app/uploads \
  nexus/backend:latest
```

## 🔧 Environment Variables

Required environment variables:

```bash
# Database connections
DATABASE_URL=postgresql://user:password@host:5432/database
MONGODB_URL=mongodb://user:password@host:27017/database?authSource=admin
REDIS_URL=redis://:password@host:6379

# Security
JWT_SECRET=your-jwt-secret-key
SESSION_SECRET=your-session-secret-key

# Application
NODE_ENV=production
PORT=3001
```

## 🏥 Health Checks

The container includes built-in health checks:

```bash
# Check container health
docker ps

# Manual health check
curl http://localhost:3001/health/live

# Detailed health information
curl http://localhost:3001/health/ready
```

Health check endpoints:
- `/health/live` - Liveness probe (container is running)
- `/health/ready` - Readiness probe (application is ready to serve traffic)
- `/health` - General health check with system information

## 📁 Container Structure

```
/app/
├── dist/           # Compiled NestJS application
├── node_modules/   # Production dependencies only
├── prisma/         # Prisma schema and generated client
├── package.json    # Runtime metadata
├── logs/           # Application logs (volume mount)
└── uploads/        # File uploads (volume mount)
```

## 🔒 Security Features

- **Non-root execution**: Runs as `nestjs` user (UID 1001)
- **Minimal base**: Alpine Linux with security updates
- **Read-only filesystem**: Container filesystem is read-only
- **Resource limits**: Memory and CPU constraints
- **Health monitoring**: Built-in health checks
- **Signal handling**: Proper shutdown with Tini init system

## 🐛 Troubleshooting

### Common Issues

#### Build fails with dependency errors:
```bash
# Clear build cache
docker builder prune

# Build without cache
./build.sh --no-cache
```

#### Container fails to start:
```bash
# Check logs
docker logs nexus-backend

# Check health
docker exec nexus-backend curl -f http://localhost:3001/health/live
```

#### Database connection issues:
```bash
# Verify environment variables
docker exec nexus-backend env | grep -E "(DATABASE|MONGODB|REDIS)_URL"

# Test database connectivity
docker exec nexus-backend node -e "console.log(process.env.DATABASE_URL)"
```

#### Permission issues:
```bash
# Check file ownership
docker exec nexus-backend ls -la /app

# Check user
docker exec nexus-backend whoami
```

### Debug Mode

Run container in debug mode:

```bash
# Interactive shell
docker run -it --rm nexus/backend:latest sh

# Override entrypoint
docker run -it --rm --entrypoint sh nexus/backend:latest

# Debug with logs
docker run --rm -e DEBUG=* nexus/backend:latest
```

## 📊 Performance Monitoring

Monitor container performance:

```bash
# Resource usage
docker stats nexus-backend

# Container processes
docker exec nexus-backend ps aux

# Memory usage
docker exec nexus-backend cat /proc/meminfo

# Disk usage
docker exec nexus-backend df -h
```

## 🔄 Development Workflow

1. **Make changes** to the backend code
2. **Build new image**: `./build.sh --tag dev`
3. **Test locally**: `docker-compose up -d`
4. **Verify health**: `curl http://localhost:3001/health/ready`
5. **Check logs**: `docker-compose logs -f backend`
6. **Push to registry**: `./build.sh --tag v1.0.0 --push`

## 📚 Additional Resources

- [Docker Multi-stage builds](https://docs.docker.com/develop/dev-best-practices/dockerfile_best-practices/#use-multi-stage-builds)
- [Node.js Docker best practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)
- [NestJS Production deployment](https://docs.nestjs.com/deployment)
- [Prisma in Docker](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-docker)
