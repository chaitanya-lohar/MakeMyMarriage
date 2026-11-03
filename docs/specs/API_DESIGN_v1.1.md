# MakeMyMarriage — API Design v1.1

| Item       | Value                                                             |
| ---------- | ----------------------------------------------------------------- |
| Version    | 1.1 (consolidated)                                                |
| Status     | **Canonical** REST contract; authoritative for route names (0004) |
| Date       | 2026-10-10                                                        |
| Style      | REST / JSON                                                       |
| Backend    | NestJS / Node.js / TypeScript                                     |
| Base path  | `/api/v1`                                                         |
| Supersedes | API Design v1.0 (archived in `docs/archive/specs/`)               |

| Version | Date       | Change                                                                                                                                                                                                                                          |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-09-24 | Baseline contract.                                                                                                                                                                                                                              |
| 1.1     | 2026-10-10 | Consolidated: v1.0 plus decisions 0001, 0008, 0009, 0010, 0012, 0015–0019 and the endpoints built in Phases 2–3.                                                                                                                                |
| 1.1     | 2026-10-14 | Decision 0025: the API runs on Vercel; emails are sent directly, with no worker or job queue.                                                                                                                                                   |
| 1.1     | 2026-10-20 | Decision 0028 (Phase 8): expense and payment payloads, list filters and totals, dashboard expense summary.                                                                                                                                      |
| 1.1     | 2026-10-24 | Decision 0032 (Phase 9): vendor and booking routes, expense `vendorId`, dashboard vendor summary; discovery deferred.                                                                                                                           |
| 1.1     | 2026-10-27 | Phase 10 requirements (product owner): §7.1 member, invitation, permission, audit and ownership routes; §6 and §23 required permissions for every route; §21 error codes; §25 and §28.                                                          |
| 1.1     | 2026-10-27 | Phase 10 decisions P10-1–P10-8 applied: expiry and re-invitation rules, Admin limits, ownership-seat transfer routes, `INVITATIONS:SEND`, per-section dashboard permissions, assignee and payer eligibility, rollout over the Phase 4–9 routes. |
| 1.1     | 2026-11-03 | Decisions 0037 and 0038 (Phase 16): §7.2 partner routes (invite, resend, revoke, leave, accept, decline); no share routes; §8, §21, §23, §25, §28, §33, §35, §36.                                                                               |

**Status of each route group** — _Built_: implemented; the generated OpenAPI contract
(`packages/api-client/openapi.json`) is the exact reference. _Phase 4_: approved, not built.
_Planned_: carried from v1.0 with approved changes; payloads are finalized before the module
is built.

## 1. Objectives and scope

The API is the boundary between the Next.js web app, guest-facing flows, background jobs and
external integrations.

- Predictable, resource-oriented REST endpoints.
- Wedding operations scoped by `weddingId` and authorized server-side.
- Account-free guest access through dedicated invitation and QR tokens.
- Public website APIs separate from authenticated management APIs.
- Stable, versioned JSON contracts for web and future mobile clients.
- Provider integrations behind backend services.

## 2. Architecture

```text
Browser → Next.js (Vercel) → /api/v1 proxy (same origin — 0001) → NestJS API (Vercel function — 0025)
NestJS API → MongoDB Atlas · Redis (rate limits) · Amazon S3 · Resend · Google Places · YouTube Live
```

The browser never receives database, Redis or provider credentials. Public and guest
endpoints expose only the minimum data their flow needs.

## 3. Conventions

| Convention         | Baseline                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Protocol           | HTTPS                                                                                                                         |
| Base path          | `/api/v1` for every application endpoint. Health probes (`/health/live`, `/health/ready`) are deliberately outside it (0001). |
| Format             | `application/json`, UTF-8                                                                                                     |
| IDs                | MongoDB ObjectId strings in authenticated APIs; tokens and public identifiers in guest and public URLs                        |
| Timestamps         | ISO 8601 UTC                                                                                                                  |
| Calendar dates     | `YYYY-MM-DD` in the wedding's timezone (wedding date, event date)                                                             |
| Local times        | `HH:mm` in the wedding's timezone (event start and end)                                                                       |
| Money              | Integer minor units + currency                                                                                                |
| Absent values      | Optional fields are returned as `null`, never omitted. In requests, `null` (or an empty string) clears an optional field.     |
| Pagination         | Cursor-based for large lists; bounded lists return everything                                                                 |
| Filtering, sorting | Allow-listed query parameters per resource                                                                                    |
| Authentication     | HttpOnly session cookies (0015)                                                                                               |
| Uploads            | S3 presigned upload flow                                                                                                      |
| Unknown fields     | Rejected (`VALIDATION_FAILED`)                                                                                                |

## 4. URL and resource naming

```text
/api/v1/auth/...
/api/v1/me
/api/v1/weddings
/api/v1/weddings/{weddingId}/events
/api/v1/weddings/{weddingId}/guests
/api/v1/guest/invitations/{token}
/api/v1/public/w/{publicIdentifier}
```

Plural nouns for collections; nested wedding routes for wedding-owned resources; action
endpoints only where a state transition is not a plain update; never internal IDs in
guest, QR or public URLs. Unversioned paths such as `/api/auth/*` are never used.

## 5. Authentication and session API (Built — decision 0015)

| Method | Endpoint                   | Purpose                                  | Auth           | Status             |
| ------ | -------------------------- | ---------------------------------------- | -------------- | ------------------ |
| POST   | `/auth/register`           | Create the user (no wedding) and sign in | Public         | Built              |
| POST   | `/auth/login`              | Sign in (`rememberMe` optional)          | Public         | Built              |
| POST   | `/auth/refresh`            | Rotate the session                       | Refresh cookie | Built              |
| POST   | `/auth/logout`             | Revoke the current session               | Refresh cookie | Built              |
| POST   | `/auth/forgot-password`    | Request a reset email (always `202`)     | Public         | Built              |
| POST   | `/auth/reset-password`     | Set a new password with a reset token    | Public token   | Built              |
| GET    | `/me`                      | Current user                             | User           | Built              |
| POST   | `/auth/logout-all`         | Revoke all sessions                      | User           | Planned (Settings) |
| PATCH  | `/me`                      | Update profile                           | User           | Planned (Settings) |
| GET    | `/me/sessions`             | List active sessions                     | User           | Planned (Settings) |
| DELETE | `/me/sessions/{sessionId}` | Revoke one session                       | User           | Planned (Settings) |

- Cookies `mmm_at` (15-minute access JWT) and `mmm_rt` (rotating refresh token, path
  `/api/v1/auth`); HttpOnly, SameSite=Lax, Secure outside local and test.
- Refresh clears the cookies only when the session has ended; a refresh token already
  rotated by another tab gets `401` without clearing them.
- Rate limits: 5 failed sign-ins per email per 15 minutes; 3 reset requests per email per
  hour (`429 RATE_LIMITED`).
- Every route requires a signed-in user unless explicitly public.

## 6. Wedding and workspace API (decision 0016)

| Method | Endpoint                          | Purpose                                             | Auth                                                  | Status  |
| ------ | --------------------------------- | --------------------------------------------------- | ----------------------------------------------------- | ------- |
| POST   | `/weddings`                       | Create the user's wedding; user becomes OWNER       | User                                                  | Built   |
| GET    | `/weddings`                       | Weddings with an `ACTIVE` membership (may be empty) | User                                                  | Built   |
| GET    | `/weddings/{weddingId}`           | One wedding                                         | Member                                                | Built   |
| PATCH  | `/weddings/{weddingId}`           | Update wedding details                              | `WEDDING_SETTINGS:EDIT` (Phase 10; owners until then) | Built   |
| DELETE | `/weddings/{weddingId}`           | Archive / soft-delete the wedding                   | Owner                                                 | Planned |
| GET    | `/weddings/{weddingId}/dashboard` | Dashboard summary (0019, 0021, 0022)                | Member                                                | Phase 4 |

```json
POST /api/v1/weddings
{ "brideName": "Meera Sharma", "groomName": "Arjun Patel", "startDate": "2027-02-18",
  "venueName": "Lakeside Garden", "primaryCity": "Jaipur",
  "description": "Two families, one celebration." }

201
{ "data": { "id": "…", "displayName": "Meera Sharma & Arjun Patel",
  "brideName": "Meera Sharma", "groomName": "Arjun Patel", "startDate": "2027-02-18",
  "venueName": "Lakeside Garden", "primaryCity": "Jaipur",
  "description": "Two families, one celebration.", "timezone": "Asia/Kolkata" },
  "meta": { "requestId": "…", "timestamp": "…" } }
```

- Only `brideName` and `groomName` are required. `displayName` and `timezone` cannot be sent.
  Limits and messages: decision 0016.
- `409 WEDDING_ALREADY_OWNED` when the user already owns a wedding (including a racing
  request). `404 WEDDING_NOT_FOUND` for a wedding the user is not an active member of, or an
  invalid ID.
- Registration never creates a wedding, and wedding creation never creates a website.

**`GET /weddings` and the wedding selector (Phase 10 — 0035).** Each item is the wedding plus
the caller's own membership of it: `{ …wedding, membership: { membershipId, role, isOwner } }`.
Only `ACTIVE` memberships are listed; order: the wedding the user owns first, then by
`startDate` (undated last), then name. The web app's wedding selector (Stitch P10 · M11) uses
this list; it shows each wedding's name, date, city and the user's role in that wedding.
`GET /weddings/{weddingId}` adds the same `membership` object. Choosing a wedding changes only
which `weddingId` the web app puts in its requests; every request is authorized against the
membership of the wedding in its path, so a role or permission never carries from one wedding
to another (System Design §7.12).

### Dashboard (Phase 4 — decisions 0019, 0021, 0022)

```json
GET /api/v1/weddings/{weddingId}/dashboard

200
{ "data": {
    "upcomingEvents": [
      { "id": "…", "name": "Mehendi", "type": "MEHENDI", "date": "2027-02-16",
        "startTime": "16:00", "endTime": "20:00", "venueName": "Garden Palace",
        "expectedAttendees": 38 },
      { "id": "…", "name": "Wedding", "type": "WEDDING", "date": "2027-02-18",
        "startTime": null, "endTime": null, "venueName": "Lakeside Garden",
        "expectedAttendees": 78 }
    ],
    "guestTotals": { "guests": 86 },
    "rsvpBreakdown": { "pending": 58, "attending": 96, "declined": 21, "maybe": 9 } },
  "meta": { "requestId": "…", "timestamp": "…" } }
```

- **Counted records** follow Phase 4 PRD §10.2: events and guests that are not deleted, and
  active assignments whose event and guest both count.
- **`upcomingEvents`**:
  - Counted events dated today or later in the wedding's timezone. Date only: an event dated
    today stays upcoming after its times have passed (0022 #3).
  - Sorted by `date`, then `startTime`, untimed first on their date.
  - **At most five**, the first five in that order (0022 #1). This limits the dashboard
    response only; the events list (§8) is unchanged. There is no total, "more" flag or
    pagination.
  - An empty array when there are none.
  - `startTime`, `endTime` and `venueName` are `null` when absent.
- **`expectedAttendees`** (on each returned event only — 0022 #2): the sum of
  `attendeeCount` over the event's counted Attending assignments. There is no wedding-wide
  total.
- **`guestTotals.guests`**: counted guests, including guests not assigned to any event.
- **`rsvpBreakdown`**: counted assignments per status across all counted events, past and
  future. A guest counts once per event.
- Computed from current data on every request. No query parameters.
- **Errors:** `401 UNAUTHENTICATED`; `404 WEDDING_NOT_FOUND` for a wedding the user is not
  an active member of, or an invalid ID.
- **Tasks (Phase 7 — 0026 #20):** `taskCounts { pending, blocked, completed, overdue }` over
  tasks that are not deleted (`CANCELLED` in none; `overdue` overlaps `pending` and
  `blocked`), and `upcomingTasks`: every overdue task plus tasks due from today to seven days
  after today, excluding `COMPLETED` and `CANCELLED`; overdue first (oldest due date
  first), then due date, then priority; **at most five**; never undated tasks. `hasTasks`
  is true when the wedding has any task that is not deleted, `CANCELLED` included, so the
  card can tell "no tasks yet" from "every task cancelled" (0026 #20, amended 2026-10-20).
- **Expenses (Phase 8 — 0028 #23):** `expenseSummary { totalMinor, paidMinor, pendingMinor,
byCategory: [{ category, totalMinor }], byEvent: [{ eventId, eventName, totalMinor }] }` over
  expenses that are not deleted. `byCategory` lists only categories with expenses and
  `byEvent` only events with expenses plus whole-wedding expenses (`eventId: null`), each
  largest total first; each adds up to `totalMinor`.
- **Vendors (Phase 9 — 0032 #24):** `vendorSummary { activeVendors, bookedVendors,
bookingsNeedingFollowUp, upcomingServices: [{ bookingId, vendorId, vendorName, title,
serviceDate, eventId, eventName }] }`, counting only vendors that are not deleted and their
  bookings. `bookedVendors`: distinct vendors with a `BOOKED` booking.
  `bookingsNeedingFollowUp`: bookings in `NOT_CONTACTED`, `CONTACTED` or `NEGOTIATING`.
  `upcomingServices`: `BOOKED` bookings with a `serviceDate` today or later in the wedding's
  timezone, soonest first, then the earliest created; **at most five**; never undated
  bookings; `eventId: null` for whole-wedding bookings. `activeVendors: 0` means "No vendors
  yet".
- The countdown and wedding details come from `GET /weddings/{weddingId}`. Later modules add
  their own summaries when they are built (PRD §18).
- **Permissions (Phase 10, P10-8):** the route needs only an active membership, but the
  service computes and returns a section **only** when the caller has `VIEW` on its module:
  `upcomingEvents` needs `EVENTS:VIEW`; `guestTotals` needs `GUESTS:VIEW`; `rsvpBreakdown` and
  `expectedAttendees` need `INVITATIONS:VIEW`; `taskCounts`, `upcomingTasks` and `hasTasks` need
  `TASKS:VIEW`; `expenseSummary` needs `EXPENSES:VIEW`; `vendorSummary` needs `VENDORS:VIEW`.
  A section the caller may not view is **absent** from the response (not empty, not zeroed)
  and its queries are not run, so no count or total leaks through another section. Within a
  section, event names come from that section's own data. Later sections follow the same rule.

## 7. Membership, partner and sharing API

### 7.1 Members, organizer invitations and permissions (Built — Phase 10)

The routes follow the v1.0 conventions; the first four rows were already in v1.0, the rest
are added for Phase 10. Permission keys, the default matrix, Admin limits and protected
actions: Database Design §8. Evaluation: System Design §7.2–§7.4. Decisions P10-1–P10-8:
decision 0034 and Database Design §32.

| Method | Endpoint                                                          | Required permission                                   | Purpose                      |
| ------ | ----------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------- |
| GET    | `/weddings/{weddingId}/members`                                   | Active member (directory); `MEMBERS:VIEW` for details | List members                 |
| GET    | `/weddings/{weddingId}/members/{membershipId}/permissions`        | Own (`me`): active member; others: `MEMBERS:VIEW`     | Effective permissions        |
| PATCH  | `/weddings/{weddingId}/members/{membershipId}`                    | `MEMBERS:CHANGE_ROLE` / `MEMBERS:EDIT_PERMISSIONS`    | Change role or overrides     |
| DELETE | `/weddings/{weddingId}/members/{membershipId}`                    | `MEMBERS:REMOVE`                                      | Revoke a membership          |
| POST   | `/weddings/{weddingId}/members/invitations`                       | `MEMBERS:INVITE`                                      | Invite an organizer by email |
| GET    | `/weddings/{weddingId}/members/invitations`                       | `MEMBERS:VIEW`                                        | List invitations             |
| POST   | `/weddings/{weddingId}/members/invitations/{invitationId}/resend` | `MEMBERS:INVITE`                                      | New token, new expiry, email |
| POST   | `/weddings/{weddingId}/members/invitations/{invitationId}/revoke` | `MEMBERS:INVITE`                                      | Revoke a pending invitation  |
| GET    | `/member-invitations/{token}`                                     | Token only (public, rate-limited)                     | Invitation details           |
| POST   | `/member-invitations/{token}/accept`                              | Signed in; account email = invitation email           | Accept                       |
| POST   | `/member-invitations/{token}/decline`                             | Token only (public, rate-limited)                     | Decline                      |
| GET    | `/weddings/{weddingId}/audit-logs`                                | `AUDIT:VIEW`                                          | Audit history                |
| GET    | `/weddings/{weddingId}/ownership-transfers`                       | Owners; the recipient sees offers made to them        | Pending and past offers      |
| POST   | `/weddings/{weddingId}/ownership-transfers`                       | Owner only (protected)                                | Offer own seat (P10-5)       |
| POST   | `/weddings/{weddingId}/ownership-transfers/{transferId}/accept`   | The recipient member                                  | Accept                       |
| POST   | `/weddings/{weddingId}/ownership-transfers/{transferId}/decline`  | The recipient member                                  | Decline                      |
| POST   | `/weddings/{weddingId}/ownership-transfers/{transferId}/cancel`   | The offering owner                                    | Cancel                       |

**Common rules.** Every `/weddings/{weddingId}/…` route first requires an `ACTIVE` membership
of that wedding (otherwise `404 WEDDING_NOT_FOUND`, as today). An active member without the
required permission gets `403 PERMISSION_DENIED` (they already know the wedding exists);
refused management actions are audited (`PERMISSION_DENIED`). An ID of another wedding, a
revoked member or a malformed ID is `404 MEMBER_NOT_FOUND` / `404 MEMBER_INVITATION_NOT_FOUND`.
Token routes never reveal whether a token existed: unknown, revoked or used tokens give the
same `404 MEMBER_INVITATION_NOT_FOUND`, except where the caller must be told the state (below).

**`GET …/members`** — query `status` (default `ACTIVE`; `REVOKED` needs `MEMBERS:VIEW`),
`limit` (≤ 100) and `cursor` (§24). Order: owners first, then display name. Every active
member gets the directory form `{ membershipId, userId, displayName, isOwner }`, which the task
assignee and expense payer pickers use. With `MEMBERS:VIEW` each item adds `email`, `role`,
`status`, `hasOverrides`, `invitedBy`, `invitedAt`, `acceptedAt`, `revokedAt`.

**Selection eligibility (P10-8).** Three different things:

| Question                                   | Rule                                                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Who **can be chosen** as assignee or payer | Any `ACTIVE` member, whatever their role or permissions                                                                 |
| Who **may set** assignees or payers        | The caller needs `TASKS:CREATE`/`EDIT` or `EXPENSES:CREATE`/`EDIT` for that write                                       |
| What the chosen member **may see or do**   | Only their own permissions; being chosen grants nothing (a `VIEWER` assignee without `TASKS:VIEW` cannot open the task) |

The API applies the same rule as the pickers: `assigneeIds` and `paidByUserId` are accepted
when they name an `ACTIVE` member (else `404 MEMBER_NOT_FOUND`), with no permission check on
the chosen member (Phase 7 §13 and Phase 8 §12 are unchanged otherwise, including 0030).

**`GET …/members/{membershipId}/permissions`** — `membershipId` may be `me`. Returns
`{ role, isOwner, permissions: { [module]: action[] }, overrides: [{ module, action, effect }] }`
— the effective result of Database Design §8.4, which the web app uses to show or hide
controls. The server still authorizes every request; hiding a button is never the check.

**`POST …/members/invitations`** — body `{ email, role, permissionOverrides?, message? }`.

- `email` valid, ≤ 254, lower-cased; `role` ∈ `ADMIN`, `ORGANIZER`, `EDITOR`, `VIEWER`
  (`OWNER` → `400 VALIDATION_FAILED`); `message` ≤ 500; overrides as in PATCH below.
- **P10-4:** a non-owner may invite only `ORGANIZER`, `EDITOR` or `VIEWER`; `role: ADMIN` from a
  non-owner is `403 PERMISSION_DENIED` (`details.reason: ADMIN_ROLE_OWNER_ONLY`), audited.
  Overrides in the invitation follow the grant ceiling.
- `409 MEMBER_ALREADY_ACTIVE` when the email belongs to an active member;
  `409 MEMBER_INVITATION_ALREADY_PENDING` when a pending invitation exists (the client offers
  resend).
- **Re-invitation (P10-3):** inviting the email of a revoked member is allowed and uses this
  same route. The membership stays `REVOKED` — the person has no access — until the new
  invitation is accepted. The response says so with `existingMembershipStatus: "REVOKED"`.
- `201` with `{ id, email, role, status: "PENDING", expiresAt, emailSent,
existingMembershipStatus }` (`expiresAt` = now + 7 days, P10-2). The email is sent
  during the request (0025); a provider failure leaves the invitation `PENDING` with
  `emailSent: false`, and resend is available. The raw token is never returned.
- Audit `MEMBER_INVITATION_CREATED`.
- **Rate limit (0034 R1):** at most 10 invitations per wedding in any rolling hour, counted on
  the server after validation and the `409` checks, so a refused request does not use a slot.
  The 11th is `429 RATE_LIMITED` with `details.retryAfterSeconds`; nothing is created or sent.
  The count is an atomic sliding-window counter in Redis per wedding (the `RateLimiter`
  service), so concurrent requests cannot exceed the limit.

**`GET …/members/invitations`** — `status` filter (default `PENDING`), `limit`, `cursor`;
newest first; expired invitations show `EXPIRED` (Database Design §7.5).

**`resend` / `revoke`** — only for `PENDING` (else `409 MEMBER_INVITATION_NOT_PENDING` with
`details.status`; an invitation past `expiresAt` is reported `EXPIRED` and written so). Resend
replaces the token, sets `expiresAt` to now + 7 days and sends again (`200`); the previous link
stops working. Revoke sets `REVOKED` (`204`); repeating a revoke is `409`. Both audited; both
need `MEMBERS:INVITE` and follow the same P10-4 limit as creation (a non-owner cannot resend or
revoke an `ADMIN` invitation).
**Resend limit (0034 R2):** at most 3 resends per invitation in any rolling 24 hours; the 4th
is `429 RATE_LIMITED` with `details.retryAfterSeconds`, and the token, `expiresAt` and email
stay unchanged. The check and the recording of the resend time are one conditional update
on the invitation (Database Design §7.5), so concurrent resends cannot exceed it. A resend
never changes the membership: a revoked member stays revoked until they accept (R5).

**Invitation link.** The email links to the web page `/member-invite/{token}` (Stitch P10 · M7).
A signed-out invitee signs in or creates an account and returns there: sign-in and sign-up
accept `?next=`, honoured only for a `/member-invite/{token}` path (never another site or page).

**`GET /member-invitations/{token}`** — `{ weddingDisplayName, invitedByName, role, message,
status, expiresAt, emailHint }` (`emailHint` masks the address, e.g. `me***@gmail.com`) so the
page can ask the invitee to sign in with the right account. `EXPIRED`, `ACCEPTED`, `DECLINED`
and `REVOKED` are returned as statuses so the page can explain; no wedding data beyond the
display name.

**`POST /member-invitations/{token}/accept`** — signed-in user only (`401` otherwise).

- `403 MEMBER_INVITATION_EMAIL_MISMATCH` unless the account email equals the invitation email
  (lower-cased). **No email verification is required (P10-1).**
- **Expiry (P10-2):** `409 MEMBER_INVITATION_EXPIRED` when `expiresAt` has passed — checked in
  the conditional update itself, whatever the stored status says; the invitation is then
  written `EXPIRED` (audited). `409 MEMBER_INVITATION_NOT_PENDING` for accepted, declined or
  revoked. `409 MEMBER_ALREADY_ACTIVE` if the user is already an active member; the invitation is
  then closed as `ACCEPTED`, linked to the existing membership, which is not changed (0036).
- In one transaction (Database Design §24): conditional `PENDING` and `expiresAt > now` →
  `ACCEPTED`; membership created `ACTIVE` with the invited role and overrides, or — for a
  revoked member (P10-3) — the **same row** reactivated: old overrides cleared, the
  invitation's role and overrides applied, `ACTIVE`. Audit `MEMBER_INVITATION_ACCEPTED` (and
  `MEMBER_REACTIVATED`). `200` with `{ weddingId, membershipId, role }`. Access starts with the
  next request. A repeated accept after success is `409`; the token is dead. A pending
  invitation never grants access.

**`POST /member-invitations/{token}/decline`** — token only, so an invitee without an
account can decline. `PENDING` → `DECLINED`, `204`; audited. Same `409`s as accept.

**`PATCH …/members/{membershipId}`** — body `{ role?, permissionOverrides? }` (at least one).

- `role` needs `MEMBERS:CHANGE_ROLE`; `permissionOverrides` (the complete list, replacing the
  stored one) needs `MEMBERS:EDIT_PERMISSIONS`. Each entry
  `{ module, action, effect: "ALLOW" | "DENY" }` with a known module and an action of that
  module; duplicates `400`; at most 64.
- Refused with `403 PERMISSION_DENIED` (audited), `details.reason`:
  `OWNER_MEMBERSHIP_PROTECTED` (an `OWNER` target), `SELF_MODIFICATION_NOT_ALLOWED` (the caller's
  own row), `ADMIN_ROLE_OWNER_ONLY` (a non-owner assigning `ADMIN`), `ADMIN_MEMBERSHIP_OWNER_ONLY`
  (a non-owner changing an `ADMIN`'s role or overrides — P10-4), `GRANT_EXCEEDS_CALLER` (an
  `ALLOW` the caller does not hold). `role: OWNER` and protected actions in an override →
  `400 VALIDATION_FAILED`; owners are made only by transfer.
- `200` with the member (details form). Audit `MEMBER_ROLE_CHANGED` / `MEMBER_PERMISSIONS_CHANGED`
  with old and new values. A role change keeps existing overrides.

**`DELETE …/members/{membershipId}`** — `MEMBERS:REMOVE`. Not for `OWNER` rows, the caller's own
row, or (for non-owners) `ADMIN` rows — `403 PERMISSION_DENIED` with the reasons above. Sets
`REVOKED`; the member's next request to any route of this wedding is `404`; their data stays;
a pending ownership offer to them is cancelled. `204`; repeating is `404`. Audit
`MEMBER_REMOVED`.

**`GET …/audit-logs`** — `AUDIT:VIEW`. Query `action`, `resourceType`, `actorUserId`, `from`,
`to` (dates), `limit` (≤ 100), `cursor`; newest first. Items
`{ id, action, resourceType, resourceId, actorUserId, actorName, metadata, createdAt }` with the
metadata already free of secrets (Database Design §22). Read-only; reads are not audited.

**Ownership-seat transfer (P10-5, Database Design §7.6).** It moves the caller's own seat,
never the whole wedding and never the other owner's seat. Not grantable to non-owners.

- `GET …/ownership-transfers` — owners see every offer of the wedding; a member sees only offers
  made to them. Items `{ id, fromMembershipId, fromName, toMembershipId, toName, ownerSeat,
status, createdAt, respondedAt }`.
- `POST …/ownership-transfers` `{ toMembershipId }` — caller must be an `OWNER` (else
  `403 PERMISSION_DENIED`, `OWNER_ONLY`); the seat is the caller's own. The target must be an
  `ACTIVE` `MEMBER` of this wedding (`404 MEMBER_NOT_FOUND`; an owner target is
  `400 VALIDATION_FAILED`), must not own another wedding (`409 WEDDING_ALREADY_OWNED`, 0012), and
  no other offer may be pending (`409 OWNERSHIP_TRANSFER_ALREADY_PENDING`). `201`. Audit
  `OWNERSHIP_TRANSFER_OFFERED`.
- `…/{transferId}/accept` — only the recipient (`403` otherwise). One transaction
  (Database Design §7.6): offer `ACCEPTED`; giver → `ADMIN` member, seat removed; recipient →
  `OWNER` with that seat; both overrides cleared. Any condition no longer true →
  `409 OWNERSHIP_TRANSFER_NOT_PENDING` (offer cancelled with `MEMBERSHIP_CHANGED`) or
  `409 WEDDING_ALREADY_OWNED`; nothing is applied partially. `200` with both memberships.
  Audit `OWNERSHIP_TRANSFERRED`.
- `…/{transferId}/decline` (recipient) and `…/{transferId}/cancel` (the giving owner) — `204`;
  audited (`OWNERSHIP_TRANSFER_DECLINED`, `_CANCELLED`); a non-pending offer is `409`.
- No expiry is defined; an offer stays pending until one of these happens.

### 7.2 Partner connection (Planned — Phase 16, decision 0038)

| Method | Endpoint                                                | Purpose                        | Permission                |
| ------ | ------------------------------------------------------- | ------------------------------ | ------------------------- |
| GET    | `/weddings/{weddingId}/partner`                         | Partner state of the wedding   | `PARTNER_SHARING:VIEW`    |
| POST   | `/weddings/{weddingId}/partner/invitations`             | Invite the partner `{ email }` | `PARTNER_SHARING:CREATE`  |
| POST   | `/weddings/{weddingId}/partner/invitations/{id}/resend` | New link, expiry reset         | `PARTNER_SHARING:EDIT`    |
| POST   | `/weddings/{weddingId}/partner/invitations/{id}/revoke` | Cancel a pending invitation    | `PARTNER_SHARING:DELETE`  |
| POST   | `/weddings/{weddingId}/partner/leave`                   | The caller leaves the wedding  | `PARTNER_SHARING:DELETE`  |
| GET    | `/partner-invitations/{token}`                          | Public invitation summary      | Token                     |
| POST   | `/partner-invitations/{token}/accept`                   | Accept                         | Signed in, matching email |
| POST   | `/partner-invitations/{token}/decline`                  | Decline                        | Token                     |

- **One shared wedding (D1):** there are no share routes; v1.0's `…/shares` and
  `…/events/{eventId}/share` are not built. Partner invitations are separate from organizer
  invitations (§7.1) and are the only invitations that create an `OWNER` membership.
- `PARTNER_SHARING` is owner-only and never grantable (Database Design §8.3), so organizers get
  `403 PERMISSION_DENIED` on the wedding routes.
- `GET …/partner` returns the wedding's other owner (if any: name, email, since when) and the
  pending invitation (if any: id, invited email, expiry, last sent, whether the email was sent,
  resends left). A second owner from a Phase 10 seat transfer is the partner (D3).
- `POST …/invitations` — `201`; refused while the wedding has two owners
  (`PARTNER_ALREADY_CONNECTED`) or a pending invitation (`PARTNER_INVITATION_ALREADY_PENDING`);
  the inviter's own email is `VALIDATION_FAILED`. The email is sent during the request (0025);
  a failed send returns `emailSent: false` and the invitation stays pending.
- `resend` / `revoke` — only while `PENDING` and not expired (`PARTNER_INVITATION_NOT_PENDING`,
  `PARTNER_INVITATION_EXPIRED`); resend issues a new token and resets the expiry to seven days.
- `leave` — `204`; only while the wedding has two owners (`PARTNER_NOT_CONNECTED`). The caller
  loses access at once (later requests `404`); the other owner remains (D7). There is no route
  to remove the other owner (D8).
- `GET /partner-invitations/{token}` — wedding name, inviter's name, masked invited email,
  expiry and status; nothing else about the wedding. Unknown token: `404
PARTNER_INVITATION_NOT_FOUND`.
- `accept` — `200` with the wedding id. Checks, in order: invitation live
  (`…_NOT_PENDING`, `…_EXPIRED`); account email equals the invited email
  (`PARTNER_INVITATION_EMAIL_MISMATCH`); the caller owns no wedding
  (`PARTNER_INVITEE_OWNS_WEDDING`, D6); a free owner seat (`PARTNER_SEAT_UNAVAILABLE`). Promotes
  an existing organizer (D5) or reactivates a former member (D10) on the same membership.
- `decline` — `204`; grants nothing.
- The email links to the web page `/partner-invite/{token}`; sign-in and sign-up may return
  there (as for member invitations).

## 8. Event API (Phase 4 — decision 0017)

| Method | Endpoint                                 | Purpose              |
| ------ | ---------------------------------------- | -------------------- |
| GET    | `/weddings/{weddingId}/events`           | List active events   |
| POST   | `/weddings/{weddingId}/events`           | Create an event      |
| GET    | `/weddings/{weddingId}/events/{eventId}` | Get an event         |
| PATCH  | `/weddings/{weddingId}/events/{eventId}` | Update an event      |
| DELETE | `/weddings/{weddingId}/events/{eventId}` | Soft-delete an event |

```json
POST /api/v1/weddings/{weddingId}/events
{ "name": "Mehendi", "type": "MEHENDI", "date": "2027-02-16", "startTime": "16:00",
  "endTime": "20:00", "description": null,
  "venue": { "name": "Garden Palace", "address": "Jaipur" },
  "dressCode": "Pastels", "notes": null }

201 → EventDto
{ "id": "…", "name": "Mehendi", "type": "MEHENDI", "date": "2027-02-16",
  "startTime": "16:00", "endTime": "20:00", "timezone": "Asia/Kolkata",
  "description": null, "venue": { "name": "Garden Palace", "address": "Jaipur" },
  "dressCode": "Pastels", "notes": null, "createdAt": "…", "updatedAt": "…" }
```

- Required: `name`, `type`, `date`. Field rules: Phase 4 PRD §3.1. `endTime` requires
  `startTime` and must be later.
- The list is bounded and returned whole, sorted by `date`, then `startTime` (untimed first).
- `DELETE` returns `204`; the event disappears from lists and counts; its assignments and
  invitation history are kept.
- Errors: `400 VALIDATION_FAILED`, `404 WEDDING_NOT_FOUND`, `404 EVENT_NOT_FOUND`
  (missing, deleted or in another wedding).
- **Planned (not Phase 4):** `isPublic`, cover image, map location, `instructions`,
  `publicId`. v1.0's `POST/DELETE …/events/{eventId}/share` routes are not built (0038 D1).

## 9. Guest, assignment and RSVP API (Phase 4 — decision 0017)

| Method | Endpoint                                            | Purpose                                               |
| ------ | --------------------------------------------------- | ----------------------------------------------------- |
| GET    | `/weddings/{weddingId}/guests`                      | List, search and filter guests                        |
| POST   | `/weddings/{weddingId}/guests`                      | Create a guest                                        |
| GET    | `/weddings/{weddingId}/guests/{guestId}`            | Get a guest                                           |
| PATCH  | `/weddings/{weddingId}/guests/{guestId}`            | Update a guest                                        |
| DELETE | `/weddings/{weddingId}/guests/{guestId}`            | Soft-delete a guest and revoke their invitation token |
| GET    | `/weddings/{weddingId}/guests/{guestId}/events`     | The guest's active assignments                        |
| POST   | `/weddings/{weddingId}/guests/{guestId}/events`     | Assign the guest to an event                          |
| PATCH  | `/weddings/{weddingId}/guest-events/{guestEventId}` | Organizer RSVP update                                 |
| DELETE | `/weddings/{weddingId}/guest-events/{guestEventId}` | Remove the assignment (kept as history)               |

```json
POST /api/v1/weddings/{weddingId}/guests
{ "name": "Raju Sharma", "mobile": "+91 98765-43210", "email": "raju@example.com",
  "relation": "Cousin", "notes": "Family" }

201
{ "guest": { "id": "…", "name": "Raju Sharma", "mobile": "+919876543210",
    "email": "raju@example.com", "relation": "Cousin", "notes": "Family",
    "invitation": null, "createdAt": "…", "updatedAt": "…" },
  "duplicateMobileGuests": [ { "id": "…", "name": "Sunita Sharma" } ] }
```

- Required: `name`, `mobile`. `mobile` is stored and returned normalized. Rules: Phase 4
  PRD §4.
- Create and update return `duplicateMobileGuests`: other active guests in the wedding with
  the same normalized mobile. It is a warning; the save always succeeds.
- `guest.invitation` is `null` or `{ deliveryStatus, isRevoked, lastSentAt, firstOpenedAt }`,
  so organizers see invitation state without another endpoint.
- `GET …/guests` query: `search` (name or mobile), `eventId`, `rsvpStatus`, `limit` (max 100),
  `cursor`. Returns `data: GuestDto[]` and `meta.pagination: { nextCursor, hasNextPage }`.
  Sorted alphabetically by name, ignoring case, with the guest ID as tie-breaker (0023).
- `POST …/guests/{guestId}/events` body `{ "eventId": "…" }`. Creates an active assignment
  with `rsvpStatus: "PENDING"`, `attendeeCount: null` and returns `201 GuestEventDto`. If an
  active assignment already exists it is returned unchanged with `200` — never a duplicate.
- `GuestEventDto`: `{ id, guestId, eventId, rsvpStatus, attendeeCount, respondedAt,
rsvpUpdatedAt, createdAt }`.

```json
PATCH /api/v1/weddings/{weddingId}/guest-events/{guestEventId}
{ "rsvpStatus": "ATTENDING", "attendeeCount": 4 }
```

- Both fields are required on every RSVP write. Accepted combinations: `PENDING`/`null`,
  `MAYBE`/`null`, `DECLINED`/`0`, `ATTENDING`/integer ≥ 1. Anything else:
  `400 VALIDATION_FAILED` with `details.fields.attendeeCount`.
- Organizers may set any of the four combinations, including a reset to `PENDING`/`null`;
  each reset to `PENDING` writes an audit entry (0018).
- Records `rsvpUpdatedBy` and `rsvpUpdatedAt`; never changes other assignments or the
  invitation.
- `DELETE …/guest-events/{id}` returns `204` and marks the assignment removed.
- `DELETE …/guests/{guestId}` returns `204`, soft-deletes the guest and revokes their
  invitation token at once; their assignments and invitation history are kept (0018).
  Updating a guest's mobile or email never changes the token.
- Field limits: Phase 4 PRD §3.1 and §4 (approved, 0019 #6).
- Errors: `400 VALIDATION_FAILED`, `404 WEDDING_NOT_FOUND`, `404 GUEST_NOT_FOUND`,
  `404 EVENT_NOT_FOUND`, `404 GUEST_EVENT_NOT_FOUND`. IDs from another wedding are `404`.

## 10. Invitation API (Phase 4 — decisions 0008, 0017, 0018, 0019)

Organizer routes (all `/api/v1/weddings/{weddingId}/guests/{guestId}/invitation…`):

| Method | Endpoint suffix          | Purpose                                      | Success |
| ------ | ------------------------ | -------------------------------------------- | ------- |
| POST   | `/invitation`            | Create the invitation and its first token    | `201`   |
| POST   | `/invitation/regenerate` | Replace the token; the old one stops working | `200`   |
| POST   | `/invitation/send`       | Send the invitation email                    | `202`   |
| POST   | `/invitation/resend`     | Send it again                                | `202`   |
| POST   | `/invitation/revoke`     | Revoke the token                             | `200`   |
| GET    | `/invitation/link`       | The current link, for Copy Link and WhatsApp | `200`   |
| GET    | `/invitation/deliveries` | Delivery history and activity history        | `200`   |

Guest routes (account-free, token in the path):

| Method | Endpoint                          | Purpose                |
| ------ | --------------------------------- | ---------------------- |
| GET    | `/guest/invitations/{token}`      | Open the invitation    |
| PATCH  | `/guest/invitations/{token}/rsvp` | Submit or update RSVPs |

- `InvitationDto`: `{ guestId, deliveryStatus, isRevoked, tokenCreatedAt, lastSentAt,
firstOpenedAt }`. Create and regenerate also return `invitationUrl`
  (`https://makemymarriage.com/invite/{token}`).
- `409 INVITATION_ALREADY_EXISTS` when creating twice; `404 INVITATION_NOT_FOUND` for
  operations before creation; `409 INVITATION_REVOKED` for send or resend while revoked; regenerate (allowed while
  revoked) returns the invitation with `deliveryStatus: "DRAFT"` and `isRevoked: false`, and
  revoke leaves `deliveryStatus` unchanged (0020);
  `422 GUEST_EMAIL_REQUIRED` for send or resend without a guest email.
- The email carries the link that is current when it is sent. If the link is regenerated or
  revoked while the email is being sent, the attempt is recorded but the status is not
  updated (0020).
- Send and resend accept an optional `Idempotency-Key` header; each attempt becomes an
  `invitation_deliveries` record. The API sends the email during the request, decrypting the
  stored token copy to build the link, and records the attempt before responding (0025), so
  the `202` response arrives with the attempt already recorded. The same key sends at most
  once. Resends reuse the same token. The attempt and the invitation's status become `SENT`
  when the provider accepts the request and `FAILED`, with the provider's reason, when it
  rejects it (0018) — or with "The email service could not be reached." when the provider
  cannot be reached. There is no automatic retry; the organizer resends (0025).
  `DELIVERED`, and failures reported after acceptance, need provider webhooks (not in Phase 4).
- `GET …/deliveries` returns
  `{ deliveries: [{ attemptNumber, kind, status, sentAt, failedAt, failureReason, createdAt }],
activities: [{ type, occurredAt }] }`.

```json
GET /api/v1/guest/invitations/{token}
200
{ "data": {
    "guest": { "name": "Raju Sharma" },
    "wedding": { "displayName": "Meera Sharma & Arjun Patel", "startDate": "2027-02-18",
                 "timezone": "Asia/Kolkata" },
    "events": [ { "guestEventId": "…", "name": "Haldi", "type": "HALDI",
                  "date": "2027-02-17", "startTime": "10:00", "endTime": null,
                  "venue": { "name": "…", "address": "…" }, "dressCode": null,
                  "description": null, "rsvpStatus": "PENDING", "attendeeCount": null } ] },
  "meta": { … } }
```

- Returns only the guest's active assignments to active events. Never returns organizer
  notes, mobile, email, other guests, the wedding ID or event IDs. `guestEventId` identifies
  the guest's own assignment for the RSVP request.
- Opening records an `OPENED` activity (the first open is also stored on the invitation);
  it never changes `deliveryStatus`.

```json
PATCH /api/v1/guest/invitations/{token}/rsvp
{ "responses": [ { "guestEventId": "…", "rsvpStatus": "ATTENDING", "attendeeCount": 4 },
                 { "guestEventId": "…", "rsvpStatus": "DECLINED", "attendeeCount": 0 } ] }
200 → the same payload as GET
```

- Same status/count rules as section 9; a guest may never send `PENDING`. The whole request
  is rejected if any response is invalid or names an assignment that is not the guest's.
- Unknown, revoked and regenerated tokens, and tokens of deleted guests, all return the same
  `404 INVITATION_NOT_FOUND`.
  Both guest routes are rate-limited: 120 requests a minute per IP and 60 per token
  (`429 RATE_LIMITED`); every request counts, including invalid tokens (0023).
- No automatic token expiry in Phase 4 (0017 #8).

**Token storage (0018).** The token is stored as a hash, used to look up guest requests,
and as an encrypted copy, decrypted only by the server to send and resend the email. The
encryption key is held outside the database and never logged. No endpoint returns the
token, its hash or its ciphertext; only create, regenerate and the link route return
`invitationUrl`.

**Link retrieval (0019).** `GET …/invitation/link` returns `{ invitationUrl }` for the current
token by decrypting the stored copy; it never creates or changes a token. It needs an `ACTIVE`
membership of the wedding like every organizer route, writes an audit entry for each
retrieval, and never logs the token. Errors: `404 INVITATION_NOT_FOUND` before the invitation
exists; `409 INVITATION_REVOKED` while revoked. Copy Link and WhatsApp reuse this link; only
regenerate replaces it.

## 11. Notification and reminder API (Planned)

| Method | Endpoint                                       | Purpose                  |
| ------ | ---------------------------------------------- | ------------------------ |
| GET    | `/notifications`                               | The user's notifications |
| PATCH  | `/notifications/{notificationId}/read`         | Mark one read            |
| POST   | `/notifications/read-all`                      | Mark all read            |
| GET    | `/weddings/{weddingId}/reminders`              | Reminder configuration   |
| POST   | `/weddings/{weddingId}/reminders`              | Create a reminder        |
| PATCH  | `/weddings/{weddingId}/reminders/{reminderId}` | Update a reminder        |
| DELETE | `/weddings/{weddingId}/reminders/{reminderId}` | Disable or delete        |

Reminder routes are not exposed until reminder cadence and customization are decided
(PRD v1.2 §14).

## 12. Expense API (Planned — Phase 8; decisions 0009, 0010 and 0028)

| Method | Endpoint                                                          | Purpose                 |
| ------ | ----------------------------------------------------------------- | ----------------------- |
| GET    | `/weddings/{weddingId}/expenses`                                  | List, filter and totals |
| POST   | `/weddings/{weddingId}/expenses`                                  | Create                  |
| GET    | `/weddings/{weddingId}/expenses/{expenseId}`                      | Get                     |
| PATCH  | `/weddings/{weddingId}/expenses/{expenseId}`                      | Update                  |
| DELETE | `/weddings/{weddingId}/expenses/{expenseId}`                      | Soft-delete             |
| GET    | `/weddings/{weddingId}/expenses/{expenseId}/payments`             | List payments           |
| POST   | `/weddings/{weddingId}/expenses/{expenseId}/payments`             | Add a payment           |
| PATCH  | `/weddings/{weddingId}/expenses/{expenseId}/payments/{paymentId}` | Update a payment        |
| DELETE | `/weddings/{weddingId}/expenses/{expenseId}/payments/{paymentId}` | Remove a payment        |
| POST   | `/weddings/{weddingId}/expenses/{expenseId}/receipts/upload-url`  | Deferred (0028 #3)      |
| DELETE | `/weddings/{weddingId}/expenses/{expenseId}/receipts/{receiptId}` | Deferred (0028 #3)      |

Behaviour: [Phase 8 PRD v1.0](PHASE_8_PRD_v1.0.md).

```json
POST /api/v1/weddings/{weddingId}/expenses
{ "title": "Decorator", "amountMinor": 15000000, "category": "DECORATION",
  "eventId": "…", "expenseDate": "2027-01-20", "notes": null }

POST /api/v1/weddings/{weddingId}/expenses/{expenseId}/payments
{ "amountMinor": 5000000, "paymentDate": "2027-01-20",
  "paidByType": "EXTERNAL_PERSON", "paidByName": "Bride's father",
  "paymentMethod": "UPI", "referenceNumber": null, "notes": "Advance" }
```

- **No `visibility` field**; expenses are shared with the connected partner (0009); normal
  `VIEW` permission applies. Any `ACTIVE` member may use every route in Phase 8 (0028 #19).
- **Money** is integer paise (₹50,000 = 5000000). `amountMinor`: 1 to 10,000,000,000
  (₹10 crore). `currency` is always `INR` and set by the server.
- **Expense fields:** `title` (required, 1–150), `amountMinor` (required), `category`
  (required, a fixed `ExpenseCategory` value — 0010 #7), `expenseDate` (required,
  `YYYY-MM-DD`), `eventId` (an active event of the wedding, or `null` for the whole wedding),
  `notes` (at most 1,000), and from Phase 9 `vendorId` (a vendor of the wedding that is not
  deleted, or `null` for none — or, on an edit, the expense's existing vendor even after it
  is deleted (0032 #17)). `paymentStatus`, `currency` and `description` are not accepted
  (0028 #7, #11).
- **Expense DTO** adds `id`, `currency`, `paidMinor`, `pendingMinor`, `paymentStatus`
  (calculated — 0028 #7), `eventName`, `vendorName` and `vendorDeleted` (Phase 9) and
  timestamps. Create returns `201`, update `200`.
- **Payment fields:** `amountMinor` (required, more than 0), `paymentDate` (required,
  `YYYY-MM-DD`, today or earlier in the wedding's timezone), `paidByType` (`WEDDING_MEMBER`
  with `paidByUserId` of an active member — or, on an edit, the payment's existing member payer
  even after they leave the wedding (0030) —, or `EXTERNAL_PERSON` with `paidByName`, 1–100),
  `paymentMethod` (optional), `referenceNumber` (at most 100), `notes` (at most 500).
- **Payment DTO** adds `id`, `paidByName` (the member's display name for a member) and
  timestamps. Add returns `201`, update `200`, remove `204`; the list is oldest first. Each
  change updates the expense's `paidMinor` and `paymentStatus` in one transaction (0028 #8).
- **Money rules:** a payment that would take the paid total above `amountMinor` returns
  `409 PAYMENT_EXCEEDS_BALANCE`; lowering `amountMinor` below the paid total returns
  `409 AMOUNT_BELOW_PAID`. Both give `details.remainingMinor` or `details.paidMinor`.
- **List** `GET …/expenses`: `category`, `eventId` (an event ID, or `none` for whole-wedding
  expenses), `paymentStatus`, `search` (title contains, ignoring case), `limit` (25) and
  `cursor` (§24). Order: `expenseDate` newest first, then `createdAt` newest first.
  `meta.totals` `{ totalMinor, paidMinor, pendingMinor }` covers every expense matching the
  filters, not only the page. From Phase 9, `vendorId` filters to one vendor's expenses; it is
  used by the vendor page only — the expense list screen has no vendor filter (0032 #23).
- **Delete** is a soft delete: the expense leaves every list, total and route (`404`); its
  payments are kept. Expense and payment changes are audited (0028 #18).
- **Errors:** `400 VALIDATION_FAILED`; `404 WEDDING_NOT_FOUND`, `404 EXPENSE_NOT_FOUND`,
  `404 PAYMENT_NOT_FOUND`, `404 EVENT_NOT_FOUND` (event outside the wedding or deleted),
  `404 MEMBER_NOT_FOUND` (payer who is not an active member), `404 VENDOR_NOT_FOUND` (vendor
  outside the wedding, or newly chosen and deleted); the two `409` codes above.

## 13. Task API (Planned — Phase 7, decision 0026)

| Method | Endpoint                                                  | Purpose       |
| ------ | --------------------------------------------------------- | ------------- |
| GET    | `/weddings/{weddingId}/tasks`                             | List, filter  |
| POST   | `/weddings/{weddingId}/tasks`                             | Create        |
| GET    | `/weddings/{weddingId}/tasks/{taskId}`                    | Get           |
| PATCH  | `/weddings/{weddingId}/tasks/{taskId}`                    | Update        |
| DELETE | `/weddings/{weddingId}/tasks/{taskId}`                    | Soft-delete   |
| POST   | `/weddings/{weddingId}/tasks/{taskId}/assignees`          | Assign a user |
| DELETE | `/weddings/{weddingId}/tasks/{taskId}/assignees/{userId}` | Unassign      |
| GET    | `/weddings/{weddingId}/tasks/{taskId}/activities`         | History       |

Statuses `TODO`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `CANCELLED` (0010 #3, 0013).
Behaviour: [Phase 7 PRD v1.0](PHASE_7_PRD_v1.0.md).

- **Fields:** `title` (required, 1–150), `description` and `notes` (each at most 1,000),
  `status` (default `TODO`), `priority` (default `MEDIUM`), `dueDate` (`YYYY-MM-DD` or
  `null`), `eventId` (an active event of the wedding, or `null` for a whole-wedding task).
  Notes are a field, not a separate endpoint. **Attachment endpoints are deferred** (0026 #3).
  Create and update also accept `assigneeIds`, the complete set of assignees, so a form saves
  them with the task; the assign and unassign routes change one member at a time.
- **Task DTO** adds `id`, `eventName`, `assignees` (member user IDs and display names),
  `isOverdue`, `isDueToday` and timestamps. Create and update return `201` and `200` with it;
  assign and unassign return `200` with it.
- **History** `GET …/activities`: newest first, each with `action` (`CREATED`, `UPDATED`,
  `STATUS_CHANGED`, `EVENT_CHANGED`, `EVENT_DELETED`, `ASSIGNEE_ADDED`, `ASSIGNEE_REMOVED`,
  `DELETED`), `actorName`, `subjectName` (for assignee changes), `oldValue`, `newValue` and
  `createdAt`. Edited descriptions and notes are named in `newValue.fields`, not copied.
- **List** `GET …/tasks`: `status` (repeatable; default every status except `CANCELLED`),
  `priority`, `eventId` (an event ID, or `none` for whole-wedding tasks), `overdue=true`,
  `assignedToMe=true`, `search` (title contains, ignoring case), `limit` (25) and `cursor`
  (§24). Order: `dueDate` ascending with undated last, then priority `URGENT` → `LOW`, then
  newest first.
- Any status may change to any other. Assigning a member already assigned changes nothing.
- **Delete** is a soft delete: the task leaves every list, count and route (`404`); its
  history is kept and an audit entry is written.
- **Errors:** `400 VALIDATION_FAILED`; `404 WEDDING_NOT_FOUND`, `404 TASK_NOT_FOUND`,
  `404 EVENT_NOT_FOUND` (event outside the wedding or deleted), `404 MEMBER_NOT_FOUND`
  (assignee who is not an active member).

## 14. Vendor API (Phase 9, decision 0032; implemented in PR #31)

| Method | Endpoint                                                          | Purpose                  |
| ------ | ----------------------------------------------------------------- | ------------------------ |
| GET    | `/weddings/{weddingId}/vendors`                                   | List, search, filter     |
| POST   | `/weddings/{weddingId}/vendors`                                   | Add a vendor             |
| GET    | `/weddings/{weddingId}/vendors/{vendorId}`                        | Get                      |
| PATCH  | `/weddings/{weddingId}/vendors/{vendorId}`                        | Update                   |
| DELETE | `/weddings/{weddingId}/vendors/{vendorId}`                        | Soft-delete              |
| GET    | `/weddings/{weddingId}/vendors/{vendorId}/bookings`               | The vendor's bookings    |
| POST   | `/weddings/{weddingId}/vendors/{vendorId}/bookings`               | Add a booking            |
| GET    | `/weddings/{weddingId}/vendors/{vendorId}/bookings/{bookingId}`   | Get a booking            |
| PATCH  | `/weddings/{weddingId}/vendors/{vendorId}/bookings/{bookingId}`   | Update, cancel or reopen |
| POST   | `/weddings/{weddingId}/vendors/{vendorId}/attachments/upload-url` | Deferred (0032 #6)       |
| GET    | `/weddings/{weddingId}/vendor-discovery/search`                   | Deferred (0032 #3)       |
| GET    | `/weddings/{weddingId}/vendor-discovery/{providerPlaceId}`        | Deferred (0032 #3)       |
| POST   | `/weddings/{weddingId}/vendor-discovery/{providerPlaceId}/add`    | Deferred (0032 #3)       |

Behaviour: [Phase 9 PRD v1.0](PHASE_9_PRD_v1.0.md).

```json
POST /api/v1/weddings/{weddingId}/vendors
{ "name": "Shree Mehendi Arts", "category": "MEHENDI", "contactPerson": "Kavita",
  "phone": "+91 98765 43210", "email": null, "address": null, "website": null, "notes": null }

POST /api/v1/weddings/{weddingId}/vendors/{vendorId}/bookings
{ "title": "Bridal mehendi", "status": "NEGOTIATING", "bookingDate": null,
  "serviceDate": "2027-02-16", "eventId": "…", "agreedPriceMinor": 2500000, "notes": null }
```

- Any `ACTIVE` member may use every route in Phase 9 (0032 #19). Vendor data is never
  returned by public or guest endpoints.
- **Vendor fields:** `name` (required, 1–150), `category` (required, a fixed `VendorCategory`
  value — 0032 #9), `contactPerson` (at most 150), `phone` (7–15 digits, optional leading `+`,
  spaces and hyphens), `email` (valid, at most 254, lower-cased), `address` (at most 500),
  `website` (absolute `http`/`https` URL, at most 500), `notes` (at most 1,000).
- **Vendor DTO** adds `id`, `bookingCounts { booked, inProgress, cancelled }` (`inProgress`:
  `NOT_CONTACTED`, `CONTACTED`, `QUOTATION_RECEIVED` and `NEGOTIATING`) and timestamps. Create
  returns `201`, update `200`, delete `204`.
- **List** `GET …/vendors`: `search` (name contains, ignoring case), `category`,
  `bookingStatus`, `eventId` (an event ID, or `none` for whole-wedding bookings), `limit` (25)
  and `cursor` (§24). `bookingStatus` and `eventId` select vendors with at least one booking
  matching both. Order: `name` ascending, ignoring case, then `_id`.
- **Delete** is a soft delete. While any booking of the vendor is not `CANCELLED` it returns
  `409 VENDOR_HAS_ACTIVE_BOOKINGS` with `details.activeBookings`. A deleted vendor's routes,
  bookings included, return `404`; its bookings and linked expenses are kept (0032 #15).
- **Booking fields:** `title` (required, 1–150), `status` (default `NOT_CONTACTED`; one of
  `NOT_CONTACTED`, `CONTACTED`, `QUOTATION_RECEIVED`, `NEGOTIATING`, `BOOKED`, `CANCELLED`),
  `bookingDate` and `serviceDate` (`YYYY-MM-DD` or `null`), `eventId` (an active event of the
  wedding, or `null` for the whole wedding), `agreedPriceMinor` (`null`, or 1 to
  10,000,000,000), `notes` (at most 1,000). The vendor is the one in the path and cannot be
  changed.
- **Booking DTO** adds `id`, `vendorId`, `vendorName`, `eventName` and timestamps. Create
  returns `201`, update `200`. There is no booking `DELETE`: cancelling is `PATCH` with
  `status: "CANCELLED"`, and any status may change to any other (0032 #13, #14).
- **Bookings list** `GET …/bookings`: every booking of the vendor, `CANCELLED` included;
  `serviceDate` ascending with undated last, then `createdAt` newest first. Not paginated (a
  bounded list, §3).
- Creating a booking and reopening one write a claim on the vendor in the same transaction,
  so a concurrent vendor deletion conflicts; linking a booking to an event claims the event
  the same way. Vendor, booking and status changes are audited (0032 #18).
- **Errors:** `400 VALIDATION_FAILED`; `404 WEDDING_NOT_FOUND`, `404 VENDOR_NOT_FOUND`,
  `404 VENDOR_BOOKING_NOT_FOUND`, `404 EVENT_NOT_FOUND` (event outside the wedding or
  deleted); `409 VENDOR_HAS_ACTIVE_BOOKINGS`.
- **Deferred:** the attachment route (0032 #6) and vendor discovery (0032 #3). When discovery
  is approved, the web app calls MakeMyMarriage, never Google directly, and results are not
  vendors until added.

## 15. Wedding website API (Planned — decision 0016; answer Q4)

| Method | Endpoint                                    | Purpose                |
| ------ | ------------------------------------------- | ---------------------- |
| GET    | `/weddings/{weddingId}/website`             | Website configuration  |
| PATCH  | `/weddings/{weddingId}/website`             | Update configuration   |
| POST   | `/weddings/{weddingId}/website/publish`     | Publish                |
| POST   | `/weddings/{weddingId}/website/unpublish`   | Unpublish              |
| GET    | `/public/w/{publicIdentifier}`              | Public website payload |
| GET    | `/public/w/{publicIdentifier}/events`       | Public events          |
| GET    | `/public/w/{publicIdentifier}/gallery`      | Public gallery         |
| GET    | `/public/w/{publicIdentifier}/live-streams` | Public live streams    |

- Public endpoints resolve by `publicIdentifier` and return only public or shared data —
  never wedding IDs, private notes, private guests, membership data or expenses.
- Published websites are indexable by search engines; sitemap, metadata and crawler
  directives are specified in the Wedding website phase.

## 16. Gallery and memory QR API (Planned)

| Method | Endpoint                                             | Purpose                    |
| ------ | ---------------------------------------------------- | -------------------------- |
| GET    | `/weddings/{weddingId}/photos`                       | Gallery photos             |
| POST   | `/weddings/{weddingId}/photos/upload-url`            | Upload URL                 |
| DELETE | `/weddings/{weddingId}/photos/{photoId}`             | Delete a managed photo     |
| GET    | `/weddings/{weddingId}/memory-qrs`                   | List QR codes              |
| POST   | `/weddings/{weddingId}/memory-qrs`                   | Generate a QR              |
| POST   | `/weddings/{weddingId}/memory-qrs/{qrId}/regenerate` | Revoke and create new      |
| POST   | `/weddings/{weddingId}/memory-qrs/{qrId}/revoke`     | Revoke                     |
| GET    | `/guest/memory/{token}`                              | Open the guest upload flow |
| POST   | `/guest/memory/{token}/upload-url`                   | Guest upload URL           |
| DELETE | `/guest/memory/{token}/photos/{photoId}`             | Guest deletes own upload   |

QR tokens are random and never derived from IDs; an event QR scopes uploads to the event;
guest uploads publish automatically; binaries go to S3.

## 17. Live stream API (Planned)

| Method | Endpoint                                                    | Purpose               |
| ------ | ----------------------------------------------------------- | --------------------- |
| GET    | `/weddings/{weddingId}/events/{eventId}/live-streams`       | List event streams    |
| POST   | `/weddings/{weddingId}/events/{eventId}/live-streams`       | Associate a stream    |
| PATCH  | `/weddings/{weddingId}/live-streams/{streamId}`             | Update                |
| DELETE | `/weddings/{weddingId}/live-streams/{streamId}`             | Remove                |
| GET    | `/public/w/{publicIdentifier}/events/{eventId}/live-stream` | Public stream payload |

## 18. Reports API (Planned — Excel only)

| Method | Endpoint                                                    | Purpose              |
| ------ | ----------------------------------------------------------- | -------------------- |
| POST   | `/weddings/{weddingId}/reports/guest/export`                | Guest Excel report   |
| POST   | `/weddings/{weddingId}/reports/expense/export`              | Expense Excel report |
| POST   | `/weddings/{weddingId}/reports/task/export`                 | Task Excel report    |
| GET    | `/weddings/{weddingId}/reports/exports`                     | List export jobs     |
| GET    | `/weddings/{weddingId}/reports/exports/{exportId}`          | Export status        |
| GET    | `/weddings/{weddingId}/reports/exports/{exportId}/download` | Download             |

## 19. Settings and management API (Planned)

| Method | Endpoint                            | Purpose                    |
| ------ | ----------------------------------- | -------------------------- |
| GET    | `/weddings/{weddingId}/settings`    | Permission-scoped settings |
| PATCH  | `/weddings/{weddingId}/settings`    | Update settings            |
| GET    | `/weddings/{weddingId}/permissions` | Effective permissions      |
| GET    | `/weddings/{weddingId}/audit-logs`  | Authorized audit history   |

## 20. Standard response envelope

```json
{ "data": { … }, "meta": { "requestId": "req_…", "timestamp": "2026-09-24T12:00:00Z" } }

{ "data": [ … ], "meta": { "requestId": "req_…",
  "pagination": { "nextCursor": "…", "hasNextPage": true } } }
```

`requestId` also appears in structured logs. No stack traces or internal provider or
database errors are returned. A `204` response has no body.

## 21. Standard error contract

```json
{
  "error": {
    "code": "GUEST_EVENT_NOT_FOUND",
    "message": "The requested guest-event relationship was not found.",
    "details": {},
    "requestId": "req_…"
  }
}
```

`VALIDATION_FAILED` puts field messages in `details.fields`: `{ "attendeeCount": ["…"] }`.

| HTTP    | Use                                    |
| ------- | -------------------------------------- |
| 400     | Malformed request or invalid input     |
| 401     | Missing or invalid authentication      |
| 403     | Authenticated but not authorized       |
| 404     | Not found, or intentionally hidden     |
| 409     | Business or uniqueness conflict        |
| 422     | Semantically invalid request           |
| 429     | Rate limit exceeded                    |
| 500     | Unexpected server error                |
| 502/503 | Upstream provider or temporary failure |

Error codes in use or approved:

| Code                                 | HTTP | Where                                                                                                                                 |
| ------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `VALIDATION_FAILED`                  | 400  | Any DTO or rule violation                                                                                                             |
| `UNAUTHENTICATED`                    | 401  | No or ended session                                                                                                                   |
| `INVALID_CREDENTIALS`                | 401  | Sign-in (0015)                                                                                                                        |
| `EMAIL_ALREADY_REGISTERED`           | 409  | Registration (0015)                                                                                                                   |
| `RESET_TOKEN_INVALID`                | 400  | Password reset (0015)                                                                                                                 |
| `RATE_LIMITED`                       | 429  | Rate limits                                                                                                                           |
| `WEDDING_ALREADY_OWNED`              | 409  | Create wedding (0016)                                                                                                                 |
| `WEDDING_NOT_FOUND`                  | 404  | Any wedding route (0016)                                                                                                              |
| `EVENT_NOT_FOUND`                    | 404  | Phase 4                                                                                                                               |
| `GUEST_NOT_FOUND`                    | 404  | Phase 4                                                                                                                               |
| `GUEST_EVENT_NOT_FOUND`              | 404  | Phase 4                                                                                                                               |
| `INVITATION_NOT_FOUND`               | 404  | Phase 4 (organizer and guest routes)                                                                                                  |
| `INVITATION_ALREADY_EXISTS`          | 409  | Phase 4                                                                                                                               |
| `INVITATION_REVOKED`                 | 409  | Phase 4                                                                                                                               |
| `GUEST_EMAIL_REQUIRED`               | 422  | Phase 4                                                                                                                               |
| `EXPENSE_NOT_FOUND`                  | 404  | Phase 8                                                                                                                               |
| `PAYMENT_NOT_FOUND`                  | 404  | Phase 8                                                                                                                               |
| `PAYMENT_EXCEEDS_BALANCE`            | 409  | Phase 8 (0028 #9)                                                                                                                     |
| `AMOUNT_BELOW_PAID`                  | 409  | Phase 8 (0028 #10)                                                                                                                    |
| `VENDOR_NOT_FOUND`                   | 404  | Phase 9                                                                                                                               |
| `VENDOR_BOOKING_NOT_FOUND`           | 404  | Phase 9                                                                                                                               |
| `VENDOR_HAS_ACTIVE_BOOKINGS`         | 409  | Phase 9 (0032 #15)                                                                                                                    |
| `PERMISSION_DENIED`                  | 403  | Phase 10: active member lacking the permission; `details.reason` (e.g. `OWNER_MEMBERSHIP_PROTECTED`, `SELF_MODIFICATION_NOT_ALLOWED`) |
| `MEMBER_NOT_FOUND`                   | 404  | Phase 8 (payers); Phase 10 members                                                                                                    |
| `MEMBER_ALREADY_ACTIVE`              | 409  | Phase 10                                                                                                                              |
| `MEMBER_INVITATION_NOT_FOUND`        | 404  | Phase 10                                                                                                                              |
| `MEMBER_INVITATION_ALREADY_PENDING`  | 409  | Phase 10                                                                                                                              |
| `MEMBER_INVITATION_NOT_PENDING`      | 409  | Phase 10 (`details.status`)                                                                                                           |
| `MEMBER_INVITATION_EXPIRED`          | 409  | Phase 10                                                                                                                              |
| `MEMBER_INVITATION_EMAIL_MISMATCH`   | 403  | Phase 10                                                                                                                              |
| `OWNERSHIP_TRANSFER_ALREADY_PENDING` | 409  | Phase 10                                                                                                                              |
| `OWNERSHIP_TRANSFER_NOT_PENDING`     | 409  | Phase 10                                                                                                                              |
| `OWNERSHIP_TRANSFER_NOT_FOUND`       | 404  | Phase 10: an unknown offer, or one of another wedding                                                                                 |
| `PARTNER_INVITATION_NOT_FOUND`       | 404  | Phase 16: unknown token or invitation                                                                                                 |
| `PARTNER_ALREADY_CONNECTED`          | 409  | Phase 16: the wedding has two owners                                                                                                  |
| `PARTNER_INVITATION_ALREADY_PENDING` | 409  | Phase 16                                                                                                                              |
| `PARTNER_INVITATION_NOT_PENDING`     | 409  | Phase 16 (`details.status`)                                                                                                           |
| `PARTNER_INVITATION_EXPIRED`         | 409  | Phase 16                                                                                                                              |
| `PARTNER_INVITATION_EMAIL_MISMATCH`  | 403  | Phase 16                                                                                                                              |
| `PARTNER_INVITEE_OWNS_WEDDING`       | 409  | Phase 16: transfer that wedding's ownership first (0038 D6)                                                                           |
| `PARTNER_SEAT_UNAVAILABLE`           | 409  | Phase 16: no free owner seat at acceptance                                                                                            |
| `PARTNER_NOT_CONNECTED`              | 409  | Phase 16: leaving while the wedding has one owner                                                                                     |

## 22. Validation and DTO strategy

Every write endpoint has a DTO; required fields, types, lengths, formats, enums and
cross-field rules are validated; emails and other canonical fields are normalized; unknown
fields are rejected; ObjectId path parameters are validated before repository access;
referenced resources must belong to the same wedding; uploads validate type, size and
signature; business rules stay in application services.

## 23. Authorization model

```text
Request → authentication guard → resolve weddingId → membership lookup → ACTIVE check
        → role + overrides → controller
        → application service → repository (weddingId-scoped query)
```

From Phase 10 each route declares its required `(module, action)` (Database Design §8); the
wedding access guard resolves the membership and its effective permissions once per request,
and a permission check (a decorator plus a guard, System Design §7.7) refuses with
`403 PERMISSION_DENIED`. Services still scope every query by `weddingId`.

Required permissions for the built routes (Phases 3–9) and the next ones:

| Routes                                                                 | Required permission                                                                                                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /weddings`, `GET /weddings/{id}`                                  | Active membership                                                                                                                                 |
| `PATCH /weddings/{id}`                                                 | `WEDDING_SETTINGS:EDIT`                                                                                                                           |
| `DELETE /weddings/{id}` (planned)                                      | Owner only (protected)                                                                                                                            |
| `GET …/dashboard`                                                      | Active membership; each section only with `VIEW` on its module (§6, P10-8)                                                                        |
| Events `GET` / `POST` / `PATCH` / `DELETE`                             | `EVENTS:VIEW` / `CREATE` / `EDIT` / `DELETE`                                                                                                      |
| Guests and guest-event assignments                                     | `GUESTS:VIEW` / `CREATE` / `EDIT` / `DELETE`                                                                                                      |
| Organizer RSVP changes (`PATCH …/guest-events/{id}`, reset to Pending) | `INVITATIONS:EDIT`                                                                                                                                |
| `GET …/invitation`, `…/deliveries`                                     | `INVITATIONS:VIEW`                                                                                                                                |
| Create the invitation                                                  | `INVITATIONS:CREATE`                                                                                                                              |
| `…/invitation/send`, `…/resend`, `…/link` (guest link)                 | `INVITATIONS:SEND` — owner-only by default, grantable (P10-6); audited                                                                            |
| `…/invitation/regenerate`, `…/revoke`                                  | `INVITATIONS:MANAGE` — owner-only by default, grantable (P10-6); audited                                                                          |
| Tasks, assignees, activities                                           | `TASKS:VIEW` / `CREATE` / `EDIT` / `DELETE` (assignee changes are `EDIT`; any active member may be chosen — §7.1)                                 |
| Expenses and payments                                                  | `EXPENSES:VIEW` / `CREATE` / `EDIT` / `DELETE` (a payment: add `CREATE`, edit `EDIT`, remove `DELETE`; any active member may be the payer — §7.1) |
| Vendors and bookings                                                   | `VENDORS:VIEW` / `CREATE` / `EDIT` / `DELETE` (cancel or reopen a booking: `EDIT`)                                                                |
| Members, invitations, audit, ownership                                 | §7.1                                                                                                                                              |
| Partner (Phase 16)                                                     | `PARTNER_SHARING:VIEW` / `CREATE` / `EDIT` / `DELETE` — owner-only (§7.2)                                                                         |
| Website, gallery, QR, live stream, reports (planned)                   | Their module's actions, including `WEBSITE:PUBLISH`, `MEMORY_QR:REGENERATE` (owner-only by default, P10-6), `REPORTS:EXPORT`                      |

- Side effects run with the permission of the action that causes them: deleting an event
  (`EVENTS:DELETE`) still turns its tasks, expenses and bookings into whole-wedding items
  without the caller needing those modules' permissions.
- A list of another module's items embedded in a response (for example the event picker on a
  task form) needs `VIEW` on that module; without it the field is omitted.
- Guest-token and public-website routes are unchanged: they never use memberships.

**Rollout over the built routes (Phases 4–9).** Decisions 0026 #14, 0028 #19 and 0032 #19 let
any `ACTIVE` member do everything with tasks, expenses and vendors, and the Phase 4 routes
(events, guests, invitations, RSVP) and the dashboard likewise rely only on the wedding access
guard. Phase 10 replaces that rule; there is no fallback:

1. Inventory every controller route under `/weddings/{weddingId}` (generated OpenAPI contract)
   and give each one exactly one `(module, action)` from the table above.
2. Enforce it centrally: the permission guard runs on every wedding route; a route without a
   declared permission fails a contract test (only routes explicitly marked "membership
   only" — `GET /weddings`, `GET /weddings/{id}`, `GET …/dashboard`, `GET …/members`,
   `GET …/members/me/permissions`, and the five ownership-transfer routes, whose owner,
   recipient and giver checks are in the service (§7.1) — are exempt).
3. Keep the existing tenant checks: the guard's `ACTIVE` lookup and the `weddingId` filter in
   every repository; IDs of other weddings stay `404`.
4. Move the dashboard to per-section permissions (§6).
5. Move guest-link sending, link retrieval, regeneration and revocation to
   `INVITATIONS:SEND` / `INVITATIONS:MANAGE`.
6. Tests for every route: an allowed role; a role without the permission (`403`); a revoked
   member (`404` on the next request); a member of another wedding (`404`); a `DENY` override
   beating the role default; an `ALLOW` override granting a Custom action.

Until Phase 10 is built only `OWNER` members exist, and owners pass every check.

## 24. Pagination, filtering and sorting

```text
GET /weddings/{weddingId}/guests?search=raju&eventId=…&rsvpStatus=ATTENDING&limit=25&cursor=…
GET /weddings/{weddingId}/expenses?category=DECORATION&eventId=none&paymentStatus=PENDING
    &search=decor&limit=25&cursor=…
```

Server-enforced maximum page size; stable indexed sort keys for cursors; allow-listed
parameters; no MongoDB operators from query strings.

## 25. Idempotency and duplicate protection

| Operation              | Strategy                                                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Create guest           | Normal POST; duplicate mobile produces a warning, never a block                                                                                |
| Assign guest to event  | Partial unique active assignment; repeat returns the existing one                                                                              |
| Send/resend invitation | Each attempt is a delivery record; optional `Idempotency-Key`; jobs idempotent                                                                 |
| Partner invitation     | One open per wedding (`409`); accept, decline, resend, revoke and leave are conditional, so a repeat is `409`, never a second owner            |
| Member invitation      | One pending per wedding and email (`409`); accept/decline/revoke are conditional on `PENDING`, so a repeat is `409`, never a second membership |
| Ownership transfer     | One open offer per wedding; acceptance conditional on `PENDING`                                                                                |
| Create payment         | Optional `Idempotency-Key`                                                                                                                     |
| Generate QR            | POST creates; regenerate is explicit                                                                                                           |
| Report export          | Optional `Idempotency-Key`                                                                                                                     |

Idempotency keys are stored with the result for a bounded period (0010 #16).

## 26. File upload architecture

```text
1 client asks for an upload URL → 2 API authorizes and validates → 3 short-lived S3 target
4 client uploads to S3 → 5 client/API confirms → 6 API stores metadata → 7 async cleanup
```

Large media never passes through the API; keys are opaque and wedding-scoped; orphaned
objects are cleaned up asynchronously.

## 27. Background job boundaries

There is no worker or job queue (0025).

| Work                          | Trigger                      | How it runs                                   |
| ----------------------------- | ---------------------------- | --------------------------------------------- |
| Password reset email          | Forgot password              | Sent after the response (`waitUntil`) (Built) |
| Invitation email              | Send / resend                | Sent during the request (Built)               |
| Guest reminders               | Reminder schedule (deferred) | Needs a decision                              |
| Organizer notifications       | Business events              | Needs a decision                              |
| Report generation             | Export request               | Needs a decision                              |
| Media cleanup                 | Deleted or orphaned object   | Needs a decision                              |
| Email delivery reconciliation | Provider webhook (future)    | Needs a decision                              |

## 28. Rate limiting and abuse protection

| Endpoint class             | Protection                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------- |
| Sign-in / password reset   | Per-identity limits (0015)                                                         |
| Guest invitation token     | Token and IP limits                                                                |
| Guest RSVP                 | Token and IP limits + state validation                                             |
| Member invitation token    | Token and IP limits, as for guest routes (0023: 120 per IP, 60 per token a minute) |
| Create member invitations  | 10 per wedding in any rolling hour (0034 R1)                                       |
| Resend a member invitation | 3 per invitation in any rolling 24 hours (0034 R2)                                 |
| Partner invitation token   | 120 per IP, 60 per token a minute (as member invitations; 0038)                    |
| Create partner invitations | 10 per wedding in any rolling hour (0038)                                          |
| Resend a partner invite    | 3 per invitation in any rolling 24 hours (0038)                                    |
| Guest photo upload         | Token and IP limits + file size and content limits                                 |
| QR endpoints               | Token and IP limits                                                                |
| Public website             | General traffic limit                                                              |
| Vendor discovery           | Provider-aware limits and permitted caching (deferred — 0032 #3)                   |

Numeric limits beyond 0015 are set from observed traffic and abuse testing.

## 29. Observability and request tracing

A request ID per request, in responses and logs; method, route, status, duration and actor
logged without secrets; provider failures recorded separately; audit events for important
changes.

| Endpoint            | Purpose                        | Exposure                           |
| ------------------- | ------------------------------ | ---------------------------------- |
| `GET /health/live`  | Process is alive               | Infrastructure (outside `/api/v1`) |
| `GET /health/ready` | Dependencies ready for traffic | Load balancer (outside `/api/v1`)  |

## 30. API security rules

HTTPS only in production; HttpOnly SameSite cookies; CSRF protection is required if
cookie-authenticated state-changing requests are ever accepted cross-site — today the
same-origin proxy, `SameSite=Lax` and JSON-only bodies mean cross-site forms cannot use the
cookies (0015); server-side authorization (frontend guards are
not security); never return password, refresh-token or token hashes or provider secrets;
consistent `404` where existence must be hidden; sanitize user text before rendering into
websites and emails; signed short-lived upload URLs; rate-limit authentication, guest-token
and upload endpoints.

## 31. Versioning and compatibility

V1 is `/api/v1`; backward-compatible additions are allowed within V1; breaking changes need
a new version; deprecations get a documented migration window; web and API deploy
independently where practical.

## 32. Integration boundaries

| Integration         | API responsibility                                                  |
| ------------------- | ------------------------------------------------------------------- |
| Resend              | Send transactional emails; capture provider status (webhooks later) |
| Google Places (New) | Vendor discovery only (deferred — 0032 #3); map responses to DTOs   |
| YouTube Live        | Store stream identifiers; expose embed information                  |
| Amazon S3           | Binary storage; controlled upload and access URLs                   |
| Redis               | Rate-limit counters; not a public API (0025)                        |

## 33. Testing strategy

| Level       | Coverage                                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | DTO validation, services, permission evaluators, token services                                                                        |
| Integration | Controllers + MongoDB repositories + authorization (real Redis, in-memory MongoDB)                                                     |
| Contract    | Generated OpenAPI checked in CI; request/response schemas                                                                              |
| Security    | Authentication, tenant isolation, token guessing, IDOR, rate limiting                                                                  |
| Workflow    | Invitation → send → open → RSVP; QR → upload → gallery → guest deletion; partner invite → accept → leave → reinvite; expense → payment |
| Provider    | Resend, Google Places, YouTube adapters                                                                                                |

Required for Phase 4: every application route under `/api/v1`; signup without a wedding;
cross-wedding IDs return `404`; all four RSVP status/count combinations and every rejected
one; a guest cannot send `PENDING`; an organizer reset to `PENDING` is audited; old tokens
rejected after regenerate, revoke or guest deletion; link retrieval returns the same link
without changing the token and is audited; no form of the token in logs or
responses other than `invitationUrl`; an immediate provider rejection gives `FAILED`; opens
never change delivery status; deleting an event keeps RSVP and invitation history; private
notes absent from guest responses.

## 34. Key API invariants

- No wedding data without an authorized membership, except explicit guest-token and public
  endpoints.
- Every wedding-scoped query is constrained by `weddingId`.
- Guest endpoints never require an account; tokens are non-guessable and never stored in
  plain form (hash, plus an encrypted copy for invitation tokens — 0018).
- Delivery state, activity and RSVP are independent; resends never duplicate guests or
  assignments.
- Public endpoints return only public or shared data; private notes and expenses never leak.
- Money is integer minor units; S3 holds binaries; providers sit behind integration
  services.

## 35. Open API decisions

| Area | Decision to finalize |
| ---- | -------------------- |

| Webhooks | Delivery webhooks for `DELIVERED`/`FAILED` |
| Roles | Settled for Phase 10: default matrix and decisions P10-1–P10-8 (Database Design §8, §32). Interpretations R1–R6 approved (0034); UI decisions in 0035 |
| Reminders | Schedules, recipients, templates |
| Uploads | File size and type limits; image processing |
| Vendor discovery | Google fields and caching rules (discovery deferred — 0032 #3) |
| Website | Public payload, caching and revalidation; sitemap and metadata |
| Rate limits | Numeric thresholds beyond 0015 and the Phase 4 guest routes (0023: 120 per IP, 60 per link per minute) |
| Reports | Filter contract; download retention |

Resolved since v1.0: invitee-already-owns-a-wedding acceptance (0012, N1); attendee-count
validation and token expiry and status semantics (0017); token and session lifetimes (0015);
invitation token storage, organizer reset to `PENDING`, immediate rejection and deleted
guests' links (0018); showing the link again after creation (0019); partner sharing scope and
disconnection, A4/A5 (0038).

## 36. Implementation order

Phases are approved one at a time; the built phases and the next one are in
`docs/PROJECT_STATUS.md`. Partner connection (Phase 16) is built before the website, gallery
and QR, live stream, notifications and reports (Phases 11–15; decision 0037).

## 37. OpenAPI contract

The API publishes an OpenAPI document generated from DTOs and decorators
(`pnpm api:contract`), checked into `packages/api-client/openapi.json` with generated client
types; CI fails on drift. Swagger UI is available when `OPENAPI_DOCS_ENABLED=true` and is
off in production. Tags: Auth, Users, Weddings, Members, Partner, Events, Guests,
Invitations, Notifications, Expenses, Tasks, Vendors, Website, Gallery, Memory QR, Live
Stream, Reports.

## 38. Summary

A versioned, tenant-aware REST API inside the NestJS modular monolith.

```text
Management: authenticate → resolve membership → authorize → validate → execute → audit
Guest:      secure token → validate scope → read or change only that guest's data
Media:      authorize → issue S3 target → upload → confirm metadata → async cleanup
Provider:   API → integration service → external provider
```
