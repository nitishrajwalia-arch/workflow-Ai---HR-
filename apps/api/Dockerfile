# Marbella HR API.
#
# Multi-stage, so the image that runs in production contains the compiled
# JavaScript and the production dependencies — not the TypeScript compiler,
# not the test suite, not 300 MB of dev tooling.
#
# Build from the REPOSITORY ROOT, not from this directory:
#     docker build -f apps/api/Dockerfile -t marbella-api .
# The API depends on the shared workspace package, which lives outside this
# folder and would not be in the build context otherwise.

# ---------------------------------------------------------------- build
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Manifests first. Docker caches this layer, so a code change does not force
# a full reinstall of every dependency.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# `--ignore-scripts` because the api package's `prepare` runs prisma generate,
# which needs the schema — and the schema is not copied yet.
RUN npm ci --ignore-scripts

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

RUN npm run build -w @marbella/shared \
 && npm run build -w @marbella/api

# Drop dev dependencies from node_modules, keeping the generated Prisma client.
RUN npm prune --omit=dev --ignore-scripts

# ------------------------------------------------------------------ run
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

# OpenSSL is what Prisma's query engine links against.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Never run as root. The node image ships an unprivileged `node` user.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=node:node /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts

RUN mkdir -p /data/uploads && chown -R node:node /data
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/apps/api

# Migrations run at start, not at build: the database does not exist at build
# time. `migrate deploy` only applies migrations that already exist — it never
# generates one and never drops anything, which is what makes it safe here.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
