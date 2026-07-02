# syntax=docker/dockerfile:1.7
# Multi-stage build: deps -> build -> runtime.
# Runtime image runs Next.js via its standalone bundle on port 3000.
# Build the data/ and backups/ directories into a volume for persistence.

ARG NODE_VERSION=20

# ---------- 1. Install dependencies ----------
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ---------- 2. Build the app ----------
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Ensure public/ exists in the builder so the runtime COPY --from=builder doesn't fail.
RUN mkdir -p /app/public
RUN npx prisma generate
RUN npm run build

# ---------- 3. Runtime ----------
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user with a home directory so npm/npx can write caches/logs.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs --create-home --home-dir /home/nextjs nextjs

# Copy only what standalone needs.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Persistent data + backup dirs.
RUN mkdir -p /app/data /app/backups && chown -R nextjs:nodejs /app/data /app/backups
VOLUME ["/app/data", "/app/backups"]

USER nextjs
EXPOSE 3000

# Lightweight healthcheck against the login page.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/login',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

# Copy and use an entrypoint that runs migrations + seed before starting the server.
COPY --from=builder --chown=nextjs:nodejs /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]
