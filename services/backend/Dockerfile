# Multi-stage Dockerfile for NestJS Backend

# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/backend/package.json ./services/backend/
COPY packages/ ./packages/
COPY libs/ ./libs/
COPY types/ ./types/
COPY utils/ ./utils/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY services/backend/ ./services/backend/
COPY tsconfig.json ./

# Build the application
RUN pnpm build --filter=@nexus/backend

# Stage 2: Production stage
FROM node:18-alpine AS production

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/backend/package.json ./services/backend/

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/services/backend/dist ./services/backend/dist
COPY --from=builder --chown=nestjs:nodejs /app/services/backend/prisma ./services/backend/prisma

# Copy startup script
COPY --chown=nestjs:nodejs services/backend/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create necessary directories
RUN mkdir -p /tmp /var/cache && \
    chown -R nestjs:nodejs /tmp /var/cache

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node services/backend/dist/health-check.js

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["./docker-entrypoint.sh"]
