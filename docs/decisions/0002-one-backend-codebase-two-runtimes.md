# 0002 — One NestJS codebase and image, API and worker runtimes

**Status:** Accepted (decision A2); amended by 0025 — there is no worker runtime and no Docker
image. The API is the only runtime.

## Decision

`apps/api` is a single NestJS modular monolith with two entry points:

- `src/main.ts` — HTTP API.
- `src/worker.ts` — BullMQ worker. Runs continuously in its own container, never as a
  Vercel request function (System Design §5, API Design §27).

Both are shipped in one Docker image (`apps/api/Dockerfile`) and differ only by start
command. In production each runs as its own container (see 0005).

| Runtime  | Command                                    | Port                 |
| -------- | ------------------------------------------ | -------------------- |
| HTTP API | `node --enable-source-maps dist/main.js`   | 3001                 |
| Worker   | `node --enable-source-maps dist/worker.js` | 3002 (health probes) |

## Consequences

- Both runtimes share configuration, logging, MongoDB, Redis and queue setup
  (`src/core.module.ts`).
- Job processors are registered only in the worker module, so the HTTP API produces jobs
  but never consumes them.
- Failed jobs are retained for inspection and replay (System Design §22).
