# =============================================================================
# Multi-stage Dockerfile for NestJS Backend Service
# =============================================================================
# Builder stage for dependencies and compilation, minimal Alpine runtime stage

# =============================================================================
# Stage 1: Builder - Install dependencies and build the application
# =============================================================================
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache libc6-compat

# Set working directory
WORKDIR /app

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml ./
COPY services/backend/package.json ./services/backend/

# Install all dependencies (including devDependencies for building)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source code
COPY services/backend ./services/backend

# Generate Prisma client
RUN cd services/backend && pnpm db:generate

# Build the application
RUN cd services/backend && pnpm build

# Install production dependencies only
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

# =============================================================================
# Stage 2: Runtime - Minimal Alpine image with only necessary files
# =============================================================================
FROM node:20-alpine AS runtime

# Install runtime dependencies
RUN apk add --no-cache dumb-init tini curl

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001

# Copy built application from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/services/backend/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/services/backend/prisma ./prisma

# Copy package.json for runtime
COPY --from=builder --chown=nestjs:nodejs /app/services/backend/package.json ./package.json

# Create necessary directories
RUN mkdir -p logs uploads && \
    chown -R nestjs:nodejs logs uploads

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3001/health/live || exit 1

# Use tini as init system
ENTRYPOINT ["tini", "--"]

# Start the application
CMD ["node", "dist/main.js"]
