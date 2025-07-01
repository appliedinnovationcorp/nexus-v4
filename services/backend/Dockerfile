# =============================================================================
# Multi-stage Dockerfile for NestJS Backend Application
# =============================================================================
# This Dockerfile creates a lean, secure production image for the NestJS API
# with proper layer caching, security hardening, and minimal attack surface.

# =============================================================================
# Stage 1: Base Dependencies
# =============================================================================
FROM node:20-alpine AS base

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    libc6-compat \
    dumb-init \
    curl && \
    rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Copy package manager files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# =============================================================================
# Stage 2: Dependencies Installation
# =============================================================================
FROM base AS deps

# Copy workspace configuration
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/shared-database/package.json ./packages/shared-database/
COPY packages/ui/package.json ./packages/ui/
COPY configs/eslint-config/package.json ./configs/eslint-config/
COPY configs/prettier-config/package.json ./configs/prettier-config/
COPY services/backend/package.json ./services/backend/

# Install all dependencies including devDependencies for build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline

# Install production dependencies separately for runtime stage
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline --prod

# =============================================================================
# Stage 3: Build Shared Packages
# =============================================================================
FROM deps AS shared-builder

# Copy shared package source code
COPY packages/shared-types ./packages/shared-types
COPY packages/shared-utils ./packages/shared-utils
COPY packages/shared-database ./packages/shared-database
COPY packages/ui ./packages/ui
COPY configs/eslint-config ./configs/eslint-config
COPY configs/prettier-config ./configs/prettier-config

# Build shared packages
RUN pnpm --filter "@nexus/shared-types" build
RUN pnpm --filter "@nexus/shared-utils" build
RUN pnpm --filter "@nexus/shared-database" build

# =============================================================================
# Stage 4: Application Builder
# =============================================================================
FROM shared-builder AS builder

# Copy application source code
COPY services/backend ./services/backend

# Set build environment variables
ENV NODE_ENV=production

# Generate Prisma client
RUN cd services/backend && pnpm db:generate

# Build the NestJS application
RUN pnpm --filter "@nexus/backend" build

# =============================================================================
# Stage 5: Production Dependencies
# =============================================================================
FROM base AS prod-deps

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/shared-database/package.json ./packages/shared-database/
COPY services/backend/package.json ./services/backend/

# Install only production dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline --prod

# Copy built shared packages
COPY --from=shared-builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=shared-builder /app/packages/shared-utils/dist ./packages/shared-utils/dist
COPY --from=shared-builder /app/packages/shared-database/dist ./packages/shared-database/dist

# Copy Prisma schema and generate client for production
COPY services/backend/prisma ./services/backend/prisma
RUN cd services/backend && npx prisma generate

# =============================================================================
# Stage 6: Production Runtime
# =============================================================================
FROM node:20-alpine AS runner

# Install security updates and runtime dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    tini \
    curl && \
    rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Copy production dependencies
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=nestjs:nodejs /app/packages ./packages

# Copy built application from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/services/backend/dist ./services/backend/dist
COPY --from=builder --chown=nestjs:nodejs /app/services/backend/prisma ./services/backend/prisma

# Copy package.json files for runtime
COPY --chown=nestjs:nodejs pnpm-workspace.yaml package.json ./
COPY --chown=nestjs:nodejs services/backend/package.json ./services/backend/

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs && \
    mkdir -p /app/uploads && \
    chown -R nestjs:nodejs /app/logs /app/uploads

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3001/health/live || exit 1

# Use tini as init system for proper signal handling
ENTRYPOINT ["tini", "--"]

# Start the application
CMD ["node", "services/backend/dist/main.js"]

# =============================================================================
# Metadata and Labels
# =============================================================================
LABEL maintainer="Nexus Team <team@nexus.local>"
LABEL description="NestJS Backend API for Nexus Workspace"
LABEL version="1.0.0"
LABEL org.opencontainers.image.title="Nexus Backend"
LABEL org.opencontainers.image.description="Production-ready NestJS backend API"
LABEL org.opencontainers.image.vendor="Nexus"
LABEL org.opencontainers.image.licenses="ISC"
LABEL org.opencontainers.image.source="https://github.com/appliedinnovationcorp/nexus-v4"
