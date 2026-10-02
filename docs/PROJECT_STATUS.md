# Project status

The single place to see where MakeMyMarriage stands. Read this first.

- **Updated:** 2026-10-03, at the end of Phase 2.
- **Source of truth:** decisions live in [`decisions/`](decisions/README.md). This page only
  summarises and links; where they differ, the decision record wins.
- **Keep it current:** update this page in the same commit or PR that finishes a phase or
  changes a branch's state.

## Snapshot

| Item             | State                                                                    |
| ---------------- | ------------------------------------------------------------------------ |
| Current phase    | Phase 2 (Authentication) — built and verified; pushed, PR not yet opened |
| Next phase       | Phase 3 (Wedding setup) — **not started; waits for explicit approval**   |
| `main`           | Scaffold only (PR #1, merged 2026-09-29)                                 |
| Pushed to GitHub | all branches below                                                       |
| Live deployment  | None yet                                                                 |

### Branches

| Branch           | Contains                                         | Based on         | State                 |
| ---------------- | ------------------------------------------------ | ---------------- | --------------------- |
| `main`           | Scaffold                                         | —                | Merged, pushed        |
| `feat/home-page` | Phase 1: design system and home page (5 commits) | `main`           | Pushed, PR not opened |
| `feat/auth`      | Phase 2: authentication (13 commits)             | `feat/home-page` | Pushed, PR not opened |

`feat/auth` is stacked on `feat/home-page`: merge Phase 1's PR before Phase 2's.

## Phases

This order was proposed during Phase 1 and is being followed, but the roadmap as a whole has
not been formally approved. Each phase is approved before it starts, and any open questions
for it are raised then (0004).

| #   | Phase                               | State        | Records                           |
| --- | ----------------------------------- | ------------ | --------------------------------- |
| 0   | Scaffold (monorepo, API/worker, CI) | Done, merged | 0001–0013                         |
| 1   | Design system and home page         | Done, pushed | 0014                              |
| 2   | Authentication                      | Done, pushed | 0015                              |
| 3   | Wedding setup and dashboard shell   | Not started  | 0010, 0012                        |
| 4   | Events                              | Not started  | 0010                              |
| 5   | Guests and RSVP                     | Not started  | 0008, 0010                        |
| 6   | Invitations                         | Not started  | 0008                              |
| 7   | Tasks                               | Not started  | 0010, 0013                        |
| 8   | Expenses                            | Not started  | 0009, 0010                        |
| 9   | Vendors                             | Not started  | 0010                              |
| 10  | Organizers and permissions          | Not started  | 0012                              |
| 11  | Wedding website                     | Not started  | 0007                              |
| 12  | Gallery and QR memories             | Not started  | 0007                              |
| 13  | Live stream                         | Not started  | —                                 |
| 14  | Notifications                       | Not started  | —                                 |
| 15  | Reports                             | Not started  | 0013                              |
| 16  | Partner connection and sharing      | Not started  | 0011, 0012 — **blocked on A4/A5** |

A staging deployment (Vercel for the web app, containers for the API and worker — 0005) was
recommended after Phase 2. It is not scheduled yet and needs Vercel, AWS and MongoDB Atlas
accounts.

## What exists today (on `feat/auth`)

### Web pages

| Route                | What it is                                                   |
| -------------------- | ------------------------------------------------------------ |
| `/`                  | Marketing home page (final approved copy)                    |
| `/signup`            | Create an account                                            |
| `/login`             | Sign in, with "Remember me for 30 days"                      |
| `/forgot-password`   | Request a reset email                                        |
| `/reset-password`    | Set a new password from the emailed link; expired-link state |
| `/dashboard`         | Minimal signed-in page with Sign Out (replaced in Phase 3)   |
| `/privacy`, `/terms` | Placeholders — legal text not yet provided                   |

### API endpoints (`/api/v1`)

| Endpoint                     | Purpose                    |
| ---------------------------- | -------------------------- |
| `POST /auth/register`        | Create account and sign in |
| `POST /auth/login`           | Sign in                    |
| `POST /auth/refresh`         | Rotate the session         |
| `POST /auth/logout`          | Sign out                   |
| `POST /auth/forgot-password` | Request a reset email      |
| `POST /auth/reset-password`  | Set a new password         |
| `GET /me`                    | Current user               |

Health checks: `GET /health/live` and `/health/ready` on the API (3001) and worker (3002).

### Backend modules

`users`, `auth` (in `apps/api/src/modules/`). Shared infrastructure: config, logging,
MongoDB, Redis, BullMQ queues, rate limiting, email outbox (worker sends via Mailpit locally,
Resend later).

### Designs (Google Stitch project `11709379677369700007`)

| Screen                                               | Built as                     |
| ---------------------------------------------------- | ---------------------------- |
| Premium Modern Indian Wedding Platform (V1 Approved) | `/`                          |
| Sign In (V1) (`13df968e…`)                           | `/login`, `/forgot-password` |
| Sign Up                                              | `/signup`                    |
| Reset Password, Reset Link Expired                   | `/reset-password`            |
| Signed In (Phase 2 placeholder)                      | `/dashboard`                 |
| Wedding Command Center Dashboard                     | Not built (Phase 3+)         |

Design system "Regal Modernity" (0014) applies to every screen.

## Open decisions and blockers

| Item                                                      | Blocks              | Owner   |
| --------------------------------------------------------- | ------------------- | ------- |
| A4 — what partners share by default (0011)                | Phase 16            | Product |
| A5 — what happens on partner disconnect (0011)            | Phase 16            | Product |
| Usage rights for the Stitch-generated photos              | Public launch       | Product |
| Privacy Policy and Terms of Service text                  | Public launch       | Legal   |
| Resend account and DNS for `makemymarriage.com`           | Real email delivery | Ops     |
| Delete the outdated first "Sign In (V1)" screen in Stitch | Housekeeping        | Product |
| Staging deployment accounts (Vercel, AWS, Atlas)          | Staging             | Ops     |

## Working rules

- The PRD and the decision records define V1. Nothing outside V1 is built or advertised.
- Conflicts between documents are raised with the protocol in 0004 and decided by the
  product owner before any code is written.
- One module or phase at a time; each starts only after explicit approval.
- Nothing is pushed and no PR is opened without explicit approval.
- UI follows the approved Stitch screens; missing screens are designed in Stitch and approved
  first.
- Small, logical commits. Run Prettier from the repository root (running it inside a package
  skips `.prettierignore` and reformats generated files).

## Run and verify

See the [README](../README.md) for full setup. In short:

```sh
pnpm install
pnpm infra:up      # MongoDB, Redis, Mailpit
pnpm dev           # web :3000, API :3001, worker :3002
```

Checks: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm build`.
Last full run (clean clone of `feat/auth`, 2026-10-03): all green — 57 web unit, 19 API unit,
29 integration tests.

## Change log

| Date       | Change                                                                    |
| ---------- | ------------------------------------------------------------------------- |
| 2026-10-03 | `feat/home-page` and `feat/auth` pushed to GitHub; PRs not yet opened.    |
| 2026-10-03 | Page created. Phase 2 (Authentication) built and verified on `feat/auth`. |
| 2026-10-01 | Phase 1 (design system and home page) built on `feat/home-page`.          |
| 2026-09-29 | Scaffold merged to `main` (PR #1).                                        |
