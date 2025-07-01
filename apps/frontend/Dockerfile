# =============================================================================
# Multi-stage Dockerfile for Next.js Frontend Application
# =============================================================================
# Builder stage for dependencies and compilation, minimal Alpine runtime stage
# Uses Next.js standalone output for optimal production deployment

# =============================================================================
# Stage 1: Builder - Install dependencies and build the application
# =============================================================================
FROM node:24-alpine AS builder

# Install build dependencies
RUN apk add --no-cache libc6-compat

# Set working directory
WORKDIR /app

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/ui/package.json ./packages/ui/
COPY configs/eslint-config/package.json ./configs/eslint-config/
COPY configs/prettier-config/package.json ./configs/prettier-config/

# Install all dependencies (including devDependencies for building)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Copy shared packages source code and build them
COPY packages/ ./packages/
COPY configs/ ./configs/

# Build shared packages in dependency order
RUN pnpm --filter "@nexus/shared-types" build
RUN pnpm --filter "@nexus/shared-utils" build
RUN pnpm --filter "@nexus/ui" build

# Copy frontend source code
COPY apps/frontend ./apps/frontend

# Set build environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application with standalone output
RUN pnpm --filter "@nexus/frontend" build

# =============================================================================
# Stage 2: Runtime - Minimal Alpine image with standalone output
# =============================================================================
FROM node:24-alpine AS runtime

# Install runtime dependencies
RUN apk add --no-cache dumb-init tini curl

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy standalone output from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/public ./apps/frontend/public

# Create cache directory with proper permissions
RUN mkdir -p .next/cache && \
    chown -R nextjs:nodejs .next/cache

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Use tini as init system
ENTRYPOINT ["tini", "--"]

# Start the application using the standalone server
CMD ["node", "apps/frontend/server.js"]
