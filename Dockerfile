# syntax=docker/dockerfile:1
# The ideaproxima image: the API process serving the built web app and /v1 on one port. Build from the repository
# root:
#   docker build -t ideaproxima .
# Release steps (run once per deploy, before starting new instances):
#   docker run --rm -e DATABASE_URL=… ideaproxima node apps/api/dist/migrate.js
#   docker run --rm -e DATABASE_URL=… ideaproxima node apps/api/dist/seed.js        # base topics, idempotent
# First admin of a fresh deployment:
#   docker run --rm -e DATABASE_URL=… ideaproxima node apps/api/dist/set-role.js <handle> admin
# Locally, docker-compose.yml runs all of this for you: `docker compose up --build`.
#
# Install scripts are skipped (--ignore-scripts): the only packages that have one ship their binaries through
# optional dependencies anyway (the same decision as `allowScripts` in the root package.json).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/api apps/api
COPY apps/web apps/web
# Web app (static files) first, then the API bundle and operator commands.
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# Production dependencies of the API only: the web app is bundled, so its packages are all dev dependencies.
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --ignore-scripts
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/web/dist apps/web/dist
COPY apps/api/drizzle apps/api/drizzle
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/v1/health >/dev/null || exit 1
CMD ["node", "apps/api/dist/main.js"]
