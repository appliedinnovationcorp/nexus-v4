# =============================================================================
# Multi-stage Dockerfile for Next.js Frontend Application
# =============================================================================
# This Dockerfile creates a lean, secure production image for the Next.js app
# with proper layer caching, security hardening, and minimal attack surface.

# =============================================================================
# Stage 1: Base Dependencies
# =============================================================================
FROM node:20-alpine AS base

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    libc6-compat \
    dumb-init && \
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
COPY apps/frontend/package.json ./apps/frontend/

# Install dependencies with frozen lockfile for reproducible builds
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline

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
RUN pnpm --filter "@nexus/ui" build

# =============================================================================
# Stage 4: Application Builder
# =============================================================================
FROM shared-builder AS builder

# Copy application source code
COPY apps/frontend ./apps/frontend

# Set build environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application
RUN pnpm --filter "@nexus/frontend" build

# =============================================================================
# Stage 5: Production Runtime
# =============================================================================
FROM node:20-alpine AS runner

# Install security updates and runtime dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    tini && \
    rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/public ./apps/frontend/public

# Create necessary directories with proper permissions
RUN mkdir -p /app/.next/cache && \
    chown -R nextjs:nodejs /app/.next/cache

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Use tini as init system for proper signal handling
ENTRYPOINT ["tini", "--"]

# Start the application
CMD ["node", "apps/frontend/server.js"]

# =============================================================================
# Metadata and Labels
# =============================================================================
LABEL maintainer="Nexus Team <team@nexus.local>"
LABEL description="Next.js Frontend Application for Nexus Workspace"
LABEL version="1.0.0"
LABEL org.opencontainers.image.title="Nexus Frontend"
LABEL org.opencontainers.image.description="Production-ready Next.js frontend application"
LABEL org.opencontainers.image.vendor="Nexus"
LABEL org.opencontainers.image.licenses="ISC"
LABEL org.opencontainers.image.source="https://github.com/appliedinnovationcorp/nexus-v4"
