# syntax=docker/dockerfile:1
#
# One image for both backend runtimes (decision A2). Build from the repository root:
#
#   docker build -f apps/api/Dockerfile -t makemymarriage-api .
#
#   HTTP API: docker run makemymarriage-api                (default command)
#   Worker:   docker run makemymarriage-api node --enable-source-maps dist/worker.js

ARG NODE_VERSION=24.19.0

FROM node:${NODE_VERSION}-alpine AS build
RUN npm install --global pnpm@12.6.0
WORKDIR /repo

# Install dependencies first so this layer is cached until a manifest changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @makemymarriage/api...

COPY packages/tsconfig packages/tsconfig
COPY apps/api apps/api
RUN pnpm --filter @makemymarriage/api build \
 && pnpm --filter @makemymarriage/api deploy --prod --legacy /out \
 && rm -rf /out/dist && cp -r apps/api/dist /out/dist

FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
USER node
# 3001: HTTP API. 3002: worker health probes.
EXPOSE 3001 3002
CMD ["node", "--enable-source-maps", "dist/main.js"]
