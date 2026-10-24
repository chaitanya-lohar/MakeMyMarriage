# Project status

The single place to see where MakeMyMarriage stands. Read this first.

- **Updated:** 2026-10-24, after the Phase 9 (Vendors) design approval: decisions 0032 and 0033 and the Phase 9 PRD.
- **Source of truth:** the canonical documents listed in the [documentation index](README.md)
  and the decision records in [`decisions/`](decisions/README.md). This page only summarises
  and links; where they differ, the decision record wins.
- **Keep it current:** update this page in the same commit or PR that finishes a phase or
  changes a branch's state.

## Snapshot

| Item            | State                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Current phase   | Phase 9 (Vendors) — discovery and screens approved (0032, 0033, Phase 9 PRD v1.0) on `docs/phase-9-vendors`, not yet merged |
| Next phase      | Phase 9 implementation (`feat/phase-9`) — needs explicit approval; merge the docs PR first                                  |
| `main`          | Scaffold, Phases 1–4, 7 and 8 with their review fixes (PRs #1–29); decisions 0001–0031                                      |
| Open PRs        | None yet — `docs/phase-9-vendors` is pushed; its PR is to be opened (no GitHub CLI on this machine)                         |
| Live deployment | None yet                                                                                                                    |

### Branches

Every branch below except `fix/phase-4-review` is merged into `main`; new work starts from `main`.

| Branch                            | Contains                                                                                | State              |
| --------------------------------- | --------------------------------------------------------------------------------------- | ------------------ |
| `main`                            | Everything below                                                                        | Up to date         |
| `feat/home-page`                  | Phase 1: design system and home page                                                    | Merged (PR #2)     |
| `feat/auth`                       | Phase 2: authentication                                                                 | Merged (PR #3)     |
| `chore/pre-phase-3`               | The three branches below, `.mcp.json`, this page                                        | Merged (PR #4)     |
| ↳ `fix/auth-hardening`            | Code-review fixes (4 commits)                                                           | Merged via #4      |
| ↳ `fix/auth-test-findings`        | Manual-testing fixes (3 commits)                                                        | Merged via #4      |
| ↳ `docs/status-after-phase-2`     | This page after the Phase 1/2 merges (1 commit)                                         | Merged via #4      |
| `feat/weddings`                   | Phase 3: wedding setup and dashboard shell                                              | Merged (PR #5)     |
| `fix/workspace-logo-home`         | Workspace logo opens the home page (manual-testing fix)                                 | Merged (PR #6)     |
| `docs/consolidation`              | Consolidated documentation, decisions 0017–0018                                         | Merged (PR #8)     |
| `docs/phase-4-design-decisions`   | Decision 0019 and the matching spec updates                                             | Merged (PR #9)     |
| `docs/regenerate-email-status`    | Decisions 0020–0022 and the matching spec updates                                       | Merged (PR #10)    |
| `feat/phase-4`                    | Phase 4: events, guests, RSVP, invitations and dashboard                                | Merged (PR #12)    |
| `fix/phase-4-review`              | Decision 0023 and the code-review fixes (includes `feat/phase-4-engineering-decisions`) | Merged (PR #14)    |
| `feat/event-date-picker`          | Date pickers, save returns to the dashboard, decision 0024 parked                       | Merged (PR #15)    |
| `feat/vercel-single-runtime`      | Decision 0025: Vercel-only hosting, no worker, emails sent directly, deployment guide   | Local, not pushed  |
| `docs/phase-7-tasks`              | Decisions 0026 and 0027, the Phase 7 PRD                                                | Merged (PR #19)    |
| `feat/phase-7`                    | Phase 7: tasks module, screens and dashboard card (0026, 0027)                          | Merged (PR #20)    |
| `fix/phase-7-review`              | Phase 7 code-review fixes (4 medium, 9 low) and tests                                   | Merged (PR #22)    |
| `docs/phase-8-expenses`           | Decision 0028, the Phase 8 PRD, the spec updates and the 0026 #20 amendment             | Merged (PR #24)    |
| `fix/phase-7-tasks-empty-state`   | Tasks card when every task is cancelled (0026 #20)                                      | Merged (PR #25)    |
| `docs/phase-8-design-approval`    | Decision 0029: Phase 8 Stitch screens approved                                          | Merged (PR #26)    |
| `feat/phase-8`                    | Phase 8: expenses module, payments, dashboard card, screens (0028, 0029)                | Merged (PR #27)    |
| `fix/phase-8-review`              | Phase 8 code-review fixes (4 medium, 4 low) and tests, incl. the tasks event race       | Merged (PR #28)    |
| `fix/expenses-payer-and-category` | Decision 0030 (former-member payers) and the category column fix from Manual QA         | Merged (PR #29)    |
| `docs/wording-approval`           | Decision 0031: wording of Phases 4, 7 and 8 approved                                    | Merged (PR #30)    |
| `docs/phase-9-vendors`            | Decisions 0032 and 0033, the Phase 9 PRD and the spec updates                           | Pushed, PR to open |

The merged branches can be deleted, on GitHub and locally.

## Phases

This order was proposed during Phase 1 and is being followed. On 2026-10-10 the product owner
approved combining events, guests and RSVP, and invitations into one Phase 4 (answer Q3); the
later phases keep their numbers. Each phase is approved before it starts, and any open
questions for it are raised then (0004).

| #   | Phase                                | State                        | Records                                                          |
| --- | ------------------------------------ | ---------------------------- | ---------------------------------------------------------------- |
| 0   | Scaffold (monorepo, API, CI)         | Done, merged                 | 0001–0013                                                        |
| 1   | Design system and home page          | Done, merged                 | 0014                                                             |
| 2   | Authentication                       | Done, merged                 | 0015                                                             |
| 3   | Wedding setup and dashboard shell    | Done, merged                 | 0010, 0012, 0016                                                 |
| 4   | Events, guests, RSVP and invitations | Done, merged                 | 0008, 0010, 0017–0023; [Phase 4 PRD](specs/PHASE_4_PRD_v1.2.md)  |
| 5   | (merged into Phase 4)                | —                            | —                                                                |
| 6   | (merged into Phase 4)                | —                            | —                                                                |
| 7   | Tasks                                | Done, merged (PRs #19, #20)  | 0010, 0013, 0026, 0027; [Phase 7 PRD](specs/PHASE_7_PRD_v1.0.md) |
| 8   | Expenses                             | Done, merged (PR #27)        | 0009, 0010, 0028, 0029; [Phase 8 PRD](specs/PHASE_8_PRD_v1.0.md) |
| 9   | Vendors                              | Screens approved; build next | 0010, 0032, 0033; [Phase 9 PRD](specs/PHASE_9_PRD_v1.0.md)       |
| 10  | Organizers and permissions           | Not started                  | 0012                                                             |
| 11  | Wedding website                      | Not started                  | 0007                                                             |
| 12  | Gallery and QR memories              | Not started                  | 0007                                                             |
| 13  | Live stream                          | Not started                  | —                                                                |
| 14  | Notifications                        | Not started                  | —                                                                |
| 15  | Reports                              | Not started                  | 0013                                                             |
| 16  | Partner connection and sharing       | Not started                  | 0011, 0012 — **blocked on A4/A5**                                |

Deployment follows decision 0025: the web app and the API on Vercel, MongoDB Atlas, Upstash
Redis and Resend, all on free plans. Steps are in [DEPLOYMENT.md](DEPLOYMENT.md); the
accounts are not created yet.

## What exists today (on `main`)

### Web pages

| Route                                                                               | What it is                                                                                          |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `/`                                                                                 | Marketing home page (final approved copy)                                                           |
| `/signup`                                                                           | Create an account                                                                                   |
| `/login`                                                                            | Sign in, with "Remember me for 30 days"                                                             |
| `/forgot-password`                                                                  | Request a reset email                                                                               |
| `/reset-password`                                                                   | Set a new password from the emailed link; expired-link state                                        |
| `/dashboard`                                                                        | "No wedding yet" (S2), or the wedding dashboard with countdown (S4) and the Phase 4 summaries (O10) |
| `/wedding/new`                                                                      | Create your wedding (S3)                                                                            |
| `/wedding`                                                                          | Wedding details: edit and save (S5)                                                                 |
| `/events`, `/events/new`, `/events/[eventId]`                                       | Events list, add and edit, delete (O2–O4)                                                           |
| `/guests`, `/guests/new`, `/guests/[guestId]`, `/guests/[guestId]/edit`             | Guests list, add and edit, detail with RSVP and the invitation panel (O5–O9)                        |
| `/tasks`, `/tasks/new`, `/tasks/[taskId]`, `/tasks/[taskId]/edit`                   | Tasks list, add and edit, task page with history (Phase 7, Stitch "P7 · T1–T7")                     |
| `/expenses`, `/expenses/new`, `/expenses/[expenseId]`, `/expenses/[expenseId]/edit` | Expenses list with totals, add and edit, expense page with payments (Phase 8, Stitch "P8 · E1–E8")  |
| `/invite/[token]`                                                                   | A guest's private invitation and RSVP, no account (G1–G5)                                           |
| (workspace)                                                                         | Sidebar and user menu, mobile drawer, loading (S1), not available (S6)                              |
| `/privacy`, `/terms`                                                                | Placeholders — legal text not yet provided                                                          |

- A signed-in user who opens `/login`, `/signup` or `/forgot-password` goes to `/dashboard`;
  a malformed email shows "Please enter a valid email address." under the field (0015).
- In the workspace, the logo opens the home page; Dashboard in the navigation leads back
  (0016).

### API endpoints (`/api/v1`)

| Endpoint                                                                                                 | Purpose                                          |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `POST /auth/register`                                                                                    | Create account and sign in                       |
| `POST /auth/login`                                                                                       | Sign in                                          |
| `POST /auth/refresh`                                                                                     | Rotate the session                               |
| `POST /auth/logout`                                                                                      | Sign out                                         |
| `POST /auth/forgot-password`                                                                             | Request a reset email                            |
| `POST /auth/reset-password`                                                                              | Set a new password                               |
| `GET /me`                                                                                                | Current user                                     |
| `POST /weddings`                                                                                         | Create the user's wedding; the user is its owner |
| `GET /weddings`                                                                                          | Weddings the user is an active member of         |
| `GET /weddings/{weddingId}`                                                                              | One wedding (members only; otherwise 404)        |
| `PATCH /weddings/{weddingId}`                                                                            | Update the wedding's details                     |
| `GET /weddings/{weddingId}/dashboard`                                                                    | Phase 4 summaries (0022)                         |
| `…/events`, `…/events/{eventId}`                                                                         | Events (API Design §8)                           |
| `…/guests`, `…/guests/{guestId}`, `…/guests/{guestId}/events`, `…/guest-events/{id}`                     | Guests, assignments, RSVP (§9)                   |
| `…/guests/{guestId}/invitation` (+ `/regenerate`, `/send`, `/resend`, `/revoke`, `/link`, `/deliveries`) | Invitations (§10)                                |
| `GET`/`PATCH /guest/invitations/{token}` (+ `/rsvp`)                                                     | Guest invitation and RSVP, no account (§10)      |
| `…/tasks`, `…/tasks/{taskId}` (+ `/assignees`, `/assignees/{userId}`, `/activities`)                     | Tasks, assignees, history (§13)                  |
| `…/expenses`, `…/expenses/{expenseId}` (+ `/payments`, `/payments/{paymentId}`)                          | Expenses and payments (§12)                      |

Health checks: `GET /health/live` and `/health/ready` on the API (3001).

### Backend modules

`users`, `auth`, `weddings` (`weddings` collection) and `workspace` (`wedding_memberships`,
the membership check for wedding routes), in `apps/api/src/modules/`. Phase 4 adds `events`,
`guests` (`guests`, `guest_events`), `invitations` (`guest_invitations`,
`invitation_deliveries`, `invitation_activities`; the API sends the email during the request — 0025), `audit`
(`audit_logs`) and `dashboard`; Phase 7 adds `tasks` (`tasks`, `task_assignments`,
`task_activities`; deleting an event makes its tasks whole-wedding tasks — 0026); Phase 8 adds `expenses` (`expenses`, `expense_payments`; a stored paid total updated with each
payment in one transaction; deleting an event makes its expenses whole-wedding ones — 0028). Creating a wedding
writes the wedding and its owner membership in one transaction. Shared infrastructure:
config, logging, MongoDB, Redis (rate limiting), email (Mailpit locally, Resend when
deployed; reset emails are sent after the response — 0025).

### Designs (Google Stitch project `11709379677369700007`)

| Screen                                               | Built as                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| Premium Modern Indian Wedding Platform (V1 Approved) | `/`                                                                      |
| Sign In (V1) (`13df968e…`)                           | `/login`, `/forgot-password`                                             |
| Sign Up                                              | `/signup`                                                                |
| Reset Password, Reset Link Expired                   | `/reset-password`                                                        |
| "P3 · S1"–"P3 · S6" (corrected as listed in 0016)    | Workspace, `/dashboard`, `/wedding/new`, `/wedding`                      |
| "P4 ·" screens listed in 0021 (with its corrections) | Events, guests, invitation panel, dashboard summaries, `/invite/[token]` |
| "P7 ·" screens listed in 0027                        | `/tasks`, the dashboard Tasks card, the event shortcut                   |
| "P8 ·" screens listed in 0029                        | `/expenses`, the dashboard Expenses card, the event shortcut             |
| "P9 ·" screens listed in 0033 (second round only)    | Not built yet: vendors, booking dialog, dashboard card, expense field    |
| Wedding Command Center Dashboard                     | Not built                                                                |

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

| Item                                                                                                                     | Blocks            | Owner         |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------- | ------------- |
| A4 — what partners share by default (0011)                                                                               | Phase 16          | Product       |
| A5 — what happens on partner disconnect (0011)                                                                           | Phase 16          | Product       |
| Usage rights for the Stitch-generated photos                                                                             | Public launch     | Product       |
| Privacy Policy and Terms of Service text                                                                                 | Public launch     | Legal         |
| A domain verified in Resend (none owned yet; until then email reaches only the Resend account owner — 0025)              | Email to guests   | Product / Ops |
| Delete the outdated first "Sign In (V1)" screen in Stitch                                                                | Housekeeping      | Product       |
| Delete the 11 first-round "P9 ·" screens in Stitch that 0033 does not approve                                            | Housekeeping      | Product       |
| Deployment accounts: Vercel (two projects), MongoDB Atlas, Upstash Redis (0025)                                          | First deployment  | Ops           |
| Scheduled and background work (reminders, exports, media cleanup, webhooks) on Vercel-only hosting (0025)                | Later phases      | Product       |
| Forgot-password response time hints whether an email is registered (code review, deferred)                               | Public launch     | Engineering   |
| Reset email says "signs you out on all your devices", but access tokens live ≤15 min (0015) — reword or revoke instantly | Public launch     | Product       |
| Delivery webhooks for DELIVERED/FAILED (Sent is the highest status until then)                                           | Delivery statuses | Product / Ops |
| Live updates on organizer screens (0024, parked): until then, an open page shows a guest's RSVP only after a refresh     | Enhancement       | Product       |

## Working rules

- The PRD and the decision records define V1. Nothing outside V1 is built or advertised.
- Implement only from the canonical documents in the [documentation index](README.md); never
  from `docs/archive/` or superseded originals.
- Conflicts between documents are raised with the protocol in 0004 and decided by the
  product owner before any code is written.
- One module or phase at a time; each starts only after explicit approval.
- Nothing is pushed and no PR is opened without explicit approval.
- Code PRs are merged by Claude only on "merge it"; documentation-only PRs Claude merges
  itself once CI passes (product owner, 2026-10-19).
- UI follows the approved Stitch screens; missing screens are designed in Stitch and approved
  first.
- Small, logical commits. Run Prettier from the repository root (running it inside a package
  skips `.prettierignore` and reformats generated files).

## Run and verify

See the [README](../README.md) for full setup. In short:

```sh
pnpm install
pnpm infra:up      # MongoDB, Redis, Mailpit
pnpm dev           # web :3000, API :3001
```

Phase 4 adds the required `INVITATION_TOKEN_KEYS` variable to `apps/api/.env` (see
`apps/api/.env.example`).

Checks: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm build`.
On 2026-10-11 `feat/phase-4` passed format, lint, typecheck, 237 web unit, 65 API unit and
93 integration tests, both builds and the contract check. A browser run with sample data
checked every Phase 4 screen at 1440px and 390px (no horizontal scrolling), a guest RSVP, the
duplicate-mobile notice and the invitation email in Mailpit.
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

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-24 | Decision 0033: Phase 9 Stitch screens V1–V9 approved after two review rounds (the first round, with a booking delete button, the unapproved "Expenses & Budget" shell and invented features, is not approved). Cancelling a booking needs no confirmation; the event shortcut stays visible with a "No vendors yet" state; no Undo toast; a reopening note; the refused-delete dialog lists active bookings; no total count. Shell and small fixes applied in code; wording draft. Phase 9 PRD §4.2 and §10 updated. Implementation awaits approval.                                                                                                                                                                                            |
| 2026-10-24 | Phase 9 (Vendors) discovery done: decision 0032 and the Phase 9 PRD v1.0 approved. Vendors with several bookings each (statuses Not contacted to Booked, and Cancelled; any change allowed; cancelled, never deleted); an optional agreed price per booking; a vendor cannot be deleted while a booking is active; the expense `vendorId` is set through a picker; four dashboard summaries. Discovery, attachments and copying between weddings deferred. PRD §15, §17, §18, §30, Database Design §12.1, §14, §18–§20, §22, §24, §26, §27, API Design §6, §12, §14, §21, System Design §6, §12.1, §13, §20, Phase 4 PRD §3.2, Phase 8 PRD §3.1, §12 and 0010 updated. The separate .docx draft was discovery input only. Next: Stitch screens. |
| 2026-10-22 | Decision 0031: the draft wording of Phases 4, 7 and 8 is approved. Decision 0030 and the category column fix merged (PR #29).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-10-22 | Review fixes merged (PR #28) and PR #25 merged (the dashboard Tasks card shows zero counts when every task is cancelled — 0026 #20); main CI and both Vercel builds passed. Manual QA of Phase 8: 29/29 checks pass; one low finding (category names breaking mid-word) fixed. Decision 0030 approved: editing a payment may keep a member payer who has since left the wedding.                                                                                                                                                                                                                                                                                                                                                                |
| 2026-10-22 | Phase 8 merged to `main` (PR #27; CI and both Vercel builds passed). Code review: no critical or high; 4 medium and 4 low fixed on `fix/phase-8-review` — linking an expense or task to an event now claims the event so a concurrent deletion conflicts (also fixes the same race in tasks), malformed IDs are 404, the payment dialog handles removed payments, former members and refused overpayments, and the form never sends an event it does not show. 134 integration, 68 API unit and 312 web unit tests pass. Open: former-member payers on edit (product decision).                                                                                                                                                                 |
| 2026-10-21 | Phase 8 (Expenses) built on `feat/phase-8`: expenses module (expenses, payments, list with totals, event-deletion effect, audit), dashboard summary, and the E1–E8 screens with the 0029 corrections. 17 new API tests (15 integration, 2 unit) and 41 web unit tests; browser check of every screen and flow at 1280px and 500px (no horizontal scrolling). Checks: 127 integration, 68 API unit and 312 web unit tests, both builds. The wording is draft. Pushed as PR #27; CI passed.                                                                                                                                                                                                                                                       |
| 2026-10-21 | Decision 0029: Phase 8 Stitch screens E1–E8 approved after the product owner corrected them in Stitch; no Remove inside Edit payment; the remove dialog previews paid and pending; shell and small fixes applied in code; wording draft. Implementation awaits approval.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-10-20 | Decision 0026 #20 amended: when every task is cancelled, the dashboard Tasks card shows zero counts and "View all tasks"; "No tasks yet" only when the wedding has no tasks. Code fix pending.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-10-20 | Phase 8 (Expenses) discovery done: decision 0028 and the Phase 8 PRD v1.0 approved. The payer moves to each payment; payment status is calculated; a stored paid total updated in the payment's transaction blocks overpayment; no description field; receipts deferred. PRD §15 and §18, Database Design §12, §20, §22, §24 and §27, API Design §6, §12, §21 and §24, System Design §12.1 and §20 and Phase 4 PRD §3.2 updated. Next: Stitch screens.                                                                                                                                                                                                                                                                                          |
| 2026-10-20 | Phase 7 code review (no critical or high): the 4 medium and 9 low findings fixed on `fix/phase-7-review` with tests; 112 integration, 66 API and 271 web unit tests pass; merged as PR #22. Open: whether the dashboard says "No tasks yet" when every task is cancelled (product decision), and the draft wording.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-10-19 | Merge rule from the product owner: Claude merges documentation-only PRs once CI passes, and code PRs when told "merge it".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-10-19 | Phase 7 (Tasks) merged to `main`: decisions 0026 and 0027 (PR #19) and the implementation (PR #20); CI and both Vercel builds passed. Open: the draft wording (0027), and review by the Code review and Manual QA sessions. The next phase needs approval.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-10-19 | Phase 7 built on `feat/phase-7`: tasks API (tasks, assignees, history, event-deletion cascade, dashboard counts and upcoming tasks) and the T1–T7 screens with the 0027 corrections. 18 new API tests (14 integration, 4 unit) and 32 web unit tests for tasks; browser check at desktop and mobile widths. The wording is draft. Not pushed.                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-10-19 | Decision 0027: Phase 7 Stitch screens approved (T1–T7) with a correction list; no overdue nav badge, no per-event task panel, completed titles struck through. Wording draft. Implementation awaits approval.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-10-19 | Phase 7 (Tasks) discovery done: decision 0026 and the Phase 7 PRD v1.0 approved; Database Design §13, API Design §6 and §13, PRD §16 and §18, System Design §12.2 and §20 and Phase 4 PRD §3.2 updated. Attachments, reminders, reports and permissions stay out of scope. Next: Stitch screens.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-10-14 | Decision 0025 approved: Vercel-only hosting on free plans (web and API as two Vercel projects, MongoDB Atlas, Upstash Redis, Resend); no worker, job queue or Docker image; invitation emails sent during the request without automatic retry; reset emails sent after the response. Supersedes 0023 #1; amends 0002, 0005 and 0015. Specifications updated.                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-10-12 | Decision 0024 drafted and parked as a later enhancement: live updates on organizer screens (Server-Sent Events over the `/api/v1` proxy, Redis pub/sub, change notices only). Not approved; no specification changed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-10-12 | Decision 0016 amended by the product owner: saving wedding details returns to the dashboard with "Your changes have been saved." Saving an edited event also returns to the dashboard (adding an event still opens the events list). Built on `feat/event-date-picker` with calendar date pickers for the event and wedding dates. Not pushed.                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-10-11 | Decision 0023: Phase 4 engineering decisions — a send that exhausts its retries is recorded FAILED; guest-route rate limits raised to 120 per IP and 60 per link a minute; guest list alphabetical; every open stored as activity. Specifications updated to match.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-10-11 | Phase 4 merged to `main` (PR #12).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-10-11 | Phase 4 built on `feat/phase-4`: API modules for events, guests and RSVP, invitations (token hash plus AES-256-GCM copy, worker email, guest routes), audit and dashboard; web screens for events, guests and RSVP, the invitation panel, dashboard summaries and `/invite/[token]`. Not pushed.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-10-11 | Decisions 0020–0022 merged to `main` (PR #10).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-10-11 | Decision 0022: dashboard API contract for `GET /weddings/{weddingId}/dashboard`. The API returns at most five upcoming events (dashboard response only); expected attendees only for those events; upcoming is date-only in the wedding's timezone. API Design §6 and the Phase 4 PRD were updated to match.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-10-11 | Decision 0021: Phase 4 Stitch screens approved, with corrections to apply in code; the dashboard shows at most five upcoming events (display only); the invitation email leaves out a missing date or city. The wording stays draft. The Phase 4 PRD was updated to match.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-10-11 | Phase 4 Stitch screens generated and reviewed twice. Not yet approved: three mobile screens need rebuilding, some screens still break approved rules, and duplicate screens need deleting. Round-3 fixes in progress.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-10-10 | Phase 4 design decisions merged (PR #9). Decision 0020: regenerating an invitation link resets the current email status to Draft; revoking leaves it unchanged; email history is never rewritten.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-10 | Documentation consolidation merged (PR #8). Decision 0019: organizer route to retrieve the current invitation link (audited); invitations managed on the guest detail screen; four dashboard summaries; field limits approved; wording drafted at design review; confirmations for destructive actions; dashboard calculation rules approved (Phase 4 PRD §10.2).                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-10 | Decision 0018: invitation tokens stored as a hash plus an encrypted copy (key outside the database); organizer RSVP resets audited; immediate provider rejection marks the attempt FAILED; deleting a guest revokes their token; proposed field limits labelled; no Cancelled expense status in V1. Specifications updated to match.                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-10-10 | Documentation consolidated (`docs/consolidation`): PRD v1.2, Phase 4 PRD v1.2, System Design v1.3, Database Design v1.1 and API Design v1.1 in Markdown; decision 0017; Phase 4 combines events, guests, RSVP and invitations; documentation index added. Superseded `.docx` originals and the reconciled set moved to `docs/archive/` (approved).                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-10-07 | Pre-Phase 3 fixes (PR #4), Phase 3 (PR #5) and the workspace logo fix (PR #6) merged to `main`. Manual testing of Phase 3: all checks pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-10-05 | Pre-Phase 3 PR (`chore/pre-phase-3`): code-review fixes (refresh cookies, atomic sign-in limit, lockout lifted on reset, deployed env settings, worker job retries) and manual-testing fixes (email field error, signed-in redirect).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-10-03 | Phase 1 (PR #2) and Phase 2 (PR #3) merged to `main`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-10-03 | `feat/home-page` and `feat/auth` pushed to GitHub; PRs not yet opened.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-10-03 | Page created. Phase 2 (Authentication) built and verified on `feat/auth`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-10-01 | Phase 1 (design system and home page) built on `feat/home-page`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-09-29 | Scaffold merged to `main` (PR #1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
