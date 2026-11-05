# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN apk add --no-cache openssl && corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @fluxo/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @fluxo/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/api
RUN mkdir -p uploads && chown -R node:node uploads
USER node
EXPOSE 3333
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
