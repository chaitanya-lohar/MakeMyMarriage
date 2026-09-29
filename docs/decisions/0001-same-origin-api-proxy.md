# 0001 — Browser reaches the API same-origin via a web proxy

**Status:** Accepted (decision A1)

## Decision

Browsers only ever call the web origin. The Next.js server forwards `/api/v1/*` to the
NestJS API; nothing else is forwarded.

## Consequences

- Authentication cookies (Secure, HttpOnly, SameSite — System Design §21, API Design
  §30) are first-party from the browser's perspective.
- The API does not enable CORS.
- Health probes (`/health/live`, `/health/ready`) are served by the API outside
  `/api/v1` and are not reachable through the web origin.
- The API origin is configured with the server-only `API_INTERNAL_URL`, read at build
  time. Production builds fail if it is missing or is not a bare http(s) origin.

## Implementation

- `apps/web/src/config/api-proxy.ts`, `apps/web/next.config.ts`
- `apps/api/src/bootstrap/configure-http-app.ts` (global prefix, no CORS)
- `packages/api-client` defaults to same-origin requests.
