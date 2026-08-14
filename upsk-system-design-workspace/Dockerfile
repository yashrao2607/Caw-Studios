# ---- Stage 1: Builder ----
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/

# Install full dependencies for building
RUN npm ci

# Copy source code and Prisma schema
COPY . .

# Generate Prisma client and build application
RUN cd apps/api && npx prisma generate && npm run build

# Install production-only dependencies
RUN npm ci --omit=dev

# ---- Stage 2: Runtime ----
FROM node:20-slim

WORKDIR /app

# Install curl for HEALTHCHECK and create non-root system user
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r appgroup && useradd -r -g appgroup -s /bin/false appuser

# Copy only production dependencies and compiled artifacts from builder
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=appuser:appgroup /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./package.json
COPY --from=builder --chown=appuser:appgroup /app/apps/api/package.json ./apps/api/package.json

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

CMD ["node", "apps/api/dist/src/main.js"]
