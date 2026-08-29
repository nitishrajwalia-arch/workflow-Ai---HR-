# Marbella HR web app.
#
# Build from the REPOSITORY ROOT:
#     docker build -f apps/web/Dockerfile -t marbella-web .
#
# The result is static files served by nginx. There is no Node process in the
# final image: a single-page app does not need one, and not having one removes
# a whole class of runtime problems.

FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web

RUN npm run build -w @marbella/shared \
 && npm run build -w @marbella/web

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ >/dev/null || exit 1
