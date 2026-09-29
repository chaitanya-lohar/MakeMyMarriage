# 0002 — One NestJS codebase and image, API and worker runtimes

**Status:** Accepted (decision A2)

## Decision

`apps/api` is a single NestJS modular monolith with two entry points:

- `src/main.ts` — HTTP API.
- `src/worker.ts` — BullMQ worker. Runs continuously as its own process, never as a
  Vercel request function (System Design §5).

Both are shipped in one Docker image (`apps/api/Dockerfile`) and differ only by start
command:

| Runtime  | Command                                    | Health port |
| -------- | ------------------------------------------ | ----------- |
| HTTP API | `node --enable-source-maps dist/main.js`   | 3001        |
| Worker   | `node --enable-source-maps dist/worker.js` | 3002        |

## Consequences

- Both runtimes share configuration, logging, MongoDB, Redis and queue setup
  (`src/core.module.ts`).
- Job processors are registered only in the worker module, so the HTTP API produces jobs
  but never consumes them.
- Failed jobs are retained for inspection and replay (System Design §22).
