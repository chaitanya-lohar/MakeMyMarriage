# MakeMyMarriage — System Design & Architecture v1.3

| Item             | Value                                                       |
| ---------------- | ----------------------------------------------------------- |
| Version          | 1.3 (consolidated)                                          |
| Status           | **Canonical** architecture baseline                         |
| Date             | 2026-10-10                                                  |
| Architecture     | Modular monolith                                            |
| Web              | Next.js + TypeScript on Vercel                              |
| API              | NestJS + Node.js + TypeScript; a Vercel function (0025)     |
| Database         | MongoDB Atlas                                               |
| Object storage   | Amazon S3                                                   |
| Background jobs  | None in V1 hosting; future jobs need a decision (0025)      |
| Email            | Resend                                                      |
| Vendor discovery | Google Places API (New)                                     |
| Live streaming   | YouTube Live (external)                                     |
| Supersedes       | System Design v1.0–v1.2 (archived in `docs/archive/specs/`) |

| Version | Date       | Change                                                                                          |
| ------- | ---------- | ----------------------------------------------------------------------------------------------- |
| 1.0–1.2 | 2026-09    | Architecture baselines.                                                                         |
| 1.3     | 2026-10-10 | Consolidated: v1.2 plus decisions 0001, 0002, 0005–0007, 0012, 0015–0018 and answers Q1 and Q4. |
| 1.3     | 2026-10-14 | Decision 0025: Vercel-only hosting; no worker or job queue; email sent directly.                |
| 1.3     | 2026-10-20 | Decision 0028: expenses (§12.1); receipts deferred (§20).                                       |

## 1. Purpose and scope

This document defines the technical architecture of MakeMyMarriage V1. It turns the
product scope ([PRD v1.2](PRD_v1.2.md)) into an implementable system: a modular monolith
with strong internal module boundaries, domain ownership, authorization boundaries and
replaceable integrations. It covers authentication, wedding and workspace management,
events, guests, invitations, RSVP, notifications, expenses, tasks, vendors, vendor
discovery, the wedding website, gallery and memories, QR uploads, live streaming,
reporting, sharing, security, observability and deployment.

## 2. Confirmed architecture decisions

| Area               | Decision                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| Architecture       | Modular monolith                                                                               |
| Frontend           | Next.js (App Router) + TypeScript, Tailwind CSS v4, the "Regal Modernity" design system (0014) |
| Backend            | NestJS + Node.js + TypeScript                                                                  |
| API                | REST/JSON under `/api/v1` (API Design v1.1)                                                    |
| Database           | MongoDB Atlas, accessed through Mongoose inside module repositories                            |
| Object storage     | Amazon S3                                                                                      |
| Web hosting        | Vercel (web app and its `/api/v1` proxy only)                                                  |
| API hosting        | Vercel function in its own Vercel project (0025; amends 0002, 0005)                            |
| Background jobs    | None; Redis is used for rate limiting only (0025)                                              |
| Email              | Resend (local development uses a Mailpit inbox)                                                |
| Authentication V1  | Email + password; no mandatory email verification (0015)                                       |
| Social login       | Google login is future-ready, not V1                                                           |
| Sessions           | Multiple devices supported                                                                     |
| Public wedding URL | Path-based: `makemymarriage.com/w/{public-identifier}`                                         |
| Vendor discovery   | Google Maps Platform Places API (New)                                                          |
| Live streaming     | YouTube Live                                                                                   |
| CI/CD              | GitHub Actions                                                                                 |
| Docker             | Local development only (Docker Compose for MongoDB, Redis and Mailpit) (0025)                  |
| CDN                | CDN-ready; CloudFront optional                                                                 |

## 3. Product and domain principles

- Signup creates only a user; wedding creation is separate (0012).
- A user owns at most one wedding; after a partner connection both partners are `OWNER`
  members of the same wedding, and accounts are never merged.
- Sharing is explicit and resource-specific, except expenses, which are shared with the
  connected partner (0009).
- Guests need no accounts for invitations, RSVP or photo uploads.
- Private data is private by default; server-side authorization is mandatory.
- Guest identity is separate from event participation.
- Secure random tokens are used for invitation and QR access; database IDs are never
  public.
- External providers are used for non-core infrastructure.

## 4. High-level architecture

```text
Users / guests
   ↓ HTTPS
Vercel ─ Next.js web app and public wedding websites
   ↓ /api/v1/* proxied server-side (same origin for the browser — 0001)
NestJS API (Vercel function — 0025) ─ modular monolith
   ├─ Auth · Users · Weddings · Workspace · Partner · Sharing
   ├─ Events · Guests · Invitations · RSVP
   ├─ Notifications · Tasks · Expenses
   ├─ Vendors · Vendor discovery
   ├─ Website · Gallery · QR · Live stream
   └─ Reports · Settings · Audit
   ├──────────────┬───────────────┐
   ↓              ↓               ↓
MongoDB Atlas   Amazon S3     Redis (rate limits)
   ↓
Resend · Google Places · YouTube Live
```

## 5. Deployment architecture

Decisions 0001, 0002, 0005 and 0025; answer Q1.

| Component      | Hosting                                   |
| -------------- | ----------------------------------------- |
| Web (Next.js)  | Vercel                                    |
| NestJS API     | Vercel function (separate Vercel project) |
| Database       | MongoDB Atlas                             |
| Redis          | Managed Redis service (rate limits only)  |
| Object storage | Amazon S3                                 |
| CI/CD          | GitHub Actions                            |

- Browsers only call the web origin. The Next.js server forwards `/api/v1/*` to the API
  (configured by the server-only `API_INTERNAL_URL`); nothing else is forwarded. The API
  enables no CORS. Cookies are first-party.
- The NestJS API runs as a Vercel function in its own Vercel project (`apps/api`); locally
  it runs as `dist/main.js` on port 3001. There is no worker and no Docker image (0025).
  Both Vercel projects, MongoDB Atlas and Redis are in the Mumbai region.
- V1 runs on Vercel's free plan, which does not allow commercial use; a public launch needs
  the Pro plan or a return to containers (0025).
- Health probes (`/health/live`, `/health/ready`) are outside `/api/v1` and are not
  reachable through the web origin.
- Vercel deploys both projects from `main`. Database indexes are created by a one-off
  command before the first deployment and after index changes (0025).

## 6. Backend modular monolith

| Module           | Responsibility                                                                        |
| ---------------- | ------------------------------------------------------------------------------------- |
| Auth             | Registration, login, password reset, sessions and tokens                              |
| Users            | User accounts and the current-user endpoint                                           |
| Weddings         | Wedding identity, couple details, settings                                            |
| Workspace        | Memberships and the access check for wedding routes                                   |
| Partner          | Partner connection                                                                    |
| Sharing          | Resource-specific sharing                                                             |
| Events           | Predefined and custom events                                                          |
| Guests           | Guest records and event assignment                                                    |
| Invitations      | Invitation tokens, delivery lifecycle and activity                                    |
| RSVP             | Event-level RSVP and attendee count (in the Guests module, which owns `guest_events`) |
| Dashboard        | Wedding dashboard summaries; owns no data (0022)                                      |
| Notifications    | In-app and email notifications and reminders                                          |
| Expenses         | Expense tracking, payments and receipts                                               |
| Tasks            | Wedding and event tasks                                                               |
| Vendors          | Managed wedding vendors                                                               |
| Vendor discovery | Provider abstraction and Google Places                                                |
| Website          | Website configuration and publication                                                 |
| Gallery          | Albums and photos                                                                     |
| QR               | Wedding and event QR lifecycle                                                        |
| Live stream      | Event–stream association                                                              |
| Reports          | Reports and Excel export                                                              |
| Settings         | Account and wedding settings                                                          |
| Audit            | Meaningful and security-sensitive history                                             |

Module layout (0006):

```text
apps/api/src/modules/<feature>/
├── <feature>.module.ts
├── index.ts              ← the only public entry point
├── api/{controllers,dto}
├── application/{use-cases,services}
├── domain/{types,enums,rules}
└── infrastructure/{schemas,repositories}
```

- Other modules import a module only through its `index.ts` (lint-enforced).
- Mongoose schemas and models are used only in `infrastructure/`; repositories return
  domain types (lint-enforced).
- A module never reads or writes another module's collections. Use-cases that must change
  several modules' data atomically use the shared transaction runner, which passes an
  opaque transaction handle (0016).
- Modules are created when their feature is built, never as empty placeholders.

Web app structure (0007): route groups `(marketing)`, `(auth)`, `(workspace)`,
`w/[publicIdentifier]`, `invite/[token]`, `memories/[token]`; feature UI in
`src/features/<feature>/`; design-system components in `src/components/ui/`.

## 7. Authentication and authorization

### 7.1 Authentication

Details in decision 0015.

```text
Register → validate → hash password → create User → sign in        (no wedding — 0012)
Login    → find user → verify hash → issue access + refresh tokens → cookies
Forgot   → time-limited single-use token → email → new password → revoke all sessions
```

- Passwords are hashed with Argon2id, never stored or logged in plain text.
- Short-lived JWT access token (15 minutes) plus a revocable, rotating refresh session
  (only its hash stored).
- Tokens live in Secure, HttpOnly, SameSite=Lax cookies — never `localStorage`.
- Logout revokes the session and clears cookies; a password reset revokes every session.
- Authentication and password-reset endpoints are rate-limited.
- Every route requires a signed-in user unless explicitly marked public.

### 7.2 Authorization

- Both connected partners are `OWNER` members.
- Organizers use predefined roles (Owner, Admin, Organizer, Editor, Viewer) with
  per-member permission overrides. Permissions: View, Create, Edit, Delete, Manage,
  Configure.
- Authorization checks wedding membership, role and permission, and resource sharing.
- Wedding routes admit only `ACTIVE` members; anything else is `404`, so wedding IDs reveal
  nothing (0016).
- Public website and guest-token access use separate paths from the authenticated
  workspace APIs.

## 8. Partner connection and sharing

```text
Partner invites → partner accepts → both are OWNER members of one wedding
   → accounts stay separate → resources private by default (except expenses)
   → explicit sharing enables access
```

- Either partner can initiate; either can disconnect.
- Connection never merges accounts or private data.
- An invitee who owns a wedding cannot accept until that is resolved (0012, N1).
- Shared-resource state is enforced by the authorization layer.
- **Open:** A4 sharing scope and A5 disconnection behaviour (0011).

## 9. Wedding, event, guest and RSVP model

```text
Wedding
 ├─ Event (soft-deleted)
 └─ Guest (one per wedding; soft-deleted)
     ├─ GuestInvitation (one per guest; token hash, delivery status)
     │    ├─ InvitationDelivery (each send/resend attempt)
     │    └─ InvitationActivity (opens and other timestamped events)
     └─ GuestEvent → Event   (RSVP status, attendee count; removable, kept as history)
```

- A guest exists once per wedding and may be assigned to several events.
- RSVP belongs to `GuestEvent`; organizers can update it on a guest's behalf.
- No user-facing attendee-count limit; status/count rules in decision 0017.
- Event dates are a calendar date plus optional local times in the wedding timezone (0017).

## 10. Invitation and guest access

Decisions 0008, 0017 and 0018.

| Delivery status | Meaning                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------ |
| Draft           | Prepared but not sent                                                                      |
| Sent            | Provider accepted the send request                                                         |
| Delivered       | Provider confirmed delivery (needs webhooks)                                               |
| Failed          | Provider rejected the send request (immediate), or reported failure later (needs webhooks) |

- Opens are activity history, never a delivery status; the first-open time is kept.
- RSVP states (Pending, Attending, Declined, Maybe) are separate from delivery.
- Resending never creates duplicate guests or RSVPs; send history is kept.
- Guest links use secure random tokens, stored as a hash (lookup) and an encrypted copy
  (decrypted only by the API to send and resend the email). The token is reused
  for resends and contact changes; no automatic expiry in Phase 4; regenerate, revoke and
  guest deletion invalidate the old token (0018).
- Organizer resets of an RSVP to Pending, and organizer retrievals of an invitation link,
  are written to the audit log (0018, 0019).
- One invitation per guest contains the guest's applicable events.
- WhatsApp uses the user's own sharing flow; no WhatsApp API in V1.
- Email invitations are sent through Resend by the API during the send request (0025).

## 11. Notifications and background jobs

```text
Domain action (API) → channel adapter
                       ├─ Resend (email)
                       └─ in-app notification store
```

- V1 channels: email and in-app. WhatsApp and SMS are future channels.
- There is no worker or job queue (0025). Invitation emails are sent during the request and
  recorded before the response; there is no automatic retry, and the organizer resends a
  failed email. Password reset emails are sent after the response (Vercel `waitUntil`), so
  response time does not reveal whether an account exists.
- Scheduled or long-running work (reminders, exports, media cleanup, delivery webhooks)
  needs its own decision before it is built, for example Vercel Cron or a hosted queue.
- **Deferred:** reminder cadence, default schedules and organizer customization (PRD v1.2
  §14). The reminder engine is planned; configurable schedules are not built until decided.

## 12. Expenses and tasks

### 12.1 Expenses

- Actual expenses only: title, amount, fixed category (0010 #7), date, optional event,
  optional vendor (from Phase 9), notes; several payments, each with its payer, date and
  method; payment status calculated from the payments (0028). Specified in the Phase 8 PRD.
- Receipts are deferred until a file-storage decision (0028 #3).
- Expenses are shared with the connected partner; no per-expense visibility field (0009).

### 12.2 Tasks

- Wedding-level or event-level tasks with title, description, due date, priority, status,
  assignees, event and notes; attachments deferred (0026). Specified in the Phase 7 PRD.
- Statuses: `TODO`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `CANCELLED`; reporting rules in
  decision 0013.
- Overdue and upcoming tasks appear on the dashboard.

## 13. Vendor management and discovery

### 13.1 Managed vendors

- Contact details, category, associated events, notes, status, quotation and final cost,
  payment information and attachments.
- A discovered vendor joins the managed list only after the user chooses "Add to My
  Vendors".
- Vendor money is tracked through expenses and expense payments.

### 13.2 Discovery

```text
VendorDiscoveryService → VendorProvider interface → GooglePlacesProvider
                                                 → Places API (New): Text Search, Nearby Search, Place Details
```

- The web app calls the NestJS discovery API, never Google directly.
- Stored Google fields must comply with the current Google Maps Platform terms.
- Field masks, rate limiting and controlled caching manage cost and latency.

## 14. Wedding website

Decision 0016; answer Q4.

- The website is created by the Wedding website phase, not when a wedding is created; that
  phase also creates websites for existing weddings. It starts private (Draft); the owner or
  an authorized admin publishes it.

### 14.1 Public URL

`https://makemymarriage.com/w/{public-identifier}` — unique, non-sensitive and independent
of the MongoDB ID. The generation algorithm can evolve without changing the wedding's
internal identity.

### 14.2 States

`DRAFT` (created, private) · `PUBLISHED` (public) · `UNPUBLISHED` (previously published,
now private).

### 14.3 Public content

- Home, Our Story, Events, RSVP, Gallery, Live Stream and Share Your Memories.
- Only public or shared data is exposed, through publication-safe projections.
- **Published websites are indexable by search engines in V1.** Sitemap generation, page
  metadata and crawler directives are specified in the Wedding website phase.
- Unpublished websites expose no private wedding data.

## 15. Photo gallery and guest memories

- Photos only; no user-facing photo limit.
- Event albums with an optional Uncategorized album.
- Guests upload without login; guest uploads are published automatically.
- Uploaders delete their own photos through a secure deletion token; owners and admins
  manage according to authorization.
- S3 stores media; MongoDB stores metadata.
- Browser uploads use short-lived S3 presigned URLs issued after authorization and
  validation.

## 16. Wedding memory QR

- Wedding-level and event-level QR codes; a wedding QR allows event selection; an event QR
  scopes uploads to the event.
- QRs use secure random tokens (hash stored), never database IDs.
- Owners and admins can revoke and regenerate QR tokens.

```text
QR → secure token → validate status and scope → upload session
   → S3 presigned upload → photo metadata and ownership → published gallery
```

## 17. Live streaming

- YouTube Live is the provider; a stream is associated with an event; streams can be
  embedded on the public website.
- The application stores provider references and event association, behind a
  `LiveStreamProvider` abstraction.

## 18. API architecture

- All routes are under `/api/v1` (API Design v1.1 is authoritative for route names).
  Unversioned examples such as `/api/auth/*` are not used.
- Workspace APIs: `/api/v1/auth/*`, `/api/v1/me`, `/api/v1/weddings/{weddingId}/…`.
- Guest-token APIs: `/api/v1/guest/invitations/{token}`, `/api/v1/guest/memory/{token}`.
- Public website APIs: `/api/v1/public/w/{publicIdentifier}/…`.
- DTO validation at API boundaries; thin controllers; use-cases own orchestration;
  repositories stay inside their modules.
- Consistent `{ data, meta }` and `{ error }` envelopes with request IDs.
- The OpenAPI contract is generated from the code and checked in CI.

## 19. MongoDB Atlas

- The primary transactional store, designed around aggregate boundaries and access
  patterns rather than one large wedding document.
- Collections, fields, indexes and transaction rules: [Database Design v1.1](DB_DESIGN_v1.1.md).
- Query filters are sanitized globally; server-built operators are explicitly trusted.

## 20. Amazon S3

| Data                 | Storage            |
| -------------------- | ------------------ |
| Guest photos         | S3                 |
| Cover images         | S3                 |
| Expense receipts     | Deferred (0028 #3) |
| Task attachments     | Deferred (0026 #3) |
| Vendor attachments   | S3                 |
| Report exports       | S3 (temporary)     |
| Application metadata | MongoDB Atlas      |

- Private files use controlled access and presigned URLs; public media may use a CDN.
- Server-side validation controls file type and size; object keys are opaque and
  wedding-scoped.

## 21. Security architecture

- HTTPS everywhere; secrets outside source control; production configuration validated at
  start-up (missing deployed settings stop the process).
- Strong password hashing; HttpOnly cookies; short-lived access tokens; revocable refresh
  sessions.
- Server-side authorization on every protected operation.
- Rate limiting on authentication, invitations, RSVP, QR and uploads.
- Secure random invitation, QR and reset tokens, never stored in plain form and never
  logged. Reset, refresh and QR tokens are stored as hashes. Invitation tokens are stored as
  a hash plus an encrypted copy (authenticated encryption); the encryption key lives in the
  platform's secret manager, is supplied to the API at start-up, is never stored
  in the database or logged, and carries a version so it can be rotated (0018).
- Input validation and output filtering; private notes never in guest or public output.
- S3 access control and presigned uploads.
- Structured and audit logs; privacy checks on public websites and shared resources.

## 22. Observability and reliability

- Structured logs (pino) with request and correlation IDs.
- Health checks and dependency monitoring.
- MongoDB Atlas monitoring and backups.
- Failed email attempts are recorded as delivery history; there are no background jobs to
  retry (0025).
- Audit trail for important actions.
- Idempotency for invitation sends and other repeatable operations.

## 23. CI/CD and development

```text
GitHub → GitHub Actions → format → lint → typecheck → unit tests → integration tests
       → build → OpenAPI contract check
Deploy: web and API → two Vercel projects, deployed from main (0025)
```

- Environments: local, test, staging, production.
- Local stack: Docker Compose (MongoDB replica set, Redis, Mailpit).
- Production secrets are never committed.
- Database changes use controlled, version-controlled migration practices.

## 24. Scalability strategy

- Scale the API horizontally; keep it stateless.
- MongoDB indexes based on real query patterns.
- Redis for rate limiting; asynchronous work needs a decision when it is needed (0025).
- S3 for binary media; CDN for high-volume public media when needed.
- External integrations behind provider interfaces.
- Extract services only when scale or organizational pressure justifies it.

## 25. Account and wedding data lifecycle

- Account deletion is support-controlled. Wedding data is archived or soft-deleted before
  permanent deletion.
- Guests, events, expenses, tasks, vendors, website configuration, invitations and
  metadata follow the deletion policy.
- S3 media is marked for controlled cleanup rather than deleted synchronously.
- **Deferred:** permanent retention and deletion periods, to be set in the privacy and
  data-retention policy before launch.

## 26. Reporting and export

- Guest, expense and task reports with **Excel export only** (PRD v1.2 §26).
- Guest: totals, RSVP breakdown, event attendance. Expense: totals, category and event
  breakdown. Task: completed, pending, blocked, overdue (0013).
- How larger exports run is decided with the reporting module (0025).

## 27. Architecture decision records

The original ADR list (001–015) is carried by this document and by the repository's
decision records in `docs/decisions/`, which are the authoritative history.

| ADR | Decision                                         | Status                                                 |
| --- | ------------------------------------------------ | ------------------------------------------------------ |
| 001 | Modular monolith                                 | Accepted                                               |
| 002 | Next.js + TypeScript                             | Accepted                                               |
| 003 | NestJS + Node.js + TypeScript                    | Accepted                                               |
| 004 | MongoDB Atlas                                    | Accepted                                               |
| 005 | Amazon S3                                        | Accepted                                               |
| 006 | Vercel                                           | Accepted for the web app and the API; no worker (0025) |
| 007 | Redis + BullMQ                                   | Redis kept for rate limiting; BullMQ removed (0025)    |
| 008 | Resend                                           | Accepted                                               |
| 009 | Email/password without mandatory verification    | Accepted                                               |
| 010 | Secure tokenized guest/QR access                 | Accepted                                               |
| 011 | Google Places API (New) via provider abstraction | Accepted                                               |
| 012 | YouTube Live                                     | Accepted                                               |
| 013 | Path-based public wedding URL                    | Accepted                                               |
| 014 | Predefined roles + customizable permissions      | Accepted                                               |
| 015 | Soft-delete/archive deletion workflow            | Accepted                                               |

## 28. Remaining open technical decisions

- Exact role names' default permission matrix.
- Invitation-token key rotation procedure (re-encrypting stored copies under a new key).
  Settled by the Invitations module (0018): AES-256-GCM, with the ciphertext bound to its
  guest; keys in `INVITATION_TOKEN_KEYS` as `<version>:<base64 32-byte key>` entries, the
  current key first and older keys after it so existing copies stay readable.
- Public-identifier generation and collision strategy.
- Google Places fields that may be stored or cached.
- Notification templates and default reminder schedules (product-deferred).
- S3 bucket and prefix layout and media-processing policy.
- Delivery webhooks for `DELIVERED`/`FAILED`.
- Audit-log and delivery-history retention; permanent deletion schedule.
- Website sitemap, metadata and crawler directives.
- How scheduled and background work runs on Vercel-only hosting (0025).

## 29. Implementation sequence

Phases are approved one at a time; the current state is in `docs/PROJECT_STATUS.md`.
Built so far: scaffold, design system and home page, authentication, wedding setup.
Next: Phase 4 — events, guests, RSVP and invitations.

## 30. Summary

A modular monolith designed for secure public deployment: Next.js on Vercel for the web
experience, the NestJS API as a Vercel function (0025), MongoDB Atlas for domain data, S3 for
media, Redis for rate limiting, and Resend for email. It
preserves the product principles: one owned wedding per account, accounts never merged,
explicit sharing (expenses excepted), account-free guests, event-level RSVP, secure
tokenized guest and QR access, deliberate website publication and granular server-side
authorization.
