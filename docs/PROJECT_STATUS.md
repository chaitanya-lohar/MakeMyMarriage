# Project status

The single place to see where MakeMyMarriage stands. Read this first.

- **Updated:** 2026-10-11, after merging decisions 0020–0022 (PR #10).
- **Source of truth:** the canonical documents listed in the [documentation index](README.md)
  and the decision records in [`decisions/`](decisions/README.md). This page only summarises
  and links; where they differ, the decision record wins.
- **Keep it current:** update this page in the same commit or PR that finishes a phase or
  changes a branch's state.

## Snapshot

| Item            | State                                                                                                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current phase   | Phase 3 (Wedding setup) — done and merged to `main` (PR #5, 0016)                                                                                                                                         |
| Next phase      | Phase 4 (Events, guests, RSVP and invitations) — requirements, design decisions, Stitch screens and dashboard API contract approved (0017–0022, Phase 4 PRD v1.2); **not started**; open: Phase 4 wording |
| `main`          | Scaffold, Phases 1–3, code-review and manual-testing fixes (PRs #1–6); documentation and decisions 0017–0022 (PRs #8–10)                                                                                  |
| Open PRs        | None                                                                                                                                                                                                      |
| Live deployment | None yet                                                                                                                                                                                                  |

### Branches

Every branch below is merged into `main`; new work starts from `main`.

| Branch                          | Contains                                                | State           |
| ------------------------------- | ------------------------------------------------------- | --------------- |
| `main`                          | Everything below                                        | Up to date      |
| `feat/home-page`                | Phase 1: design system and home page                    | Merged (PR #2)  |
| `feat/auth`                     | Phase 2: authentication                                 | Merged (PR #3)  |
| `chore/pre-phase-3`             | The three branches below, `.mcp.json`, this page        | Merged (PR #4)  |
| ↳ `fix/auth-hardening`          | Code-review fixes (4 commits)                           | Merged via #4   |
| ↳ `fix/auth-test-findings`      | Manual-testing fixes (3 commits)                        | Merged via #4   |
| ↳ `docs/status-after-phase-2`   | This page after the Phase 1/2 merges (1 commit)         | Merged via #4   |
| `feat/weddings`                 | Phase 3: wedding setup and dashboard shell              | Merged (PR #5)  |
| `fix/workspace-logo-home`       | Workspace logo opens the home page (manual-testing fix) | Merged (PR #6)  |
| `docs/consolidation`            | Consolidated documentation, decisions 0017–0018         | Merged (PR #8)  |
| `docs/phase-4-design-decisions` | Decision 0019 and the matching spec updates             | Merged (PR #9)  |
| `docs/regenerate-email-status`  | Decisions 0020–0022 and the matching spec updates       | Merged (PR #10) |

The merged branches can be deleted, on GitHub and locally.

## Phases

This order was proposed during Phase 1 and is being followed. On 2026-10-10 the product owner
approved combining events, guests and RSVP, and invitations into one Phase 4 (answer Q3); the
later phases keep their numbers. Each phase is approved before it starts, and any open
questions for it are raised then (0004).

| #   | Phase                                | State                 | Records                                                         |
| --- | ------------------------------------ | --------------------- | --------------------------------------------------------------- |
| 0   | Scaffold (monorepo, API/worker, CI)  | Done, merged          | 0001–0013                                                       |
| 1   | Design system and home page          | Done, merged          | 0014                                                            |
| 2   | Authentication                       | Done, merged          | 0015                                                            |
| 3   | Wedding setup and dashboard shell    | Done, merged          | 0010, 0012, 0016                                                |
| 4   | Events, guests, RSVP and invitations | Approved, not started | 0008, 0010, 0017–0022; [Phase 4 PRD](specs/PHASE_4_PRD_v1.2.md) |
| 5   | (merged into Phase 4)                | —                     | —                                                               |
| 6   | (merged into Phase 4)                | —                     | —                                                               |
| 7   | Tasks                                | Not started           | 0010, 0013                                                      |
| 8   | Expenses                             | Not started           | 0009, 0010                                                      |
| 9   | Vendors                              | Not started           | 0010                                                            |
| 10  | Organizers and permissions           | Not started           | 0012                                                            |
| 11  | Wedding website                      | Not started           | 0007                                                            |
| 12  | Gallery and QR memories              | Not started           | 0007                                                            |
| 13  | Live stream                          | Not started           | —                                                               |
| 14  | Notifications                        | Not started           | —                                                               |
| 15  | Reports                              | Not started           | 0013                                                            |
| 16  | Partner connection and sharing       | Not started           | 0011, 0012 — **blocked on A4/A5**                               |

A staging deployment (Vercel for the web app, containers for the API and worker — 0005) was
recommended after Phase 2. It is not scheduled yet and needs Vercel, AWS and MongoDB Atlas
accounts.

## What exists today (on `main`)

### Web pages

| Route                | What it is                                                             |
| -------------------- | ---------------------------------------------------------------------- |
| `/`                  | Marketing home page (final approved copy)                              |
| `/signup`            | Create an account                                                      |
| `/login`             | Sign in, with "Remember me for 30 days"                                |
| `/forgot-password`   | Request a reset email                                                  |
| `/reset-password`    | Set a new password from the emailed link; expired-link state           |
| `/dashboard`         | "No wedding yet" (S2), or the wedding dashboard with countdown (S4)    |
| `/wedding/new`       | Create your wedding (S3)                                               |
| `/wedding`           | Wedding details: edit and save (S5)                                    |
| (workspace)          | Sidebar and user menu, mobile drawer, loading (S1), not available (S6) |
| `/privacy`, `/terms` | Placeholders — legal text not yet provided                             |

- A signed-in user who opens `/login`, `/signup` or `/forgot-password` goes to `/dashboard`;
  a malformed email shows "Please enter a valid email address." under the field (0015).
- In the workspace, the logo opens the home page; Dashboard in the navigation leads back
  (0016).

### API endpoints (`/api/v1`)

| Endpoint                      | Purpose                                          |
| ----------------------------- | ------------------------------------------------ |
| `POST /auth/register`         | Create account and sign in                       |
| `POST /auth/login`            | Sign in                                          |
| `POST /auth/refresh`          | Rotate the session                               |
| `POST /auth/logout`           | Sign out                                         |
| `POST /auth/forgot-password`  | Request a reset email                            |
| `POST /auth/reset-password`   | Set a new password                               |
| `GET /me`                     | Current user                                     |
| `POST /weddings`              | Create the user's wedding; the user is its owner |
| `GET /weddings`               | Weddings the user is an active member of         |
| `GET /weddings/{weddingId}`   | One wedding (members only; otherwise 404)        |
| `PATCH /weddings/{weddingId}` | Update the wedding's details                     |

Health checks: `GET /health/live` and `/health/ready` on the API (3001) and worker (3002).

### Backend modules

`users`, `auth`, `weddings` (`weddings` collection) and `workspace` (`wedding_memberships`,
the membership check for wedding routes), in `apps/api/src/modules/`. Creating a wedding
writes the wedding and its owner membership in one transaction. Shared infrastructure:
config, logging, MongoDB, Redis, BullMQ queues, rate limiting, email outbox (worker sends via
Mailpit locally, Resend later).

### Designs (Google Stitch project `11709379677369700007`)

| Screen                                               | Built as                                            |
| ---------------------------------------------------- | --------------------------------------------------- |
| Premium Modern Indian Wedding Platform (V1 Approved) | `/`                                                 |
| Sign In (V1) (`13df968e…`)                           | `/login`, `/forgot-password`                        |
| Sign Up                                              | `/signup`                                           |
| Reset Password, Reset Link Expired                   | `/reset-password`                                   |
| "P3 · S1"–"P3 · S6" (corrected as listed in 0016)    | Workspace, `/dashboard`, `/wedding/new`, `/wedding` |
| Wedding Command Center Dashboard                     | Not built                                           |

Design system "Regal Modernity" (0014) applies to every screen.

**Phase 4 screens ("P4 ·") are approved (0021, 2026-10-11).** They cover O2–O10, G1–G5, the
mobile navigation drawer, a states board and the copy-drafts board.

- 0021 lists the approved screen IDs and the corrections to apply in code: shell and logo,
  navy buttons, the O8 desktop content, link-state labels, and design annotations.
- The drafted wording is recorded in 0021 and still awaits approval. 0021 also approves
  the dashboard display rule (at most five upcoming events) and the email rule for missing
  wedding details.
- Several titles exist more than once in Stitch. Only the IDs in 0021 are used; the other
  Phase 4 screens are stale and are left untouched.

## Open decisions and blockers

| Item                                                                                                                     | Blocks              | Owner         |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------- | ------------- |
| A4 — what partners share by default (0011)                                                                               | Phase 16            | Product       |
| A5 — what happens on partner disconnect (0011)                                                                           | Phase 16            | Product       |
| Usage rights for the Stitch-generated photos                                                                             | Public launch       | Product       |
| Privacy Policy and Terms of Service text                                                                                 | Public launch       | Legal         |
| Resend account and DNS for `makemymarriage.com`                                                                          | Real email delivery | Ops           |
| Delete the outdated first "Sign In (V1)" screen in Stitch                                                                | Housekeeping        | Product       |
| Staging deployment accounts (Vercel, AWS, Atlas)                                                                         | Staging             | Ops           |
| Forgot-password response time hints whether an email is registered (code review, deferred)                               | Public launch       | Engineering   |
| Reset email says "signs you out on all your devices", but access tokens live ≤15 min (0015) — reword or revoke instantly | Public launch       | Product       |
| Phase 4 wording on the copy-drafts screen: confirm or change (0019 #7, 0021)                                             | Phase 4 UI          | Product       |
| Delivery webhooks for DELIVERED/FAILED (Sent is the highest status until then)                                           | Delivery statuses   | Product / Ops |

## Working rules

- The PRD and the decision records define V1. Nothing outside V1 is built or advertised.
- Implement only from the canonical documents in the [documentation index](README.md); never
  from `docs/archive/` or superseded originals.
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
Last full run (fresh worktree of `chore/pre-phase-3`, 2026-10-05): all green — 76 web unit,
21 API unit, 33 integration tests; build passes. On 2026-10-07 `fix/workspace-logo-home`
(`main` with Phase 3) passed format, lint, typecheck and 113 web unit tests; the API unit,
integration and build steps were not re-run then.

### Manual testing (2026-10-07, `main` with Phase 3)

Browser run from the home page through sign-up, sign-in, sign-out and wedding creation:
25 checks, all pass — entry links, every create-wedding validation, the countdown, the
one-wedding limit, privacy between users (404) and phone layout. One finding — no way back
to the home page from the workspace — was fixed in PR #6. Editing on Wedding details was
checked only for loading the saved values.

## Change log

| Date       | Change                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-11 | Decisions 0020–0022 merged to `main` (PR #10).                                                                                                                                                                                                                                                                                                                    |
| 2026-10-11 | Decision 0022: dashboard API contract for `GET /weddings/{weddingId}/dashboard`. The API returns at most five upcoming events (dashboard response only); expected attendees only for those events; upcoming is date-only in the wedding's timezone. API Design §6 and the Phase 4 PRD were updated to match.                                                      |
| 2026-10-11 | Decision 0021: Phase 4 Stitch screens approved, with corrections to apply in code; the dashboard shows at most five upcoming events (display only); the invitation email leaves out a missing date or city. The wording stays draft. The Phase 4 PRD was updated to match.                                                                                        |
| 2026-10-11 | Phase 4 Stitch screens generated and reviewed twice. Not yet approved: three mobile screens need rebuilding, some screens still break approved rules, and duplicate screens need deleting. Round-3 fixes in progress.                                                                                                                                             |
| 2026-10-10 | Phase 4 design decisions merged (PR #9). Decision 0020: regenerating an invitation link resets the current email status to Draft; revoking leaves it unchanged; email history is never rewritten.                                                                                                                                                                 |
| 2026-10-10 | Documentation consolidation merged (PR #8). Decision 0019: organizer route to retrieve the current invitation link (audited); invitations managed on the guest detail screen; four dashboard summaries; field limits approved; wording drafted at design review; confirmations for destructive actions; dashboard calculation rules approved (Phase 4 PRD §10.2). |
| 2026-10-10 | Decision 0018: invitation tokens stored as a hash plus an encrypted copy (key outside the database); organizer RSVP resets audited; immediate provider rejection marks the attempt FAILED; deleting a guest revokes their token; proposed field limits labelled; no Cancelled expense status in V1. Specifications updated to match.                              |
| 2026-10-10 | Documentation consolidated (`docs/consolidation`): PRD v1.2, Phase 4 PRD v1.2, System Design v1.3, Database Design v1.1 and API Design v1.1 in Markdown; decision 0017; Phase 4 combines events, guests, RSVP and invitations; documentation index added. Superseded `.docx` originals and the reconciled set moved to `docs/archive/` (approved).                |
| 2026-10-07 | Pre-Phase 3 fixes (PR #4), Phase 3 (PR #5) and the workspace logo fix (PR #6) merged to `main`. Manual testing of Phase 3: all checks pass.                                                                                                                                                                                                                       |
| 2026-10-05 | Pre-Phase 3 PR (`chore/pre-phase-3`): code-review fixes (refresh cookies, atomic sign-in limit, lockout lifted on reset, deployed env settings, worker job retries) and manual-testing fixes (email field error, signed-in redirect).                                                                                                                             |
| 2026-10-03 | Phase 1 (PR #2) and Phase 2 (PR #3) merged to `main`.                                                                                                                                                                                                                                                                                                             |
| 2026-10-03 | `feat/home-page` and `feat/auth` pushed to GitHub; PRs not yet opened.                                                                                                                                                                                                                                                                                            |
| 2026-10-03 | Page created. Phase 2 (Authentication) built and verified on `feat/auth`.                                                                                                                                                                                                                                                                                         |
| 2026-10-01 | Phase 1 (design system and home page) built on `feat/home-page`.                                                                                                                                                                                                                                                                                                  |
| 2026-09-29 | Scaffold merged to `main` (PR #1).                                                                                                                                                                                                                                                                                                                                |
