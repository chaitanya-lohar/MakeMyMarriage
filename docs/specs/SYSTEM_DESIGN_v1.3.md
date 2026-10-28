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
| Vendor discovery | Google Places API (New) — deferred (0032 #3)                |
| Live streaming   | YouTube Live (external)                                     |
| Supersedes       | System Design v1.0–v1.2 (archived in `docs/archive/specs/`) |

| Version | Date       | Change                                                                                                                                   |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0–1.2 | 2026-09    | Architecture baselines.                                                                                                                  |
| 1.3     | 2026-10-10 | Consolidated: v1.2 plus decisions 0001, 0002, 0005–0007, 0012, 0015–0018 and answers Q1 and Q4.                                          |
| 1.3     | 2026-10-14 | Decision 0025: Vercel-only hosting; no worker or job queue; email sent directly.                                                         |
| 1.3     | 2026-10-20 | Decision 0028: expenses (§12.1); receipts deferred (§20).                                                                                |
| 1.3     | 2026-10-24 | Decision 0032: vendors and bookings (§13); discovery and vendor attachments deferred (§13, §20).                                         |
| 1.3     | 2026-10-27 | Phase 10 requirements (product owner): organizers and permissions architecture (§7.2–§7.9), Workspace module (§6), open questions (§28). |
| 1.3     | 2026-10-27 | Phase 10 decisions P10-1–P10-8 applied (§7.2–§7.9); dashboard and member selection (§7.10); rollout over Phases 4–9 (§7.11); §28.        |

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
| Vendor discovery   | Google Maps Platform Places API (New) — deferred (0032 #3)                                     |
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

| Module           | Responsibility                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Auth             | Registration, login, password reset, sessions and tokens                                   |
| Users            | User accounts and the current-user endpoint                                                |
| Weddings         | Wedding identity, couple details, settings                                                 |
| Workspace        | Memberships, organizer invitations, permission evaluation and the access checks (Phase 10) |
| Partner          | Partner connection                                                                         |
| Sharing          | Resource-specific sharing                                                                  |
| Events           | Predefined and custom events                                                               |
| Guests           | Guest records and event assignment                                                         |
| Invitations      | Invitation tokens, delivery lifecycle and activity                                         |
| RSVP             | Event-level RSVP and attendee count (in the Guests module, which owns `guest_events`)      |
| Dashboard        | Wedding dashboard summaries; owns no data (0022)                                           |
| Notifications    | In-app and email notifications and reminders                                               |
| Expenses         | Expense tracking, payments and receipts                                                    |
| Tasks            | Wedding and event tasks                                                                    |
| Vendors          | Wedding vendors and their bookings (0032)                                                  |
| Vendor discovery | Provider abstraction and Google Places (deferred — 0032 #3)                                |
| Website          | Website configuration and publication                                                      |
| Gallery          | Albums and photos                                                                          |
| QR               | Wedding and event QR lifecycle                                                             |
| Live stream      | Event–stream association                                                                   |
| Reports          | Reports and Excel export                                                                   |
| Settings         | Account and wedding settings                                                               |
| Audit            | Meaningful and security-sensitive history                                                  |

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

### 7.2 Authorization — organizers and permissions (Phase 10)

Approved Phase 10 requirements and decisions P10-1–P10-8 (product owner, 2026-10-27; decision
0034, table in Database Design §32). Data: Database Design §7.2, §7.5, §7.6 and §8. Routes: API Design §6,
§7.1 and §23.

| Role      | Responsibility                                                                          |
| --------- | --------------------------------------------------------------------------------------- |
| OWNER     | Bride or groom (at most two per wedding); everything, including the owner-only actions  |
| ADMIN     | Delegated management of planning modules; members only if granted, never Admins (P10-4) |
| ORGANIZER | Runs events, guests, invitations, tasks and vendors; views expenses                     |
| EDITOR    | Adds and edits planning data; deletes nothing                                           |
| VIEWER    | Reads events, guests, invitations, tasks, expenses, vendors, gallery and live stream    |

- **Memberships are per wedding.** A user may hold memberships in several weddings, each with
  its own role and overrides; authorizing a request reads only the membership of the wedding
  in the route.
- **Owners.** Both connected partners are `OWNER` members (0012). Owners hold every
  permission. Only wedding creation, partner connection (Phase 16) and ownership transfer
  (§7.6) create owners — never an organizer invitation.
- **Roles** `OWNER`, `ADMIN`, `ORGANIZER`, `EDITOR`, `VIEWER` give default permissions per
  module; **overrides** on a membership add (`ALLOW`) or remove (`DENY`) single
  `(module, action)` pairs. Actions: `VIEW`, `CREATE`, `EDIT`, `DELETE`, plus named management
  actions that ordinary CRUD never implies — website configure and publish, report export,
  member invite, role change, permission editing and removal, guest-link sending
  (`INVITATIONS:SEND`) and management (`INVITATIONS:MANAGE`), QR regeneration
  (`MEMORY_QR:REGENERATE`). Guest-link sending and QR regeneration are **owner-only by default**
  and granted to others only by an explicit `ALLOW` override (P10-6).
- Wedding routes admit only `ACTIVE` members; anything else is `404`, so wedding IDs reveal
  nothing (0016). An active member without a permission gets `403`.
- Public website and guest-token access use separate paths from the authenticated
  workspace APIs and never consult memberships.

### 7.3 Permission evaluation

```text
request ─► sign-in guard (JWT) ─► wedding access guard
                                     │ membership = findActive(userId, weddingId)   (per request, no cache)
                                     │ none / not ACTIVE ──────────────► 404 WEDDING_NOT_FOUND
                                     ▼
                         effective = evaluate(membership)            (Database Design §8.4)
                           OWNER ─► all actions
                           else  ─► role defaults
                                    + ALLOW overrides
                                    − DENY overrides   (DENY wins for the same module/action)
                                    − actions without VIEW on their module
                                    − protected actions
                                     ▼
                         permission guard: route needs (module, action)
                           missing ─► 403 PERMISSION_DENIED (+ audit for management actions)
                                     ▼
                         controller ─► service (business rules: owner targets, self-changes,
                                       grant ceiling) ─► repository (always filtered by weddingId)
```

- Evaluation is a pure function in the Workspace module (`PermissionService`), with unit tests
  for every role × module × action and for override conflicts. The matrix lives in one
  constants file shared by the API and, through the generated client, by the web app.
- The membership is read on every request, so a role change, override change or removal
  takes effect on the member's **next request**; access tokens carry no permissions. Any
  future cache must be invalidated by these changes.
- The web app hides controls using `GET …/members/me/permissions`; this is a convenience,
  never the check.

### 7.4 Overrides

- Stored only where they differ from the role default; replaced as a complete list.
- `DENY` beats `ALLOW` for the same `(module, action)`; `DENY VIEW` closes the module.
- Overrides can never grant protected actions (§7.8) and are ignored for owners.
- **Grant ceiling:** a non-owner who may edit permissions can only grant actions they
  effectively hold themselves.
- Resource sharing (A4, Phase 16) will apply after overrides and only to partner-private
  resources; Phase 10 has no sharing.

### 7.5 Members and admins

- Owners manage every non-owner membership. Admins act on members only through the
  `MEMBERS` actions an owner grants them (their default there is Custom: nothing).
- Without exception for non-owners: no action on an `OWNER` membership; no change to one's own
  role, overrides or membership; no grant beyond one's own permissions; no ownership transfer;
  no partner actions.
- **Admins and the Admin role (P10-4):** a non-owner can never invite someone as `ADMIN`,
  change anyone's role to `ADMIN`, or change the role, overrides, invitation or membership of
  an existing `ADMIN`. Their member actions reach only `ORGANIZER`, `EDITOR` and `VIEWER`
  memberships (Database Design §8.3). Broad CRUD or a `MEMBERS` grant does not lift these
  limits; they are checked in the members service after the permission guard, and refusals
  are audited.
- **Removal** sets the membership to `REVOKED` and deletes nothing; the member's records keep
  their authorship and are shown with the former-member label (as in 0030). Open sessions
  stay valid for the account but every request to that wedding is `404` from then on.

### 7.6 Invitations, memberships and ownership transfer

```text
Organizer invitation (member_invitations)              Membership (wedding_memberships)
  PENDING ──accept: signed in, email matches,            (none)  or  REVOKED (re-invited member)
     │       expiresAt > now (P10-1, P10-2)  ──► ACCEPTED ──► ACTIVE (created, or same row reused:
     │                                                        overrides cleared, new role — P10-3)
     │──decline (token)──► DECLINED                           │
     │──revoke (MEMBERS:INVITE)──► REVOKED                    └──remove (MEMBERS:REMOVE)──► REVOKED
     └──7 days after issue (seen on any read or action)──► EXPIRED

Membership status INVITED: reserved, never written, never admitted (P10-7).
```

- **Two separate lifecycles.** The invitation (`PENDING` → `ACCEPTED`/`DECLINED`/`EXPIRED`/
  `REVOKED`) is the pending state; the membership (`ACTIVE`/`REVOKED`) is access. A pending
  invitation grants nothing; only the `ACTIVE` membership written at acceptance does.
- **Expiry (P10-2):** seven days after the token is issued (creation or latest resend), as a
  UTC timestamp. No scheduler is needed (0025): every read and action compares `expiresAt`
  with the server clock, acceptance includes it in its conditional update, and the first
  request that sees an expired invitation records `EXPIRED`.
- **Acceptance (P10-1):** signed in, with the account email equal to the invitation email; no
  email verification step (0015). The single-use token from the email is the proof.
- **Re-invitation (P10-3):** a revoked member stays `REVOKED` — without access — until they
  accept the new invitation; then their existing row is reused with the old overrides cleared
  and the new role. Their earlier records and audit history stay.
- Emails are sent during the request through the existing email service (0025); until a
  domain is verified in Resend, invitations only reach the Resend account owner
  (PROJECT_STATUS blocker).

**Ownership-seat transfer (P10-5).** A wedding has at most two owner seats (bride and groom,
0012). An owner transfers **their own seat**, never the whole wedding:

```text
Owners A (seat 1), B (seat 2); C is an ACTIVE member
A offers seat 1 to C ──► transfer PENDING ──► C accepts ──► one transaction:
    A: OWNER → ADMIN (seat removed)   C: MEMBER → OWNER (seat 1)   B: unchanged (seat 2)
Result: owners B and C. Decline (C) or cancel (A) ends the offer; nothing changes.
```

- Owner-only and recipient-accepted; one open offer per wedding; refused if C owns another
  wedding (0012); every step audited. The seat index and the conditional updates make a
  third owner or a half-done transfer impossible (Database Design §7.2, §7.6).

### 7.7 Responsibilities

| Component                                               | Responsibility                                                                                     |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Sign-in guard (built)                                   | Authenticated user                                                                                 |
| Wedding access guard (Workspace)                        | Active membership of the route's wedding; puts membership and effective permissions on the request |
| `@RequirePermission(module, action)` + permission guard | Route-level check before the controller                                                            |
| `PermissionService` (Workspace)                         | Defaults, override resolution, protected actions; exported through `index.ts`                      |
| Members/invitations services (Workspace)                | Invitation lifecycle, membership changes, owner and self protections, transfers                    |
| Feature services                                        | Their own business rules; every query filtered by `weddingId`                                      |
| Audit module (built)                                    | Writes the Phase 10 audit actions (Database Design §22), never token values                        |

### 7.8 Protected actions and security

- Owner-only, never grantable: ownership-seat transfer, archiving or deleting the wedding,
  partner connection and sharing, changes to `OWNER` memberships, assigning the `ADMIN` role
  and managing `ADMIN` memberships (P10-4).
- Owner-only by default, grantable by override: guest-link sending and retrieval
  (`INVITATIONS:SEND`), guest-link regeneration and revocation (`INVITATIONS:MANAGE`), QR
  regeneration (`MEMORY_QR:REGENERATE`) — P10-6. Each is checked by the permission guard on its
  own route and audited (guest-link actions as in Phase 4; QR regeneration when built).
- Overrides never bypass authentication, the `ACTIVE`-membership check, the `weddingId`
  scope or the owner-only list.
- Server-side checks on every protected operation; no frontend-only checks.
- Tenant isolation as today: the membership of the route's wedding, then queries scoped by
  `weddingId`; IDs of other weddings are `404`.
- Invitation token routes are rate-limited by token and IP like guest routes (0023); tokens
  and hashes never appear in logs, responses (other than the emailed link) or audit metadata.
- Audit: every invitation transition, role and override change, removal, reactivation,
  ownership transfer and refused management action (Database Design §22).

### 7.9 Failure handling and edge cases

| Case                                             | Behaviour                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| Invite an email that is already an active member | `409 MEMBER_ALREADY_ACTIVE`                                             |
| Invite while a pending invitation exists         | `409`; the owner resends instead                                        |
| Email provider fails on invite                   | Invitation stays `PENDING`, `emailSent: false`; resend available        |
| Accept with a different account                  | `403 MEMBER_INVITATION_EMAIL_MISMATCH`; the page asks to switch account |
| Accept twice, or after revoke/expiry             | `409`; no second membership                                             |
| Invitee is a revoked former member               | Reactivation of the same row (P10-3)                                    |
| Member removed while using the app               | Next request `404`; the web app returns to the wedding list             |
| Role lowered while editing                       | Save refused with `403`; the form reloads permissions                   |
| Transfer target already owns a wedding           | `409 WEDDING_ALREADY_OWNED` (0012)                                      |
| Recipient removed while an offer is pending      | Offer cancelled (`MEMBERSHIP_CHANGED`); acceptance `409`                |
| Both owners offer their seats at once            | Second offer `409`: one open offer per wedding                          |
| Admin tries to invite or promote an Admin        | `403 PERMISSION_DENIED` (`ADMIN_ROLE_OWNER_ONLY`), audited              |
| Accept after seven days, status still `PENDING`  | `409 MEMBER_INVITATION_EXPIRED`; status written `EXPIRED`               |
| Removal or demotion would leave no active owner  | Impossible: owner rows cannot be changed by others; transfer keeps one  |

### 7.10 Dashboard and member selection (P10-8)

- The dashboard route needs only an active membership, but each section is computed and
  returned only with `VIEW` on its module (events, guests, invitations and RSVP, tasks,
  expenses, vendors, and later sections). A missing section is absent, not zeroed, and its
  queries do not run, so one section never reveals another's data (API Design §6). The web
  app hides the cards accordingly.
- **Eligibility is not permission.** Any `ACTIVE` member can be chosen as a task assignee or
  an expense payer; the member directory (`GET …/members`) is open to every active member for
  these pickers. Setting an assignee or payer needs the write permission on that task or
  expense. Being chosen grants the chosen member nothing.

### 7.11 Rollout over Phases 4–9

Decisions 0026 #14 (tasks), 0028 #19 (expenses) and 0032 #19 (vendors) — and the Phase 4
routes and dashboard in practice — let every active member do everything. Phase 10 replaces
that rule everywhere, with no alternative path: every wedding route declares one
`(module, action)` (API Design §23); a contract test fails for any route without one, apart
from the few explicitly "membership only" routes; the dashboard moves to per-section checks;
guest-link sending and management move to their own actions; the existing `ACTIVE` lookup
and `weddingId` scoping stay; and each route gets tests for an allowed role, a refused role,
a revoked member and another wedding's member. Those three decision records carry an
"Amended by 0034" note.

### 7.12 Wedding selection in the web app (0035)

A user can be an active member of several weddings (§7.2). The web app keeps one **selected
wedding** at a time:

- The workspace loads `GET /weddings` (API Design §6), which lists each wedding with the
  user's own role in it. The selected wedding's ID is remembered on the device (browser
  storage, per user). On load, a remembered ID that is not in the list is discarded; the
  default is the first wedding in the API's order (the owned wedding first).
- With two or more weddings, the wedding block at the top of the navigation is a selector
  (Stitch P10 · M11). With one wedding it is plain text; with none, the existing "no wedding
  yet" screens apply.
- Switching replaces the whole workspace context: the selected ID, the effective permissions
  (`GET …/members/me/permissions` for the new wedding), the navigation and all cached data.
  Nothing from the previous wedding is reused.
- The server never relies on the selection: every route still takes `weddingId` in its path
  and checks that wedding's `ACTIVE` membership and permissions. A remembered ID is only a
  preference.
- If the selected wedding's membership ends (removal, or the wedding becomes unavailable),
  the next request returns `404`; the app shows "You no longer have access to this wedding"
  with "Choose another wedding" (when others remain) and "Go to home".
- Permissions in the web app only show or hide controls; the server authorizes every request
  (§7.3).

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
  optional vendor (set from Phase 9 — 0032 #8), notes; several payments, each with its payer,
  date and method; payment status calculated from the payments (0028). Specified in the
  Phase 8 PRD.
- Receipts are deferred until a file-storage decision (0028 #3).
- Expenses are shared with the connected partner; no per-expense visibility field (0009).

### 12.2 Tasks

- Wedding-level or event-level tasks with title, description, due date, priority, status,
  assignees, event and notes; attachments deferred (0026). Specified in the Phase 7 PRD.
- Statuses: `TODO`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `CANCELLED`; reporting rules in
  decision 0013.
- Overdue and upcoming tasks appear on the dashboard.

## 13. Vendor management and discovery

### 13.1 Vendors and bookings (Phase 9 — decision 0032)

- A vendor is a wedding-scoped profile: name, fixed category, contact details and notes. A
  vendor has several bookings, each with its own status, event or whole wedding, booking and
  service dates, optional agreed price and notes. Specified in the Phase 9 PRD.
- Vendor money is tracked through expenses and expense payments: an expense may name a
  vendor; there is no vendor payment ledger.
- The Vendors module owns `wedding_vendors` and `vendor_bookings`. It implements the events
  module's port for deleted events (bookings become whole-wedding, as for tasks and
  expenses) and exposes a vendor lookup through its `index.ts` for the expenses module; the
  expenses module lists a vendor's expenses for the vendor page. Neither reads the other's
  collections.
- Attachments (0032 #6) and copying vendors between weddings (0032 #7) are deferred.

### 13.2 Discovery (deferred — 0032 #3)

Not built in Phase 9; kept as the design for when a decision brings it back. A discovered
vendor would join the wedding's vendors only after the user chooses "Add to My Vendors".

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
| Vendor attachments   | Deferred (0032 #6) |
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
| 011 | Google Places API (New) via provider abstraction | Accepted; deferred from Phase 9 (0032 #3)              |
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
- Google Places fields that may be stored or cached (discovery deferred — 0032 #3).
- Notification templates and default reminder schedules (product-deferred).
- S3 bucket and prefix layout and media-processing policy.
- Delivery webhooks for `DELIVERED`/`FAILED`.
- Audit-log and delivery-history retention; permanent deletion schedule.
- Website sitemap, metadata and crawler directives.
- How scheduled and background work runs on Vercel-only hosting (0025).
- Phase 10: decisions P10-1–P10-8 are settled (§7.2–§7.11; decision 0034). Still to confirm:
  the interpretations R1–R6 in 0034, including the member-invitation rate limits. A4/A5 (0011) stay open
  and are not needed by Phase 10, which builds no partner connection or sharing.

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
