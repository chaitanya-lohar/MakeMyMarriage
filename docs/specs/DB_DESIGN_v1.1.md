# MakeMyMarriage — Database Design v1.1

| Item            | Value                                                    |
| --------------- | -------------------------------------------------------- |
| Version         | 1.1 (consolidated)                                       |
| Status          | **Canonical** persistence baseline                       |
| Date            | 2026-10-10                                               |
| Database        | MongoDB Atlas (Mongoose, inside module repositories)     |
| Binary storage  | Amazon S3; MongoDB holds metadata                        |
| Tenant boundary | Wedding                                                  |
| Supersedes      | Database Design v1.0 (archived in `docs/archive/specs/`) |

| Version | Date       | Change                                                                                                                                                                                                                                                                  |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-09-24 | Baseline design.                                                                                                                                                                                                                                                        |
| 1.1     | 2026-10-10 | Consolidated: v1.0 plus decisions 0008–0010, 0012, 0013, 0015–0019 and the schema built in Phases 2–3.                                                                                                                                                                  |
| 1.1     | 2026-10-14 | Decision 0025: no job queue; invitation emails are sent during the request. No schema change.                                                                                                                                                                           |
| 1.1     | 2026-10-20 | Decision 0028 (Phase 8): payer moved to payments, `paidMinor` and a server-set status, no `description`, receipts deferred.                                                                                                                                             |
| 1.1     | 2026-10-24 | Decision 0032 (Phase 9): vendors and `vendor_bookings`; expense `vendorId` set; discovery and vendor attachments deferred.                                                                                                                                              |
| 1.1     | 2026-10-27 | Phase 10 requirements (product owner): membership fields, `member_invitations`, the default role matrix, protected actions, override evaluation, audit actions, indexes.                                                                                                |
| 1.1     | 2026-10-27 | Phase 10 decisions P10-1–P10-8 applied: seven-day expiry, re-invitation reuses the row, Admin limits, owner seats (`ownerSeat`, at most two owners) and `ownership_transfers`, `INVITATIONS:SEND` and `MEMORY_QR:REGENERATE` owner-only by default, `INVITED` reserved. |

**Status of each collection** — _Built_: exists in code. _Phase 4_: designed and approved for
Phase 4. _Planned_: carried from v1.0 with approved changes; re-checked against the PRD
before its module is built (0010).

## 1. Purpose and scope

The MongoDB Atlas data model for V1: collection boundaries, document structures,
relationships, indexes, authorization boundaries, data lifecycle, auditability, file
metadata, transaction boundaries and operational rules.

- Keep wedding data isolated by `weddingId` and authorize before data access.
- Keep growing data (guests, photos, notifications, tasks, expenses, delivery history) in
  separate collections, never as unbounded arrays on the wedding.
- Keep provider identifiers and binary files separate from core records.
- Preserve audit and history while supporting soft deletion and later permanent deletion.
- Implementation values not yet decided (retention periods, for example) stay open rather
  than invented.

## 2. Design principles

- The wedding is the business tenant boundary; the user is the identity boundary.
- A user can own at most one wedding and participate in others through memberships
  (0012).
- Bride and groom are ordinary users who become `OWNER` members of a wedding.
- Membership, role, permission overrides and partner connection are separate concepts.
- Reference high-growth or independently queried data; embed only bounded configuration
  and value objects.
- Never expose MongoDB IDs where a secure or public identifier is required.
- Money is stored as integer minor units.
- Timestamps are UTC. Calendar dates (wedding date, event date) are stored as midnight UTC
  of that date and read back as `YYYY-MM-DD`; local times are `HH:mm` strings in the
  wedding's timezone (0016, 0017).
- Binary objects live in S3; metadata in MongoDB.
- Application validation plus MongoDB structural safety; transactions only when several
  documents must change together.
- Query filters are sanitized globally (`sanitizeFilter`); operators built by the server are
  wrapped with `trusted()`.

## 3. Technology and persistence architecture

| Concern                      | Decision                                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Database                     | MongoDB Atlas (local: single-node replica set)                                                                                            |
| Data access                  | Mongoose, only inside each module's `infrastructure/`                                                                                     |
| Primary ID                   | MongoDB ObjectId                                                                                                                          |
| Public website identity      | Dedicated `publicIdentifier`                                                                                                              |
| Invitation, QR, reset access | Secure random token, never stored in plain form: QR and reset tokens as a hash; invitation tokens as a hash plus an encrypted copy (0018) |
| Binary storage               | Amazon S3                                                                                                                                 |
| Background jobs              | None; Redis holds rate-limit counters only (0025)                                                                                         |
| Email provider               | Resend                                                                                                                                    |
| Vendor discovery             | Google Places API (New), through a provider abstraction — deferred (0032 #3)                                                              |
| Live streaming               | YouTube Live                                                                                                                              |
| Reports                      | Excel, generated on demand                                                                                                                |
| Index creation               | Automatic in local and test; a deployment operation in staging and production                                                             |

## 4. Domain and tenant model

```text
User
 ├── owns 0..1 Wedding (an OWNER membership)
 └── participates in 0..N Weddings through WeddingMembership
Wedding
 ├── Memberships · PartnerConnection
 ├── Events · Guests (→ GuestEvents, GuestInvitation → Deliveries, Activities)
 ├── Expenses · Tasks · Vendors
 ├── Website · Photos · Memory QR · Live streams · Report exports
```

**Tenant isolation rule.** Every wedding-scoped collection carries `weddingId`. Access first
establishes an `ACTIVE` membership for the requested wedding, then evaluates permissions,
then runs a query constrained by `weddingId`.

## 5. Collection inventory

| Collection              | Purpose                                   | Module        | Status                                                                |
| ----------------------- | ----------------------------------------- | ------------- | --------------------------------------------------------------------- |
| `users`                 | Account identity and profile              | Users         | Built                                                                 |
| `auth_sessions`         | Refresh-token sessions per device         | Auth          | Built                                                                 |
| `password_reset_tokens` | One-time password reset tokens            | Auth          | Built                                                                 |
| `weddings`              | Wedding root entity                       | Weddings      | Built                                                                 |
| `wedding_memberships`   | User access to weddings                   | Workspace     | Built                                                                 |
| `events`                | Wedding events                            | Events        | Phase 4                                                               |
| `guests`                | One guest record per wedding              | Guests        | Phase 4                                                               |
| `guest_events`          | Guest–event assignment and RSVP           | Guests / RSVP | Phase 4                                                               |
| `guest_invitations`     | The guest's invitation and current token  | Invitations   | Phase 4                                                               |
| `invitation_deliveries` | Email send and resend attempts            | Invitations   | Phase 4                                                               |
| `invitation_activities` | Opens and other timestamped activity      | Invitations   | Phase 4                                                               |
| `member_invitations`    | Organizer invitations by email            | Workspace     | Planned — Phase 10 (0010 #13)                                         |
| `ownership_transfers`   | Ownership-seat transfer offers            | Workspace     | Planned — Phase 10 (P10-5, §7.6)                                      |
| `partner_connections`   | Partner relationship lifecycle            | Partner       | Planned                                                               |
| `resource_shares`       | Explicit resource sharing                 | Sharing       | Planned                                                               |
| `notifications`         | Recipient-specific notifications          | Notifications | Planned                                                               |
| `reminders`             | Reminder configuration                    | Notifications | Planned (cadence deferred)                                            |
| `expenses`              | Wedding expenses                          | Expenses      | Planned — Phase 8 (0028)                                              |
| `expense_payments`      | Instalment and payment history            | Expenses      | Planned — Phase 8 (0028)                                              |
| `expense_receipts`      | S3 receipt metadata                       | Expenses      | Deferred (0028 #3)                                                    |
| `tasks`                 | Wedding tasks                             | Tasks         | Planned                                                               |
| `task_assignments`      | Task ↔ member assignment                  | Tasks         | Planned                                                               |
| `task_activities`       | Task history                              | Tasks         | Planned                                                               |
| `wedding_vendors`       | Wedding-scoped vendor profiles            | Vendors       | Implemented — Phase 9 (PR #31; 0032)                                  |
| `vendor_bookings`       | Services booked from a vendor             | Vendors       | Implemented — Phase 9 (PR #31; 0032)                                  |
| `vendor_attachments`    | S3 vendor attachment metadata             | Vendors       | Deferred (0032 #6)                                                    |
| `wedding_websites`      | Public website configuration              | Website       | Planned                                                               |
| `photos`                | Wedding and event photos                  | Gallery       | Planned                                                               |
| `memory_qrs`            | Wedding and event memory QR tokens        | QR            | Planned                                                               |
| `live_streams`          | External live stream association          | Live stream   | Planned                                                               |
| `report_exports`        | Report generation history                 | Reports       | Planned                                                               |
| `audit_logs`            | Central business and security audit trail | Audit         | Phase 4 (RSVP resets, invitation token changes); planned for the rest |

## 6. User and authentication collections (Built — decision 0015)

### 6.1 `users`

```ts
{
  _id: ObjectId,
  email: string,          // unique; trimmed and lower-cased before storage
  passwordHash: string,   // Argon2id
  displayName: string,
  phoneNumber?: string,
  status: string,         // ACTIVE (the only value V1 uses)
  createdAt: Date,
  updatedAt: Date,
  deletedAt?: Date
}
```

- Wedding-specific identity (bride or groom) belongs to the membership's `ownerType`, not the
  user. No mandatory email verification in V1.

### 6.2 `auth_sessions`

```ts
{
  _id: ObjectId,
  userId: ObjectId,           // indexed
  refreshTokenHash: string,   // SHA-256 of a 256-bit secret; rotated on every refresh
  deviceInfo?: object,
  ipAddress?: string,
  userAgent?: string,         // at most 512 characters
  createdAt: Date,
  lastUsedAt: Date,
  expiresAt: Date,            // absolute: 30 days ("Remember me") or 24 hours
  revokedAt?: Date
}
```

- Multiple simultaneous sessions; each can be revoked alone. A password reset revokes all
  of a user's sessions.

### 6.3 `password_reset_tokens`

```ts
{
  _id: ObjectId,
  userId: ObjectId,
  tokenHash: string,   // unique
  expiresAt: Date,     // 60 minutes
  usedAt?: Date,
  createdAt: Date
}
```

- Single use; the raw token is never stored.

## 7. Wedding, membership and partner model

### 7.1 `weddings` (Built — decisions 0010 #9, 0016)

```ts
{
  _id: ObjectId,
  displayName: string,     // always "{brideName} & {groomName}"; generated
  brideName: string,       // 1–100
  groomName: string,       // 1–100
  startDate?: Date,        // the wedding date, midnight UTC of the calendar date
  timezone: string,        // "Asia/Kolkata"
  venueName?: string,      // ≤ 120
  primaryCity?: string,    // ≤ 120
  description?: string,    // ≤ 1000
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date,
  deletedAt?: Date
}
```

- Empty optional values are stored as absent. `endDate` (v1.0) is not used in V1.
- **Planned (0010 #9):** `coverImage` and `theme`, added when their phase is built.
- No `brideUserId`/`groomUserId`; ownership is represented by memberships.
- No lifecycle state machine in V1.
- Creating a wedding never creates a `wedding_websites` document or public identifier.

### 7.2 `wedding_memberships` (Built — decisions 0012, 0016; extended for Phase 10)

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  userId: ObjectId,
  memberType: string,       // OWNER, MEMBER
  role: string,             // OWNER, ADMIN, ORGANIZER, EDITOR, VIEWER
  status: string,           // INVITED, ACTIVE, REVOKED
  acceptedAt?: Date,
  createdAt: Date,
  updatedAt: Date,
  // Phase 10 (organizers and permissions):
  permissionOverrides?: [{ module: string, action: string, effect: string }],  // effect ALLOW | DENY (§8.4)
  invitationId?: ObjectId,  // the member_invitations record this membership came from (§7.5)
  invitedBy?: ObjectId,     // copied from the invitation on acceptance
  invitedAt?: Date,         // copied from the invitation on acceptance
  revokedAt?: Date,         // set when status becomes REVOKED; cleared on reactivation
  revokedBy?: ObjectId,
  ownerSeat?: number,       // 1 | 2 — set exactly when memberType = OWNER (P10-5, below)
  // Planned, added with partner connection (Phase 16):
  ownerType?: string        // BRIDE, GROOM
}
```

- Unique `(userId, weddingId)`: one membership row per user per wedding, whatever its status.
  A user can hold memberships in **several weddings**, each with its own role and overrides;
  nothing in one membership is read when authorizing another wedding.
- **At most one `OWNER` membership per user** across all weddings: partial unique index on
  `userId` where `memberType = OWNER` (`one_owner_membership_per_user`, built). It does not
  limit the number of owners of a wedding: bride and groom are two users, each with one
  `OWNER` row in the same wedding (0012 C1). The filter counts every status, so an owner row
  that stops being an owner must change `memberType` to `MEMBER` (ownership transfer, §7.6),
  not stay `OWNER` with `REVOKED`. Which statuses count after a partner disconnects remains
  part of A5 (0011). This index is kept unchanged by Phase 10.
- **At most two owners per wedding (P10-5):** each `OWNER` row holds an owner seat, `1` or `2`,
  with a partial unique index on `(weddingId, ownerSeat)` where `memberType = OWNER`
  (`owner_seat_per_wedding`). Two seats exist, so a third owner cannot be written. Wedding
  creation gives the creator seat `1`; partner connection (Phase 16) will take the free seat;
  an ownership transfer moves a seat from the giver to the recipient. Rows that are not
  owners have no `ownerSeat`. Implementation note: existing owner rows (one per wedding today)
  are backfilled with seat `1` and validated before the index is created (migration steps in
  decision 0034). `ownerSeat` is not `ownerType`:
  a seat is a slot, `BRIDE`/`GROOM` (Phase 16) describes the person.
- **`memberType` and `role` move together:** `memberType = OWNER` ⇔ `role = OWNER`. Organizer
  invitations only ever create `MEMBER` rows with `ADMIN`, `ORGANIZER`, `EDITOR` or `VIEWER`;
  `OWNER` rows are created only by wedding creation, partner connection (Phase 16) and
  ownership transfer (§7.6).
- **Membership statuses** (distinct from invitation statuses, §7.5):
  - `ACTIVE` — the only status admitted to wedding routes.
  - `REVOKED` — removed; admitted nowhere; the row and everything the member created are kept.
  - `INVITED` — **reserved (P10-7).** In the schema since Phase 3; never written in Phase 10
    and never admitted. A pending organizer invitation is represented only by a `PENDING`
    `member_invitations` record (an invitee may have no account yet, and `userId` is
    required here). Code must not treat `INVITED` as a synonym of invitation `PENDING`; any
    future use needs a decision.
- **Revocation** sets `status = REVOKED`, `revokedAt`, `revokedBy`; it deletes nothing. Records
  the member created keep their `createdBy`, assignments and payer references; screens show
  such people as former members (the 0030 pattern).
- **Re-invitation of a revoked member (P10-3):** a new invitation is created as for anyone
  (§7.5); the membership row **stays `REVOKED`** — no access — while it is pending. On
  acceptance, in the acceptance transaction, the **same row** is reused (the unique
  `(userId, weddingId)` forbids a second one): `permissionOverrides` cleared and replaced by
  the invitation's overrides if any, `role` from the invitation, `status = ACTIVE`,
  `invitationId`, `invitedBy`, `invitedAt`, `acceptedAt` updated, `revokedAt`/`revokedBy`
  cleared. Earlier history stays in `audit_logs` (`MEMBER_REMOVED`, then `MEMBER_REACTIVATED`).
  The existing status model is sufficient; no new status is needed.
- `permissionOverrides` is bounded (at most one entry per module and action; at most 64
  entries) and ignored on `OWNER` rows. It never contains protected actions (§8.3).
- The planned `ownerType` belongs to partner connection and is not set in Phase 10.

### 7.3 `partner_connections` (Planned)

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  inviterUserId: ObjectId,
  inviteeUserId: ObjectId,
  status: string,           // PENDING, ACTIVE, DISCONNECTED, EXPIRED
  invitedAt: Date,
  acceptedAt?: Date,
  disconnectedAt?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

- Accepting is refused while the invitee owns a wedding (0012, N1).
- **Approved addition (0010 #14):** partner invitation token storage (hash only), designed
  with the Partner phase.

### 7.4 `resource_shares` (Planned)

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  resourceType: string,
  resourceId: ObjectId,
  sharedWithUserId: ObjectId,
  permission: string,
  createdBy: ObjectId,
  createdAt: Date,
  revokedAt?: Date
}
```

- Exact resource types and actions depend on A4 (0011). Expenses never use it: they are
  shared automatically (0009).
- Not used in Phase 10: organizer permissions come from roles and overrides (§8). When A4 is
  decided, a share can only narrow or widen access to a specific partner-private resource;
  it never grants a protected action (§8.3).

### 7.5 `member_invitations` (Phase 10 — approved addition 0010 #13)

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  email: string,            // trimmed, lower-cased; the invitee's address (≤ 254)
  role: string,             // ADMIN, ORGANIZER, EDITOR, VIEWER — never OWNER
  permissionOverrides?: [{ module: string, action: string, effect: string }],  // optional, applied on acceptance
  message?: string,         // optional note shown in the email and on the acceptance page (≤ 500)
  status: string,           // PENDING, ACCEPTED, DECLINED, EXPIRED, REVOKED
  tokenHash: string,        // SHA-256 of the raw token; the raw token is never stored
  expiresAt: Date,          // issue time + 7 days (P10-2); reset when a resend issues a new token
  invitedBy: ObjectId,
  acceptedByUserId?: ObjectId,
  membershipId?: ObjectId,  // the membership created or reactivated on acceptance
  respondedAt?: Date,       // accepted or declined
  revokedAt?: Date,
  revokedBy?: ObjectId,
  expiredAt?: Date,         // written when the expiry is first observed (no background job — 0025)
  lastSentAt?: Date,
  resentAt?: Date[],        // times of the latest resends, oldest first, at most 3 kept (0034 R2)
  createdAt: Date,
  updatedAt: Date
}
```

- **Lifecycle:** `PENDING` → `ACCEPTED` | `DECLINED` | `REVOKED` | `EXPIRED`. Every terminal
  state is final; a new invitation is a new record with a new token.
- **Expiry (P10-2):** `expiresAt` is a UTC timestamp, seven days (168 hours) after the current
  token was issued (creation, or the latest resend). There is no scheduler (0025), and
  correctness never depends on one: every read and every accept, decline, resend or revoke
  compares `expiresAt` with the server clock. A `PENDING` invitation past `expiresAt` is
  reported as `EXPIRED`; the first request that observes it writes `status = EXPIRED` and
  `expiredAt` (conditional on `PENDING`) and the audit entry. Acceptance includes
  `expiresAt > now` in its conditional update, so an expired token can never be accepted even
  if the stored status still reads `PENDING`. A future background job may write the same
  transition; it is optional.
- **Token:** at least 32 random bytes, base64url, sent only in the email link; stored as a
  SHA-256 hash with a unique index, like `password_reset_tokens` (§6.3). Unlike guest
  invitation tokens (0018) there is no encrypted copy: the link is never shown again, and a
  "resend" issues a new token and replaces `tokenHash` (the old link stops working).
- **Single use:** accepting, declining or revoking is a conditional update on
  `status = PENDING` and `expiresAt > now`, so a token works once.
- **Email binding (P10-1):** only a signed-in user whose account email equals `email` can
  accept. Email verification is **not** required (V1 has none — 0015): possession of the
  single-use emailed token plus the matching account email is the proof. Declining needs only
  the token, so an invitee without an account can decline (API Design §7.1).
- **Invitee already a member (0036):** accepting closes the invitation as `ACCEPTED` with the
  existing `membershipId`; the membership is not changed.
- **No access while pending:** a `PENDING` invitation grants nothing; only the `ACTIVE`
  membership written at acceptance does.
- At most one `PENDING` invitation per `(weddingId, email)`.
- **Resend limit (0034 R2):** a resend is one conditional update, matched only while
  `status = PENDING`, `expiresAt > now`, and fewer than three entries in `resentAt` are newer
  than 24 hours (the third-latest, `resentAt[0]` when three are kept, is at least 24 hours
  old). The update replaces `tokenHash`, sets `expiresAt` to now + 7 days, `lastSentAt`, and
  pushes now onto `resentAt` keeping the last three. No match means the limit was reached
  (or the invitation is no longer pending). Every resend is also audited
  (`MEMBER_INVITATION_RESENT`).

### 7.6 `ownership_transfers` — ownership-seat transfer (Phase 10, P10-5)

A transfer moves **one owner seat**, never the whole wedding: an owner offers **their own** seat
to an `ACTIVE` non-owner member, who must accept. The other owner, if any, is untouched.

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  fromMembershipId: ObjectId,  // the giving owner's membership
  toMembershipId: ObjectId,    // the recipient's membership (ACTIVE, not OWNER)
  ownerSeat: number,           // 1 | 2 — the seat being moved
  status: string,              // PENDING, ACCEPTED, DECLINED, CANCELLED
  requestedBy: ObjectId,       // = the giver's userId
  respondedAt?: Date,          // accepted, declined or cancelled
  cancelledReason?: string,    // BY_OWNER, MEMBERSHIP_CHANGED
  createdAt: Date,
  updatedAt: Date
}
```

- Partial unique index on `weddingId` where `status = PENDING`: **one open offer per wedding**,
  so two owners cannot move seats at the same time.
- No expiry is defined by the approved rules; an offer stays `PENDING` until accepted,
  declined or cancelled. It is cancelled (`MEMBERSHIP_CHANGED`) when either membership stops
  being eligible (giver no longer owner, recipient removed or made owner).
- **Acceptance** — one transaction, all conditional, in this order so the seat index never
  sees two holders:
  1. the offer `PENDING` → `ACCEPTED` (conditional);
  2. the giver's row: still `OWNER` with that seat → `memberType = MEMBER`, `role = ADMIN`,
     `ownerSeat` unset, `permissionOverrides` cleared;
  3. the recipient's row: still `ACTIVE` and `MEMBER` → `memberType = OWNER`, `role = OWNER`,
     `ownerSeat` = the moved seat, `permissionOverrides` cleared;
  4. audit `OWNERSHIP_TRANSFERRED`.
     Any failed condition aborts the transaction; nothing is half-applied.
- Refused when the recipient already owns another wedding (`one_owner_membership_per_user`,
  0012 C1 — unchanged).
- Example: owners A (seat 1) and B (seat 2); A offers seat 1 to member C; C accepts → C owner
  (seat 1), A `ADMIN`, B owner (seat 2). The wedding still has two owners.

## 8. Roles and permission model (Phase 10)

The approved Phase 10 requirements (product owner, 2026-10-27) settle the default matrix that
PRD v1.2 §24 left deferred. Roles and defaults are **application constants**, not a
collection; only overrides are stored (§7.2). System Design §7.2–§7.4 describes evaluation.

### 8.1 Roles, modules and actions

| Role      | Purpose                                                  |
| --------- | -------------------------------------------------------- |
| OWNER     | Bride or groom; unrestricted wedding control             |
| ADMIN     | Broad delegated management, never owner-only actions     |
| ORGANIZER | Planning and operational coordination                    |
| EDITOR    | Adds and changes permitted wedding data; does not delete |
| VIEWER    | Read-only access                                         |

Modules (permission keys): `WEDDING_SETTINGS`, `EVENTS`, `GUESTS`, `INVITATIONS` (invitations
and organizer RSVP changes), `TASKS`, `EXPENSES`, `VENDORS`, `WEBSITE`, `GALLERY`, `MEMORY_QR`,
`LIVE_STREAM`, `REPORTS`, `MEMBERS` (organizer management), `AUDIT`, `PARTNER_SHARING`.

Ordinary actions: `VIEW`, `CREATE`, `EDIT`, `DELETE`. Management actions, each named
explicitly and never implied by the ordinary ones:

| Module        | Management actions                                                                         |
| ------------- | ------------------------------------------------------------------------------------------ |
| `WEBSITE`     | `CONFIGURE` (website settings), `PUBLISH` (publish and unpublish)                          |
| `MEMORY_QR`   | `REGENERATE` (replace a QR token; P10-6)                                                   |
| `REPORTS`     | `EXPORT`                                                                                   |
| `MEMBERS`     | `INVITE`, `CHANGE_ROLE`, `EDIT_PERMISSIONS`, `REMOVE` (and `VIEW`)                         |
| `AUDIT`       | `VIEW` only                                                                                |
| `INVITATIONS` | `SEND` (send, resend, retrieve or copy a guest link; P10-6), `MANAGE` (regenerate, revoke) |

`MANAGE` and `CONFIGURE` (in this table since v1.0) are kept only as these module-specific
management actions. Generating a QR is `MEMORY_QR:CREATE`, revoking it `MEMORY_QR:DELETE`.

### 8.2 Default role permissions

Legend: **Full** — every ordinary action and every management action of the module (owners
only). **Manage** — `VIEW`, `CREATE`, `EDIT`, `DELETE`. **Edit** — `VIEW`, `CREATE`, `EDIT`.
**View** — `VIEW`. **Custom** — nothing by default; an owner (or an authorized admin, System
Design §7.5) grants specific actions with overrides. **No** — nothing by default.

| Module             | Owner | Admin  | Organizer | Editor | Viewer |
| ------------------ | ----- | ------ | --------- | ------ | ------ |
| `WEDDING_SETTINGS` | Full  | Custom | No        | No     | No     |
| `EVENTS`           | Full  | Manage | Manage    | Edit   | View   |
| `GUESTS`           | Full  | Manage | Manage    | Edit   | View   |
| `INVITATIONS`      | Full  | Manage | Manage    | Edit   | View   |
| `TASKS`            | Full  | Manage | Manage    | Edit   | View   |
| `EXPENSES`         | Full  | Manage | View      | Edit   | View   |
| `VENDORS`          | Full  | Manage | Manage    | Edit   | View   |
| `WEBSITE`          | Full  | Custom | No        | No     | No     |
| `GALLERY`          | Full  | Manage | Custom    | Custom | View   |
| `MEMORY_QR`        | Full  | Manage | No        | No     | No     |
| `LIVE_STREAM`      | Full  | Manage | Custom    | Custom | View   |
| `REPORTS`          | Full  | Custom | Custom    | No     | No     |
| `MEMBERS`          | Full  | Custom | No        | No     | No     |
| `AUDIT`            | Full  | Custom | No        | No     | No     |
| `PARTNER_SHARING`  | Full  | No     | No        | No     | No     |

- "Manage", "Edit" and "View" never include management actions. In particular (P10-6):
  - **`INVITATIONS:SEND`** (sending and resending guest invitation emails, retrieving or
    copying a guest link) and **`INVITATIONS:MANAGE`** (regenerating or revoking a guest
    link) are **owner-only by default**: `ADMIN` and `ORGANIZER` have `INVITATIONS` Manage,
    `EDITOR` Edit, yet none of them may send, retrieve, regenerate or revoke a guest link
    without an explicit `ALLOW` override.
  - **`MEMORY_QR:REGENERATE`** is owner-only by default; `ADMIN`'s Manage on `MEMORY_QR` covers
    generating, editing and revoking, not regeneration, unless an override allows it.
  - Overrides may grant these three actions to any non-owner role (§8.4, grant ceiling).
- Modules without a built feature (website, gallery, QR, live stream, reports) carry their
  defaults now so the matrix is complete; their routes adopt them when built.

### 8.3 Protected actions

Owner-only; never granted by a role default or an override, and never removed from an owner:

| Protected action                              | Why                                           |
| --------------------------------------------- | --------------------------------------------- |
| Transfer ownership (§7.6)                     | Changes who controls the wedding              |
| Archive or delete the wedding                 | Irreversible for every member                 |
| Partner connection, disconnection and sharing | Partner phase; A4/A5 (0011)                   |
| Any change to an `OWNER` membership           | Owners cannot be demoted or removed by others |
| Assigning the `ADMIN` role (P10-4)            | Admins cannot create Admins                   |
| Managing an `ADMIN` membership (P10-4)        | Admins cannot manage other Admins             |

**Admin authority (P10-4)** — enforced in the members service for every non-owner caller,
whatever their overrides (an `ADMIN` needs `MEMBERS` grants first; their default is Custom):

| Operation by a non-owner                    | Allowed only when                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| Invite (`MEMBERS:INVITE`)                   | Invited role is `ORGANIZER`, `EDITOR` or `VIEWER`                                    |
| Change role (`MEMBERS:CHANGE_ROLE`)         | Target is `ORGANIZER`/`EDITOR`/`VIEWER` and the new role is one of those three       |
| Edit overrides (`MEMBERS:EDIT_PERMISSIONS`) | Target is `ORGANIZER`/`EDITOR`/`VIEWER`; every `ALLOW` is an action the caller holds |
| Remove (`MEMBERS:REMOVE`)                   | Target is `ORGANIZER`/`EDITOR`/`VIEWER`                                              |
| Any of these on themselves                  | Never                                                                                |

Owners may do all of these for any non-owner membership, including assigning `ADMIN`.

**Restricted by default, grantable** — owner-only unless an override allows them (§8.2,
P10-6): `INVITATIONS:SEND`, `INVITATIONS:MANAGE`, `MEMORY_QR:REGENERATE`, and every action a role
has as Custom or No. Overrides never grant the protected actions above, and never bypass
authentication, the `ACTIVE`-membership check or the `weddingId` scope.

### 8.4 Overrides and evaluation

Effective permissions for one membership, evaluated on the server on every request:

1. `status` must be `ACTIVE` (otherwise `404`, §21 API Design).
2. `OWNER`: every action of every module, including protected actions. Overrides are ignored.
3. Start from the role defaults (§8.2).
4. Apply `permissionOverrides`: `ALLOW` adds the `(module, action)`; `DENY` removes it. For
   the same `(module, action)`, **`DENY` wins over `ALLOW`**. A `DENY` of `VIEW` removes the
   whole module.
5. Every modifying or management action requires `VIEW` on the same module; without it the
   action is not effective.
6. Remove protected actions (§8.3) — they cannot survive step 4.
7. Resource sharing (§7.4, A4) may later restrict access to individual partner-private
   resources; it is not used in Phase 10.

Overrides are stored only where they differ from the defaults; saving an override equal to
the default stores nothing.

## 9. Events (Phase 4 — decision 0017)

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  name: string,              // 1–100
  type: string,              // ENGAGEMENT, MEHENDI, HALDI, SANGEET, WEDDING, RECEPTION, CUSTOM
  description?: string,      // ≤ 1000
  date: Date,                // midnight UTC of the calendar date, in the wedding timezone
  startTime?: string,        // "HH:mm"
  endTime?: string,          // "HH:mm"; requires startTime; later than startTime
  timezone: string,          // copied from the wedding at creation
  venue?: {
    name?: string,           // ≤ 120
    address?: string         // ≤ 300
  },
  dressCode?: string,        // ≤ 120
  notes?: string,            // ≤ 1000; organizer-only
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date,
  deletedAt?: Date,
  deletedBy?: ObjectId
}
```

- Replaces v1.0's required `startDateTime`/optional `endDateTime` so a date-only event is
  never stored with an invented time (0017 #17).
- **Planned, later phases (0010 #10; answer Q7):** `venue.latitude`/`venue.longitude`,
  `coverImage`, `isPublic` (website exposure), `instructions`, `publicId`.
- Events are an independent collection; no event-count limit; venue is embedded; events
  are soft-deleted, and deletion keeps guest-event and invitation history.

## 10. Guests, RSVP and invitations (Phase 4 — decisions 0008, 0010 #1, 0017, 0018)

The limits here and in §9 are approved (0019 #6).

### 10.1 `guests`

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  name: string,          // 1–100
  mobile: string,        // normalized: digits with an optional leading "+", 7–15 digits
  email?: string,        // trimmed, lower-cased; ≤ 254
  relation?: string,     // ≤ 100
  notes?: string,        // ≤ 1000; organizer-only
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date,
  deletedAt?: Date,
  deletedBy?: ObjectId
}
```

- One record per guest per wedding. `mobile` is **not** unique: family members may share a
  number. A likely duplicate (same normalized mobile in the same wedding) produces a warning,
  never a block or merge.
- Plus-ones are counted in `attendeeCount`; separate guest records are created only when an
  organizer adds them.

### 10.2 `guest_events`

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  guestId: ObjectId,
  eventId: ObjectId,
  rsvpStatus: string,          // PENDING, ATTENDING, DECLINED, MAYBE
  attendeeCount: number | null,// PENDING/MAYBE: null; DECLINED: 0; ATTENDING: ≥ 1
  respondedAt?: Date,          // last guest response
  rsvpUpdatedBy?: ObjectId,    // organizer who last changed the RSVP
  rsvpUpdatedAt?: Date,
  isActive: boolean,           // false once the assignment is removed
  removedAt?: Date,
  removedBy?: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

- There is **no** invitation status on `GuestEvent` (0008, C3).
- **At most one active assignment per guest and event:** partial unique index on
  `(weddingId, guestId, eventId)` where `isActive = true`. Removal sets `isActive = false`
  and keeps the record and its RSVP (0017 #18).
- The status/count combination is validated by the application and covered by tests.
- Deleting an event leaves its `guest_events` records unchanged; active queries exclude
  assignments whose event is deleted.

### 10.3 `guest_invitations`

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  guestId: ObjectId,           // unique: one invitation per guest
  tokenHash?: string,          // current token's hash, for lookup; absent while revoked
  tokenCiphertext?: string,    // current token, encrypted (authenticated encryption); absent while revoked
  tokenKeyVersion?: string,    // which encryption key encrypted it, for rotation
  tokenCreatedAt?: Date,
  revokedAt?: Date,
  deliveryStatus: string,      // DRAFT, SENT, DELIVERED, FAILED
  lastSentAt?: Date,
  firstOpenedAt?: Date,
  lastOpenedAt?: Date,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

- Created when the organizer starts the invitation flow, never when a guest is saved.
- The token is stored as `tokenHash` (guest requests are verified by hash) and
  `tokenCiphertext`, which the server decrypts only to send or resend the invitation email.
  The encryption key is held outside the database (platform secret manager) and is never
  logged; `tokenKeyVersion` allows rotation. The raw token is never stored in plain form
  (0018).
- Resends and changes to the guest's mobile or email reuse the same token.
- Regenerating replaces `tokenHash` and `tokenCiphertext` (the old token stops working at
  once). Revoking — by the organizer or by deleting the guest — removes both and sets
  `revokedAt`.
- **No `expiresAt`:** no automatic expiry in Phase 4 (0017 #8). v1.0's `status` is now
  `deliveryStatus` (without `OPENED`), and its `openedAt` is now `firstOpenedAt`.
- `deliveryStatus` follows the latest send attempt: `SENT` on provider acceptance, `FAILED`
  on a provider rejection (0018) or when the provider cannot be reached (0025; no automatic retry). Regenerating the link (from an active or a
  revoked link) sets it back to `DRAFT` and clears `revokedAt`; revoking never changes it
  (0020). `invitation_deliveries` records are never changed by either. `DELIVERED`, and failures reported after
  acceptance, need provider webhooks (not in Phase 4). Opens never change it.
- An email is tied to the link that is current when it is sent (`tokenCreatedAt`). If the
  link changes during the send, the attempt is still recorded in `invitation_deliveries`,
  but `deliveryStatus` is left unchanged (0020). Emails are sent during the request (0025).

### 10.4 `invitation_deliveries`

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  guestInvitationId: ObjectId,
  channel: string,             // EMAIL
  attemptNumber: number,
  kind: string,                // SEND, RESEND
  provider: string,            // RESEND
  providerMessageId?: string,
  status: string,              // SENT, DELIVERED, FAILED
  idempotencyKey: string,      // unique; a repeated request never sends twice
  sentAt?: Date,
  deliveredAt?: Date,
  failedAt?: Date,
  failureReason?: string,
  createdAt: Date
}
```

- One record per attempt; resends add records without creating guests, assignments or a
  second invitation.
- An immediate provider rejection is recorded as `FAILED` with `failedAt` and
  `failureReason` (0018). Attempts never affect RSVP state.

### 10.5 `invitation_activities`

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  guestInvitationId: ObjectId,
  type: string,                // OPENED
  occurredAt: Date,
  createdAt: Date
}
```

- Opens are history, never a delivery status (0017 #9). The first open is also kept on the
  invitation (`firstOpenedAt`). Every open is stored (0023); the first open is always preserved.

## 11. Notifications and reminders (Planned)

### 11.1 `notifications`

```ts
{
  _id: ObjectId,
  recipientUserId: ObjectId,
  weddingId?: ObjectId,
  type: string,
  title: string,
  message: string,
  data?: object,          // contextual IDs, e.g. guestEventId, taskId, expenseId
  isRead: boolean,
  readAt?: Date,
  createdAt: Date,
  expiresAt?: Date
}
```

### 11.2 `reminders`

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  eventId?: ObjectId,
  type: string,
  enabled: boolean,
  offsetMinutes: number,
  channels: [string],     // EMAIL, IN_APP
  createdBy: ObjectId,
  updatedBy?: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

- Sketch only. Reminder cadence, defaults and user customization are deferred (PRD v1.2
  §14); this collection is not a mandate to build configurable schedules.

## 12. Expenses and payments (Planned — Phase 8; decisions 0009, 0010 #5–#8 and 0028)

### 12.1 `expenses`

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  title: string,             // 1–150 characters (0028 #11)
  amountMinor: number,       // integer paise; the full cost; 1 to 10,000,000,000 (₹10 crore)
  paidMinor: number,         // integer paise; sum of the payments; 0 to amountMinor (0028 #8)
  currency: string,          // INR, set by the server
  category: string,          // VENUE, CATERING, DECORATION, PHOTOGRAPHY, CLOTHING, JEWELLERY,
                             // MAKEUP, ENTERTAINMENT, INVITATIONS, GIFTS, MISCELLANEOUS
  eventId?: ObjectId,
  vendorId?: ObjectId,       // optional vendor of the same wedding; set from Phase 9 (0032 #8)
  expenseDate: Date,         // midnight UTC of the calendar date, wedding timezone, as for events
  paymentStatus: string,     // PENDING, PARTIALLY_PAID, PAID — server-set; no CANCELLED (0018)
  notes?: string,            // at most 1,000
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date,
  deletedAt?: Date,
  deletedBy?: ObjectId
}
```

- **No `visibility` field.** Expenses are shared with the connected partner; one record per
  expense, never duplicated to share it; authorization applies to every read and write.
- `categoryId` (v1.0) is replaced by the fixed `category` value; no category collection.
- **No `description`** (0028 #11) and **no payer on the expense**: the payer is recorded on
  each payment (0028 #12).
- `paymentStatus` is derived from `paidMinor` and `amountMinor` (`PENDING` when 0,
  `PARTIALLY_PAID` when less, `PAID` when equal) and written by the server only (0028 #7).
- `eventId` references an active event of the same wedding. Deleting an event clears it on
  every linked expense, which becomes a whole-wedding expense, and writes an `audit_logs`
  entry for each (0028 #17).
- `vendorId` references a vendor of the same wedding that is not deleted when it is set. It
  is kept when that vendor is later deleted, and an edit may keep it then but not newly set
  a deleted vendor (0032 #17). Deleting a vendor never changes its expenses. There is no
  `bookingId` (0032 #8).
- Deleting an expense is a soft delete; its payments are kept (0028 #16).

### 12.2 `expense_payments`

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  expenseId: ObjectId,
  amountMinor: number,       // integer paise, more than 0
  paidByType: string,        // WEDDING_MEMBER, EXTERNAL_PERSON (0028 #12)
  paidByUserId?: ObjectId,   // an active member, when WEDDING_MEMBER
  paidByName?: string,       // 1–100 characters, when EXTERNAL_PERSON, e.g. "Bride's father"
  paymentDate: Date,         // calendar date, today or earlier in the wedding timezone
  paymentMethod?: string,    // CASH, UPI, BANK_TRANSFER, CARD, CHEQUE, OTHER
  referenceNumber?: string,  // at most 100
  notes?: string,            // at most 500
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

- The payments are the source of truth for `expenses.paidMinor`. Adding, editing or removing
  a payment updates `paidMinor` and `paymentStatus` in the same transaction (§24, §27).
- Removing a payment deletes the record; its `audit_logs` entry keeps the removed payment's
  amount, date, payer, method, reference and notes in `metadata`, with the actor and
  `createdAt` as the removal time (0028 #18).

### 12.3 `expense_receipts` (Deferred — 0028 #3)

Receipts need file storage, which is not set up (0025). Not built in Phase 8; kept here as
the design for when a storage decision is made.

```ts
{
  _id: ObjectId,
  expenseId: ObjectId,
  storageKey: string,
  originalFileName: string,
  contentType: string,
  fileSize: number,
  uploadedBy: ObjectId,
  uploadedAt: Date,
  deletedAt?: Date
}
```

## 13. Tasks (Planned — Phase 7; decisions 0010 #3, #4, 0013 and 0026)

### 13.1 `tasks`

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  title: string,       // 1–150 characters (0026 #6)
  description?: string, // at most 1,000
  notes?: string,       // at most 1,000; one field (0026 #4)
  status: string,       // TODO (default), IN_PROGRESS, BLOCKED, COMPLETED, CANCELLED
  priority: string,     // LOW, MEDIUM (default), HIGH, URGENT
  dueDate?: Date,       // midnight UTC of the calendar date, wedding timezone (0026 #7), as for events
  eventId?: ObjectId,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date,
  deletedAt?: Date,
  deletedBy?: ObjectId
}
```

- **Notes** (0010 #4) are the `notes` field above. **Task attachments are deferred** to the
  first phase that adds file storage (0026 #3).
- Reporting buckets: decision 0013. Overdue: `dueDate` before today in the wedding's
  timezone and status neither `COMPLETED` nor `CANCELLED`, computed on read (0026 #8).
- `eventId` references an active event of the same wedding. Deleting an event clears it on
  every linked task, which becomes a whole-wedding task, and records a `task_activities`
  entry for each (0026 #12).
- Deleting a task is a soft delete; its assignments and activities are kept, and an
  `audit_logs` entry is written (0026 #10, #17).

### 13.2 `task_assignments`

```ts
{ _id, weddingId: ObjectId, taskId: ObjectId, userId: ObjectId, createdBy: ObjectId, createdAt: Date }
```

Unique `(taskId, userId)`; a task can have several assignees.

### 13.3 `task_activities`

```ts
{ _id, weddingId: ObjectId, taskId: ObjectId, actorUserId: ObjectId, action: string,
  oldValue?: object, newValue?: object, createdAt: Date }
```

- Actions: created, fields edited, status changed, assignee added or removed, event link
  changed or removed (including by a deleted event), deleted (0026 #15). This history is
  the record of task changes; only deletion is also written to `audit_logs` (0026 #17).

## 14. Vendors and bookings (Implemented — Phase 9; PR #31; decision 0032)

### 14.1 `wedding_vendors`

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  name: string,            // 1–150 characters (0032 #10)
  category: string,        // VENUE, CATERING, PHOTOGRAPHY_VIDEOGRAPHY, DECORATION_FLOWERS,
                           // MAKEUP_BEAUTY, CLOTHING_JEWELLERY, ENTERTAINMENT_DJ,
                           // INVITATIONS_PRINTING, TRANSPORTATION, WEDDING_PLANNER, MEHENDI, OTHER
  contactPerson?: string,  // at most 150
  phone?: string,          // 7–15 digits, optional leading +, spaces and hyphens (guest mobile rule)
  email?: string,          // lower-cased; at most 254
  address?: string,        // at most 500
  website?: string,        // absolute http or https URL; at most 500
  notes?: string,          // at most 1,000
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date,
  deletedAt?: Date,
  deletedBy?: ObjectId
}
```

- A vendor belongs to one wedding. It has no status, events or amounts of its own: those are
  on its bookings (0032 #4). Vendor money uses expenses and expense payments (0032 #8).
- Deleting a vendor is a soft delete, refused while any of its bookings is not `CANCELLED`
  (0032 #15). Its bookings and linked expenses are kept unchanged.
- **Deferred (0032 #3):** `googlePlaceId` and vendors added from discovery. Google data, when
  discovery is approved, is stored only as the provider's terms allow.

### 14.2 `vendor_bookings`

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  vendorId: ObjectId,        // set on create; never changed (0032 #11)
  title: string,             // 1–150 characters
  status: string,            // NOT_CONTACTED (default), CONTACTED, QUOTATION_RECEIVED,
                             // NEGOTIATING, BOOKED, CANCELLED (0032 #12)
  bookingDate?: Date,        // midnight UTC of the calendar date, wedding timezone, as for events
  serviceDate?: Date,        // same
  eventId?: ObjectId,        // absent for a whole-wedding booking
  agreedPriceMinor?: number, // integer paise; 1 to 10,000,000,000 (₹10 crore) (0032 #5)
  notes?: string,            // at most 1,000
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

- `vendorId` references a vendor of the same wedding that is not deleted when the booking is
  created. Any status may change to any other (0032 #13).
- **No deletion:** a booking is cancelled, never deleted (0032 #14).
- `eventId` references an active event of the same wedding. Deleting an event clears it on
  every linked booking, which becomes a whole-wedding booking, and writes an `audit_logs`
  entry for each (0032 #16).

### 14.3 `vendor_attachments` (Deferred — 0032 #6)

Attachments need file storage, which is not set up (0025). Not built in Phase 9; kept here
as the design for when a storage decision is made.

```ts
{ _id, vendorId: ObjectId, storageKey: string, originalFileName: string, contentType: string,
  fileSize: number, uploadedBy: ObjectId, uploadedAt: Date, deletedAt?: Date }
```

## 15. Wedding website (Planned — decision 0016; answer Q4)

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  publicIdentifier: string,   // unique
  status: string,             // DRAFT, PUBLISHED, UNPUBLISHED
  title?: string,
  description?: string,
  story?: string,
  theme?: object,
  sections?: [{ type: string, enabled: boolean, order: number, config?: object }],
  settings?: object,
  publishedAt?: Date,
  unpublishedAt?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

- One document per wedding, created by the Wedding website phase — including a backfill
  for weddings that already exist — never when a wedding is created.
- Public URL `https://makemymarriage.com/w/{publicIdentifier}`, independent of `_id`.
- **Published websites are indexable by search engines in V1.** Sitemap, metadata and
  crawler directives are specified in the Wedding website phase.
- Only public or shared data is exposed; events use `isPublic` (planned); RSVP uses guest
  invitation access.

## 16. Photos and memory QR (Planned)

### 16.1 `photos`

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  eventId?: ObjectId,
  storageKey: string,
  originalFileName: string,
  contentType: string,
  fileSize: number,
  uploadedByUserId?: ObjectId,
  guestUploadTokenId?: ObjectId,
  uploadSource: string,      // OWNER, MEMBER, GUEST
  visibility: string,
  createdAt: Date,
  updatedAt: Date,
  deletedAt?: Date,
  deletedBy?: ObjectId
}
```

- Photos only; guest uploads are public automatically; guests delete their own uploads with
  a secure deletion token; soft-deleted, with asynchronous S3 cleanup.
- **Approved additions (0010 #11, #12):** guest upload sessions and deletion-token storage;
  photo upload state and `publicId` — designed in the Gallery and QR phase.

### 16.2 `memory_qrs`

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  eventId?: ObjectId,
  tokenHash: string,     // unique
  scope: string,         // WEDDING, EVENT
  status: string,
  createdBy: ObjectId,
  createdAt: Date,
  revokedAt?: Date,
  expiresAt?: Date       // QR expiry policy deferred
}
```

## 17. Live streaming and reports (Planned)

### 17.1 `live_streams`

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  eventId: ObjectId,
  provider: string,          // YOUTUBE
  providerStreamId: string,
  title?: string,
  streamUrl?: string,
  embedUrl?: string,
  status: string,            // SCHEDULED, LIVE, ENDED, CANCELLED
  scheduledStartAt?: Date,
  actualStartAt?: Date,
  actualEndAt?: Date,
  isPublic: boolean,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

Several streams per event are allowed.

### 17.2 `report_exports`

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  requestedBy: ObjectId,
  reportType: string,     // GUEST, EXPENSE, TASK
  filters?: object,
  status: string,
  storageKey?: string,    // 0010 #15
  expiresAt?: Date,       // 0010 #15
  createdAt: Date,
  completedAt?: Date
}
```

Excel only; generated files are temporary, not permanent business data.

## 18. Relationship model

| From             | Relationship            | To                                         | Cardinality                         |
| ---------------- | ----------------------- | ------------------------------------------ | ----------------------------------- |
| User             | owns                    | Wedding                                    | 0..1                                |
| User             | participates via        | WeddingMembership                          | 0..N                                |
| Wedding          | has                     | WeddingMembership                          | 1..N                                |
| Wedding          | has                     | MemberInvitation                           | 0..N                                |
| MemberInvitation | becomes (on acceptance) | WeddingMembership (created or reactivated) | 0..1                                |
| User             | invited as (by email)   | MemberInvitation                           | 0..N                                |
| Wedding          | has                     | Event                                      | 0..N                                |
| Wedding          | has                     | Guest                                      | 0..N                                |
| Guest            | participates through    | GuestEvent                                 | 0..N                                |
| Event            | has                     | GuestEvent                                 | 0..N                                |
| Guest            | has                     | GuestInvitation                            | 0..1                                |
| GuestInvitation  | has                     | InvitationDelivery                         | 0..N                                |
| GuestInvitation  | has                     | InvitationActivity                         | 0..N                                |
| Wedding          | has                     | Expense                                    | 0..N                                |
| Expense          | has                     | ExpensePayment, ExpenseReceipt             | 0..N                                |
| Wedding          | has                     | Task                                       | 0..N                                |
| Task             | has                     | TaskAssignment, TaskActivity               | 0..N                                |
| Wedding          | has                     | WeddingVendor                              | 0..N                                |
| WeddingVendor    | has                     | VendorBooking                              | 0..N                                |
| VendorBooking    | for                     | Event                                      | 0..1 (none: whole wedding)          |
| Expense          | for                     | WeddingVendor                              | 0..1                                |
| WeddingVendor    | has                     | VendorAttachment (deferred — 0032 #6)      | 0..N                                |
| Wedding          | has                     | WeddingWebsite                             | 0..1 (created by the Website phase) |
| Wedding          | has                     | Photo, MemoryQR, LiveStream, ReportExport  | 0..N                                |

## 19. Embedding vs referencing

| Data                                | Strategy        | Reason                          |
| ----------------------------------- | --------------- | ------------------------------- |
| Wedding → events                    | Reference       | Independent queries; growing    |
| Wedding → guests                    | Reference       | Unbounded growth; search        |
| Guest → GuestEvent                  | Reference       | Many-to-many                    |
| Guest → invitation                  | Reference       | Own lifecycle and history       |
| Invitation → deliveries, activities | Reference       | Growing history                 |
| Expense → payments, receipts        | Reference       | Multiple records                |
| Task → assignments, activities      | Reference       | Multiple records                |
| Wedding → website                   | Single document | Bounded configuration           |
| Event → venue                       | Embedded        | Value object of the event       |
| Website → sections                  | Embedded        | Bounded configuration           |
| Vendor → bookings                   | Reference       | Multiple records, own lifecycle |
| Booking → event                     | Reference ID    | One event or the whole wedding  |

## 20. Indexes and uniqueness

| Collection              | Index / constraint                                                                                                                  | Purpose                        | Status   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------- |
| `users`                 | `email` UNIQUE                                                                                                                      | Login identity                 | Built    |
| `auth_sessions`         | `userId`                                                                                                                            | Revoke all sessions            | Built    |
| `password_reset_tokens` | `tokenHash` UNIQUE                                                                                                                  | Token lookup                   | Built    |
| `wedding_memberships`   | `(userId, weddingId)` UNIQUE                                                                                                        | No duplicate membership        | Built    |
| `wedding_memberships`   | `userId` UNIQUE where `memberType = OWNER`                                                                                          | One owned wedding per user     | Built    |
| `wedding_memberships`   | `(weddingId, status, role)`                                                                                                         | Member list, owner count       | Phase 10 |
| `member_invitations`    | `tokenHash` UNIQUE                                                                                                                  | Token lookup                   | Phase 10 |
| `member_invitations`    | `(weddingId, email)` UNIQUE where `status = PENDING`                                                                                | One pending invite per email   | Phase 10 |
| `member_invitations`    | `(weddingId, status, createdAt)`                                                                                                    | Invitation list                | Phase 10 |
| `wedding_memberships`   | `(weddingId, ownerSeat)` UNIQUE where `memberType = OWNER` (`owner_seat_per_wedding`)                                               | At most two owners (P10-5)     | Phase 10 |
| `ownership_transfers`   | `weddingId` UNIQUE where `status = PENDING`                                                                                         | One open offer per wedding     | Phase 10 |
| `audit_logs`            | `(resourceType, resourceId, createdAt desc)`                                                                                        | One record's history           | Built    |
| `audit_logs`            | `(weddingId, createdAt desc, _id desc)`                                                                                             | Audit history view (newest)    | Phase 10 |
| `events`                | `(weddingId, date, startTime)`                                                                                                      | Event listing and order        | Phase 4  |
| `events`                | `(weddingId, deletedAt)`                                                                                                            | Active/deleted filtering       | Phase 4  |
| `guests`                | `(weddingId, name)`                                                                                                                 | Guest search                   | Phase 4  |
| `guests`                | `(weddingId, mobile)`                                                                                                               | Lookup and duplicate warning   | Phase 4  |
| `guests`                | `(weddingId, deletedAt)`                                                                                                            | Active/deleted filtering       | Phase 4  |
| `guest_events`          | `(weddingId, guestId, eventId)` UNIQUE where `isActive = true`                                                                      | One active assignment          | Phase 4  |
| `guest_events`          | `(weddingId, eventId, rsvpStatus)`                                                                                                  | Event RSVP counts and filters  | Phase 4  |
| `guest_invitations`     | `guestId` UNIQUE                                                                                                                    | One invitation per guest       | Phase 4  |
| `guest_invitations`     | `tokenHash` UNIQUE (partial: when present)                                                                                          | Token lookup                   | Phase 4  |
| `invitation_deliveries` | `(guestInvitationId, createdAt)`                                                                                                    | Delivery history               | Phase 4  |
| `invitation_deliveries` | `idempotencyKey` UNIQUE                                                                                                             | No repeated sends              | Phase 4  |
| `invitation_deliveries` | `(status, createdAt)`                                                                                                               | Recent failures                | Phase 4  |
| `invitation_activities` | `(guestInvitationId, occurredAt)`                                                                                                   | Activity history               | Phase 4  |
| `expenses`              | `(weddingId, expenseDate)`, `(weddingId, category)`, `(weddingId, paymentStatus)`, `(weddingId, eventId)`, `(weddingId, createdAt)` | Reporting and filters          | Planned  |
| `expenses`              | `(weddingId, vendorId)`                                                                                                             | A vendor's linked expenses     | Phase 9  |
| `expense_payments`      | `(expenseId, paymentDate)`; `(weddingId, expenseId)`                                                                                | Payment history                | Planned  |
| `tasks`                 | `(weddingId, status)`, `(weddingId, priority)`, `(weddingId, dueDate)`, `(weddingId, eventId)`                                      | Board and filters              | Planned  |
| `task_assignments`      | `(taskId, userId)` UNIQUE; `(userId, weddingId)`                                                                                    | Assignees; my tasks            | Planned  |
| `task_activities`       | `(taskId, createdAt)`                                                                                                               | History                        | Planned  |
| `wedding_vendors`       | `(weddingId, deletedAt, name)` (case-insensitive collation); `(weddingId, category)`                                                | List order and filters         | Phase 9  |
| `vendor_bookings`       | `(weddingId, vendorId)`; `(weddingId, status, serviceDate)`; `(weddingId, eventId)`                                                 | Vendor page, filters, summary  | Phase 9  |
| `wedding_websites`      | `publicIdentifier` UNIQUE; `weddingId` UNIQUE                                                                                       | Public lookup; one per wedding | Planned  |
| `memory_qrs`            | `tokenHash` UNIQUE; `(weddingId, status)`; `(eventId, status)`                                                                      | QR lookup and management       | Planned  |
| `notifications`         | `(recipientUserId, isRead, createdAt)`; `(recipientUserId, createdAt)`; `(weddingId, createdAt)`                                    | Feeds                          | Planned  |
| `live_streams`          | `(weddingId, eventId)`; `(weddingId, status)`                                                                                       | Stream lookup                  | Planned  |
| `report_exports`        | `(weddingId, createdAt)`; `(requestedBy, createdAt)`; `(status, createdAt)`                                                         | History and processing         | Planned  |

Indexes support a known access pattern, uniqueness rule or job; each adds write cost.

## 21. Soft deletion and data lifecycle

| State              | Behaviour                                                       |
| ------------------ | --------------------------------------------------------------- |
| Active             | Normal read and write, subject to authorization                 |
| Soft-deleted       | Hidden from normal queries; kept for recovery and audit         |
| Retention period   | **Open** — to be set before production launch                   |
| Permanent deletion | Remove MongoDB records and S3 objects under the approved policy |

- Standard fields: `deletedAt`, `deletedBy`. Records created by a removed organizer or
  partner remain.
- Deleting an event keeps its `guest_events`, invitation deliveries and activities
  (0017 #12). Removing an assignment keeps it inactive (`isActive = false`).
- Deleting a guest soft-deletes the guest, revokes their invitation token (removing
  `tokenHash` and `tokenCiphertext`) and keeps their assignments, RSVPs, deliveries and
  activity as history (0018).
- Revoking a member sets `status = REVOKED` and deletes nothing: their tasks, assignments,
  expenses, payments, bookings, guests and audit entries stay, with their `createdBy` and
  other references (Phase 10, §7.2).
- Member invitations are never deleted; terminal states are kept as history (§7.5).
- Wedding deletion is archive first, permanent later; account deletion is support-controlled.

## 22. Audit and traceability (Phase 4 for RSVP resets and invitation token changes)

```ts
{ _id, weddingId?: ObjectId, actorUserId?: ObjectId, action: string, resourceType: string,
  resourceId: ObjectId, metadata?: object, createdAt: Date }
```

Audit important security and business events (membership and permission changes, RSVP
updates, expense and payment changes (0028 #18), task deletion (other task changes are in `task_activities` — 0026
#17), vendor and booking changes (0032 #18), website publish and unpublish, QR and
invitation token revocation and regeneration), not every read. Retention is open.

Phase 4 writes audit entries at least for organizer resets of an RSVP to `PENDING` (0018),
for invitation token regeneration and revocation, and for every retrieval of an invitation
link by an organizer (0019).

**Phase 10** writes, with `resourceType` `member_invitation`, `wedding_membership` or
`ownership_transfer`:
`OWNERSHIP_TRANSFER_OFFERED`, `OWNERSHIP_TRANSFER_DECLINED`, `OWNERSHIP_TRANSFER_CANCELLED`,
`MEMBER_INVITATION_CREATED`, `MEMBER_INVITATION_RESENT`, `MEMBER_INVITATION_ACCEPTED`,
`MEMBER_INVITATION_DECLINED`, `MEMBER_INVITATION_EXPIRED`, `MEMBER_INVITATION_REVOKED`,
`MEMBER_ROLE_CHANGED`, `MEMBER_PERMISSIONS_CHANGED`, `MEMBER_REMOVED`, `MEMBER_REACTIVATED`,
`OWNERSHIP_TRANSFERRED`, and `PERMISSION_DENIED` for refused management actions (§8.3; not for
ordinary `404`s). `metadata` holds what identifies the change — the invitee email, old and new
role, the added and removed overrides, the target membership and user — and never the raw
token or its hash. The entry's `actorUserId`, `weddingId` and `createdAt` give the actor,
tenant and time; `metadata.outcome` is `SUCCEEDED` or `DENIED`.

The sensitive operations of P10-6 stay audited as today: guest-link regeneration, revocation
and every link retrieval (Phase 4, 0019), every send in `invitation_deliveries`, and QR
regeneration when the QR module is built (§22 above). A refusal of any of them to a
non-owner without the grant is a `PERMISSION_DENIED` entry.

## 23. Database security

- Never trust a client-supplied `weddingId` without resolving membership and authorization.
- Driver-built queries only; global filter sanitization; no operators from user input.
- Store hashes for passwords and for QR, reset and refresh tokens. Invitation tokens are
  stored as a hash plus an encrypted copy whose key is kept outside the database (0018).
  Never store raw secrets in plain form; never log any form of them.
- Restrict S3 objects through application-controlled access and signed URLs.
- Do not store provider responses wholesale where their terms forbid it.
- No internal ObjectIds in public URLs or guest-facing tokens.
- HTTPS, secret management, least-privilege database credentials, structured audit logs.

## 24. Transaction and consistency rules

| Operation                                   | Guidance                                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Simple CRUD                                 | No transaction                                                                            |
| Create wedding + OWNER membership           | Transaction (Built — 0016)                                                                |
| Accept partner invitation                   | Transaction: membership and connection change together                                    |
| Accept a member invitation                  | Transaction: conditional `PENDING` → `ACCEPTED`, membership created or reactivated, audit |
| Change a role, overrides or remove a member | Single conditional update on the membership (not `OWNER`, still `ACTIVE`) + audit         |
| Transfer ownership                          | Transaction: both membership rows and the audit entry (§7.6)                              |
| Add, edit or remove a payment               | Transaction: the payment and the expense's `paidMinor` and status (0028 #8)               |
| Link a task, expense or booking to an event | Transaction: the record and a claim on the event, so a concurrent deletion conflicts      |
| Create or reopen a booking                  | Transaction: the booking and a claim on its vendor (0032 #15)                             |
| Delete a vendor                             | Transaction: check no booking is active, then set `deletedAt` (0032 #15)                  |
| Regenerate or revoke a token                | Single-document update                                                                    |
| Upload photo                                | S3 and metadata coordinated with compensating cleanup                                     |
| Publish website                             | Transaction only if several documents change together                                     |
| RSVP update                                 | Single-document update; audit per consistency requirement                                 |

Transactions are a consistency tool, not a wrapper around every repository call.

## 25. Validation strategy

| Layer                        | Responsibility                                                 |
| ---------------------------- | -------------------------------------------------------------- |
| DTO / application validation | Business rules, authorization-aware checks, user-facing errors |
| Repository / data layer      | Typed persistence and query boundaries                         |
| MongoDB schema validation    | Critical field types, required fields, enum-like constraints   |
| Indexes                      | Uniqueness and query performance                               |

## 26. Primary access patterns

| Use case               | Query                                                         |
| ---------------------- | ------------------------------------------------------------- |
| Resolve user           | `users.email`                                                 |
| List my weddings       | `wedding_memberships.userId + status`                         |
| Resolve wedding access | `wedding_memberships.userId + weddingId + status`             |
| List members           | `wedding_memberships.weddingId + status + role`               |
| Open member invitation | `member_invitations.tokenHash`                                |
| Pending invitations    | `member_invitations.weddingId + status + createdAt`           |
| List events            | `events.weddingId` (not deleted) ordered by `date, startTime` |
| Search guests          | `guests.weddingId + name/mobile`                              |
| Duplicate mobile       | `guests.weddingId + mobile`                                   |
| Guest RSVP             | `guest_events.weddingId + guestId + eventId` (active)         |
| Open invitation        | `guest_invitations.tokenHash`                                 |
| Delivery history       | `invitation_deliveries.guestInvitationId + createdAt`         |
| Unread notifications   | `notifications.recipientUserId + isRead + createdAt`          |
| Expense report         | `expenses.weddingId + date/category/status`                   |
| My tasks               | `task_assignments.userId + weddingId`                         |
| Vendor list            | `wedding_vendors.weddingId` (not deleted) ordered by `name`   |
| Vendor bookings        | `vendor_bookings.weddingId + vendorId`                        |
| Upcoming services      | `vendor_bookings.weddingId + status + serviceDate`            |
| Public website         | `wedding_websites.publicIdentifier`                           |
| QR upload entry        | `memory_qrs.tokenHash`                                        |
| Event streams          | `live_streams.weddingId + eventId`                            |
| Report history         | `report_exports.weddingId + createdAt`                        |

## 27. Key data invariants

- A user owns at most one wedding; one membership per user per wedding.
- Every wedding keeps at least one `ACTIVE` `OWNER` membership and at most two `OWNER` rows
  (seats 1 and 2); `memberType = OWNER` ⇔ `role = OWNER` ⇔ `ownerSeat` set; organizer
  invitations never create owners (Phase 10).
- At most one `PENDING` ownership transfer per wedding; a completed transfer moves exactly one
  seat and never touches the other owner's row.
- A member invitation token works once; at most one `PENDING` invitation per wedding and
  email.
- A guest belongs to exactly one wedding; at most one active assignment per guest and event.
- `attendeeCount` matches `rsvpStatus` (0017).
- One invitation per guest; only the current token works; a deleted guest has no working
  token; delivery history never creates guests or assignments.
- `deliveryStatus` never becomes `DELIVERED` without provider confirmation; opens never
  change it.
- `publicIdentifier` and `memory_qrs.tokenHash` are globally unique.
- No duplicate task assignee.
- An expense's `paidMinor` equals the sum of its payments and never exceeds `amountMinor`;
  `paymentStatus` follows from the two (0028 #7, #8). Each payment change updates the expense
  with a conditional update in the same transaction, so concurrent requests cannot overpay.
- A deleted vendor has no booking that is not `CANCELLED`; a booking's `vendorId` never
  changes (0032 #11, #15).
- Every wedding-scoped query is tenant-scoped and authorization-checked.

## 28. Growth and scalability

Separate high-growth collections (photos, notifications, invitation deliveries and
activities, task activities, audit logs, payments); paginate growing lists, with cursors for
large chronological feeds; no unbounded arrays on weddings, users or guests; compound
indexes matching real filters and sorts; background work (reminders, reports, media
cleanup) decided when it is needed (0025); a stateless backend.

## 29. Backup and recovery

Atlas backups for the production tier; documented and tested restores; an S3 lifecycle and
versioning strategy; database and S3 recovery documented together. **Open:** RPO/RTO,
backup retention, S3 versioning and disaster-recovery runbooks.

## 30. Schema migration and versioning

Version-controlled schema changes; backward-compatible migrations for rolling deployments;
add fields before switching readers and writers; backfill large collections asynchronously;
remove obsolete fields only when no deployed version uses them; index changes are monitored
deployment operations (automatic only in local and test).

**Data migrations (from Phase 10).** A data change that an index depends on runs as a
versioned migration before indexes are built. Migrations are numbered scripts in the API,
run by a one-off command (`db:migrate`) in the same way as `db:indexes`. Each records its
completion in a `schema_migrations` collection (`{ _id: name, appliedAt }`), so it runs once
and a re-run is safe. A migration that finds inconsistent data stops, reports every case and
changes nothing; data is never fixed silently (0004). Deployment order: `db:migrate`, then
`db:indexes`, then the new code. Locally and in tests the migrations run at start-up before
automatic index creation. The first migration is the owner-seat backfill (0034).

## 31. Implementation order

Built: users, sessions, reset tokens (Phase 2); weddings and memberships (Phase 3).
Next (Phase 4): events, guests, guest events, guest invitations, deliveries, activities,
and `audit_logs` for the Phase 4 audit entries.
Then the remaining planned collections as their phases are approved.

## 32. Open technical decisions

| Area          | Open decision                                                      |
| ------------- | ------------------------------------------------------------------ |
| Invitations   | Webhook handling; encryption algorithm and key rotation procedure  |
| QR            | Expiry policy and regeneration details                             |
| Website       | `publicIdentifier` generation and collisions; sitemap and metadata |
| Google Places | Fields that may be stored or cached (discovery deferred — 0032 #3) |
| Notifications | Templates and default schedules (product-deferred)                 |
| Media         | S3 bucket and prefix layout; image processing; lifecycle           |
| Retention     | Audit, delivery history, soft-deleted data, permanent purge        |
| Backups       | RPO/RTO, retention, restore-test cadence                           |
| Indexes       | Final production set after observing real query plans              |

**Phase 10 decisions (approved by the product owner, 2026-10-27; recorded in decision 0034;
interpretations R1–R6 approved 2026-10-28).**
The default matrix is in §8; the eight follow-up decisions are applied in §7 and §8:

| #     | Decision                                                                                                               | Where              |
| ----- | ---------------------------------------------------------------------------------------------------------------------- | ------------------ |
| P10-1 | No email verification before accepting; token plus matching account email                                              | §7.5               |
| P10-2 | Invitations expire seven days after the token is issued; checked on every read and on acceptance                       | §7.5               |
| P10-3 | A revoked member may be re-invited; the same membership row is reused, overrides cleared, access only after acceptance | §7.2               |
| P10-4 | An Admin cannot assign the Admin role or manage other Admins                                                           | §8.3               |
| P10-5 | An owner transfers only their own seat; the recipient accepts; the giver becomes Admin; at most two owners             | §7.2, §7.6         |
| P10-6 | Guest-link sending and QR regeneration are owner-only by default, grantable by override                                | §8.1–§8.3          |
| P10-7 | Membership status `INVITED` stays reserved and is not written                                                          | §7.2               |
| P10-8 | Dashboard sections need `VIEW` on their module; any active member can be a task assignee or payer                      | API Design §6, §23 |

## 33. Decision summary

| Decision        | Baseline                                                            |
| --------------- | ------------------------------------------------------------------- |
| Database        | MongoDB Atlas                                                       |
| Tenant boundary | Wedding                                                             |
| User–wedding    | Owns 0..1 wedding; memberships 0..N                                 |
| Authorization   | Predefined roles + membership permission overrides                  |
| Guests          | One guest per wedding + one active `GuestEvent` per event           |
| Invitations     | One per guest; hashed token; no automatic expiry; opens as activity |
| Expense sharing | Shared with the connected partner; no visibility field              |
| Files           | S3 objects + MongoDB metadata                                       |
| Website         | One document per wedding, created by the Website phase              |
| QR              | Generic memory QR with WEDDING/EVENT scope                          |
| Streaming       | YouTube Live association                                            |
| Reports         | Excel, generated on demand                                          |
| Deletion        | Soft delete first; permanent deletion later                         |
| Audit           | Central `audit_logs`                                                |

## 34. Summary

A normalized, tenant-aware MongoDB design. The wedding is the business boundary and the
user the identity boundary. Memberships give access, roles give defaults and overrides give
customization. High-growth data lives in its own collections; bounded configuration is
embedded.

```text
Core rule:      authenticate → resolve membership → authorize → query with weddingId → return
Security rule:  public and guest access use dedicated hashed tokens, never ObjectIds
Storage rule:   MongoDB = metadata and business state; S3 = binary files
Lifecycle rule: active → soft-deleted → retention period → permanent purge
```
