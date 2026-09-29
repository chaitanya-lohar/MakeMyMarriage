# MakeMyMarriage

Wedding planning and management platform for Indian weddings.

| Path                     | What it is                                                          |
| ------------------------ | ------------------------------------------------------------------- |
| `apps/web`               | Next.js web app; proxies `/api/v1/*` to the API                     |
| `apps/api`               | NestJS modular monolith: HTTP API (`main.ts`), worker (`worker.ts`) |
| `packages/api-client`    | Typed client generated from the API's OpenAPI contract              |
| `packages/tsconfig`      | Shared strict TypeScript configurations                             |
| `packages/eslint-config` | Shared ESLint configurations, including module boundaries           |
| `docs/specs`             | Approved specifications                                             |
| `docs/decisions`         | Decision records                                                    |

## Prerequisites

- Node.js 24 (see `.nvmrc`)
- pnpm 12 (`packageManager` in `package.json`)
- Docker (local MongoDB and Redis)

## Local development

```sh
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm infra:up        # MongoDB (single-node replica set) + Redis
pnpm dev             # web :3000, API :3001, worker health :3002
```

- Web: http://localhost:3000
- API through the web proxy: http://localhost:3000/api/v1/…
- API docs (when `OPENAPI_DOCS_ENABLED=true`): http://localhost:3001/api/v1/docs
- Health: http://localhost:3001/health/ready and http://localhost:3002/health/ready

## Checks

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test               # unit tests
pnpm test:integration   # needs Redis (pnpm infra:up); MongoDB runs in memory
pnpm build
pnpm api:contract       # regenerate the OpenAPI contract and client types
```

CI (`.github/workflows/ci.yml`) runs all of the above, fails on OpenAPI contract drift and
builds the Docker image.

## Docker

```sh
docker compose --profile app up -d --build   # API + worker from the production image
```
