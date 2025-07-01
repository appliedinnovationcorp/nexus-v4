# =============================================================================
# Multi-stage Dockerfile for Complete Nexus Workspace
# =============================================================================
# This Dockerfile builds the entire workspace with all shared packages
# and can be used to create images for specific applications.

ARG NODE_VERSION=20
ARG ALPINE_VERSION=3.19

# =============================================================================
# Stage 1: Base Image with Security Updates
# =============================================================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS base

# Install security updates and essential packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    libc6-compat \
    dumb-init \
    tini \
    curl \
    wget && \
    rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Enable pnpm and set environment
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production
RUN corepack enable

# =============================================================================
# Stage 2: Dependencies and Workspace Setup
# =============================================================================
FROM base AS workspace

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy all package.json files for dependency resolution
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/shared-database/package.json ./packages/shared-database/
COPY packages/ui/package.json ./packages/ui/
COPY configs/eslint-config/package.json ./configs/eslint-config/
COPY configs/prettier-config/package.json ./configs/prettier-config/
COPY apps/frontend/package.json ./apps/frontend/
COPY services/backend/package.json ./services/backend/

# Install all dependencies with cache mount
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline

# =============================================================================
# Stage 3: Build All Shared Packages
# =============================================================================
FROM workspace AS shared-packages

# Copy shared package source code
COPY packages/ ./packages/
COPY configs/ ./configs/

# Build shared packages in dependency order
RUN pnpm --filter "@nexus/prettier-config" build || true
RUN pnpm --filter "@nexus/eslint-config" build || true
RUN pnpm --filter "@nexus/shared-types" build
RUN pnpm --filter "@nexus/shared-utils" build
RUN pnpm --filter "@nexus/shared-database" build
RUN pnpm --filter "@nexus/ui" build

# =============================================================================
# Stage 4: Frontend Application
# =============================================================================
FROM shared-packages AS frontend

# Copy frontend source code
COPY apps/frontend/ ./apps/frontend/

# Set Next.js environment variables
ENV NEXT_TELEMETRY_DISABLED=1

# Build frontend application
RUN pnpm --filter "@nexus/frontend" build

# =============================================================================
# Stage 5: Backend Application
# =============================================================================
FROM shared-packages AS backend

# Copy backend source code
COPY services/backend/ ./services/backend/

# Generate Prisma client
RUN cd services/backend && pnpm db:generate

# Build backend application
RUN pnpm --filter "@nexus/backend" build

# =============================================================================
# Stage 6: Production Frontend Runtime
# =============================================================================
FROM base AS frontend-runner

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy built frontend application
COPY --from=frontend --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=frontend --chown=nextjs:nodejs /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=frontend --chown=nextjs:nodejs /app/apps/frontend/public ./apps/frontend/public

# Create cache directory
RUN mkdir -p /app/.next/cache && \
    chown -R nextjs:nodejs /app/.next/cache

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["tini", "--"]
CMD ["node", "apps/frontend/server.js"]

# =============================================================================
# Stage 7: Production Backend Runtime
# =============================================================================
FROM base AS backend-runner

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Set environment variables
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Copy production dependencies
COPY --from=backend --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=backend --chown=nestjs:nodejs /app/packages ./packages

# Copy built backend application
COPY --from=backend --chown=nestjs:nodejs /app/services/backend/dist ./services/backend/dist
COPY --from=backend --chown=nestjs:nodejs /app/services/backend/prisma ./services/backend/prisma

# Copy package files
COPY --chown=nestjs:nodejs pnpm-workspace.yaml package.json ./
COPY --chown=nestjs:nodejs services/backend/package.json ./services/backend/

# Create necessary directories
RUN mkdir -p /app/logs /app/uploads && \
    chown -R nestjs:nodejs /app/logs /app/uploads

USER nestjs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3001/health/live || exit 1

ENTRYPOINT ["tini", "--"]
CMD ["node", "services/backend/dist/main.js"]

# =============================================================================
# Default Stage (Frontend)
# =============================================================================
FROM frontend-runner AS default

# =============================================================================
# Metadata and Labels
# =============================================================================
LABEL maintainer="Nexus Team <team@nexus.local>"
LABEL description="Nexus Workspace - Full-Stack Application"
LABEL version="1.0.0"
LABEL org.opencontainers.image.title="Nexus Workspace"
LABEL org.opencontainers.image.description="Production-ready full-stack application with Next.js and NestJS"
LABEL org.opencontainers.image.vendor="Nexus"
LABEL org.opencontainers.image.licenses="ISC"
LABEL org.opencontainers.image.source="https://github.com/appliedinnovationcorp/nexus-v4"
