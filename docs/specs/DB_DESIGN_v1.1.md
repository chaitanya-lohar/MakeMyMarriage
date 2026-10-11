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

| Version | Date       | Change                                                                                                 |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| 1.0     | 2026-09-24 | Baseline design.                                                                                       |
| 1.1     | 2026-10-10 | Consolidated: v1.0 plus decisions 0008–0010, 0012, 0013, 0015–0019 and the schema built in Phases 2–3. |

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
| Background jobs              | Redis + BullMQ                                                                                                                            |
| Email provider               | Resend                                                                                                                                    |
| Vendor discovery             | Google Places API (New), through a provider abstraction                                                                                   |
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
| `partner_connections`   | Partner relationship lifecycle            | Partner       | Planned                                                               |
| `resource_shares`       | Explicit resource sharing                 | Sharing       | Planned                                                               |
| `notifications`         | Recipient-specific notifications          | Notifications | Planned                                                               |
| `reminders`             | Reminder configuration                    | Notifications | Planned (cadence deferred)                                            |
| `expenses`              | Wedding expenses                          | Expenses      | Planned                                                               |
| `expense_payments`      | Instalment and payment history            | Expenses      | Planned                                                               |
| `expense_receipts`      | S3 receipt metadata                       | Expenses      | Planned                                                               |
| `tasks`                 | Wedding tasks                             | Tasks         | Planned                                                               |
| `task_assignments`      | Task ↔ member assignment                  | Tasks         | Planned                                                               |
| `task_activities`       | Task history                              | Tasks         | Planned                                                               |
| `wedding_vendors`       | Managed wedding vendors                   | Vendors       | Planned                                                               |
| `vendor_attachments`    | S3 vendor attachment metadata             | Vendors       | Planned                                                               |
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

### 7.2 `wedding_memberships` (Built — decisions 0012, 0016)

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
  // Planned, added with organizers and partner connection:
  ownerType?: string,       // BRIDE, GROOM
  permissionOverrides?: [{ resource: string, action: string, effect: string }],  // ALLOW / DENY
  invitedBy?: ObjectId,
  invitedAt?: Date,
  revokedAt?: Date
}
```

- Unique `(userId, weddingId)`.
- **At most one `OWNER` membership per user** across all weddings: partial unique index on
  `userId` where `memberType = OWNER` (`one_owner_membership_per_user`). Which statuses count
  after a partner disconnects is part of A5 (0011) and may change this filter.
- Owners have unrestricted permissions. Predefined roles are application-managed; overrides
  customize access. An organizer account can belong to several weddings.

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

## 8. Roles and permission model

| Role      | Purpose                                      |
| --------- | -------------------------------------------- |
| OWNER     | Bride or groom; unrestricted wedding control |
| ADMIN     | Broad delegated management                   |
| ORGANIZER | Planning and operational coordination        |
| EDITOR    | Modify permitted wedding data                |
| VIEWER    | Read-only access                             |

| Action    | Use                                  |
| --------- | ------------------------------------ |
| VIEW      | Read                                 |
| CREATE    | Create                               |
| EDIT      | Modify                               |
| DELETE    | Delete or soft-delete                |
| MANAGE    | Broader lifecycle and administration |
| CONFIGURE | Change configuration and settings    |

Authorization flow: authenticate → resolve wedding membership → check `ACTIVE` status →
resolve role and overrides → authorize resource and action → run a `weddingId`-scoped query.
The default permission matrix per role is open.

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
  on an immediate provider rejection (0018) or when every automatic retry fails (0023). Regenerating the link (from an active or a
  revoked link) sets it back to `DRAFT` and clears `revokedAt`; revoking never changes it
  (0020). `invitation_deliveries` records are never changed by either. `DELIVERED`, and failures reported after
  acceptance, need provider webhooks (not in Phase 4). Opens never change it.
- A queued email is tied to the link it was queued for (`tokenCreatedAt`). If that link is
  revoked or regenerated before the worker sends it, the email is skipped and nothing is
  sent or recorded. If the link changes during the send, the attempt is still recorded in
  `invitation_deliveries`, but `deliveryStatus` is left unchanged (0020).

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
  idempotencyKey: string,      // unique; makes the send job safe to retry
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

## 12. Expenses and payments (Planned — decisions 0009, 0010 #5–#8)

### 12.1 `expenses`

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  title: string,
  description?: string,
  amountMinor: number,       // integer minor units
  currency: string,          // INR in V1
  category: string,          // VENUE, CATERING, DECORATION, PHOTOGRAPHY, CLOTHING, JEWELLERY,
                             // MAKEUP, ENTERTAINMENT, INVITATIONS, GIFTS, MISCELLANEOUS
  eventId?: ObjectId,
  vendorId?: ObjectId,
  paidByType: string,        // WEDDING_MEMBER, EXTERNAL_PERSON
  paidByUserId?: ObjectId,
  paidByName?: string,
  expenseDate: Date,
  paymentStatus: string,     // PENDING, PARTIALLY_PAID, PAID — no CANCELLED in V1 (0018)
  notes?: string,
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
- External payers such as parents use `paidByName`.

### 12.2 `expense_payments`

```ts
{
  _id: ObjectId,
  expenseId: ObjectId,
  amountMinor: number,
  paidByUserId?: ObjectId,
  paymentDate: Date,
  paymentMethod?: string,    // CASH, UPI, BANK_TRANSFER, CARD, CHEQUE, OTHER
  referenceNumber?: string,
  notes?: string,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### 12.3 `expense_receipts`

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

## 13. Tasks (Planned — decisions 0010 #3, #4 and 0013)

### 13.1 `tasks`

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  title: string,
  description?: string,
  status: string,       // TODO, IN_PROGRESS, BLOCKED, COMPLETED, CANCELLED
  priority: string,     // LOW, MEDIUM, HIGH, URGENT
  dueDate?: Date,
  eventId?: ObjectId,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date,
  deletedAt?: Date,
  deletedBy?: ObjectId
}
```

- **Approved addition (0010 #4):** task notes and task attachments, designed in the Tasks
  phase (attachments in S3, metadata in MongoDB).
- Reporting buckets and the overdue rule: decision 0013.

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

## 14. Vendor management and discovery (Planned)

### 14.1 `wedding_vendors`

```ts
{
  _id: ObjectId,
  weddingId: ObjectId,
  name: string,
  category: string,
  phone?: string,
  email?: string,
  address?: string,
  website?: string,
  contactPerson?: string,
  googlePlaceId?: string,
  status: string,      // PROSPECT, CONTACTED, QUOTATION_RECEIVED, NEGOTIATING, CONFIRMED, COMPLETED, CANCELLED
  notes?: string,
  quotationAmountMinor?: number,
  finalAmountMinor?: number,
  eventIds: [ObjectId],
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date,
  deletedAt?: Date
}
```

- Only an explicit "Add to My Vendors" creates a managed vendor. Google data is stored only
  as the provider's terms allow. Vendor money uses expenses and expense payments.

### 14.2 `vendor_attachments`

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

| From            | Relationship         | To                                        | Cardinality                         |
| --------------- | -------------------- | ----------------------------------------- | ----------------------------------- |
| User            | owns                 | Wedding                                   | 0..1                                |
| User            | participates via     | WeddingMembership                         | 0..N                                |
| Wedding         | has                  | WeddingMembership                         | 1..N                                |
| Wedding         | has                  | Event                                     | 0..N                                |
| Wedding         | has                  | Guest                                     | 0..N                                |
| Guest           | participates through | GuestEvent                                | 0..N                                |
| Event           | has                  | GuestEvent                                | 0..N                                |
| Guest           | has                  | GuestInvitation                           | 0..1                                |
| GuestInvitation | has                  | InvitationDelivery                        | 0..N                                |
| GuestInvitation | has                  | InvitationActivity                        | 0..N                                |
| Wedding         | has                  | Expense                                   | 0..N                                |
| Expense         | has                  | ExpensePayment, ExpenseReceipt            | 0..N                                |
| Wedding         | has                  | Task                                      | 0..N                                |
| Task            | has                  | TaskAssignment, TaskActivity              | 0..N                                |
| Wedding         | has                  | WeddingVendor                             | 0..N                                |
| WeddingVendor   | has                  | VendorAttachment                          | 0..N                                |
| Wedding         | has                  | WeddingWebsite                            | 0..1 (created by the Website phase) |
| Wedding         | has                  | Photo, MemoryQR, LiveStream, ReportExport | 0..N                                |

## 19. Embedding vs referencing

| Data                                | Strategy        | Reason                            |
| ----------------------------------- | --------------- | --------------------------------- |
| Wedding → events                    | Reference       | Independent queries; growing      |
| Wedding → guests                    | Reference       | Unbounded growth; search          |
| Guest → GuestEvent                  | Reference       | Many-to-many                      |
| Guest → invitation                  | Reference       | Own lifecycle and history         |
| Invitation → deliveries, activities | Reference       | Growing history                   |
| Expense → payments, receipts        | Reference       | Multiple records                  |
| Task → assignments, activities      | Reference       | Multiple records                  |
| Wedding → website                   | Single document | Bounded configuration             |
| Event → venue                       | Embedded        | Value object of the event         |
| Website → sections                  | Embedded        | Bounded configuration             |
| Vendor → events                     | Reference IDs   | A vendor can serve several events |

## 20. Indexes and uniqueness

| Collection              | Index / constraint                                                                                          | Purpose                        | Status  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------ | ------- |
| `users`                 | `email` UNIQUE                                                                                              | Login identity                 | Built   |
| `auth_sessions`         | `userId`                                                                                                    | Revoke all sessions            | Built   |
| `password_reset_tokens` | `tokenHash` UNIQUE                                                                                          | Token lookup                   | Built   |
| `wedding_memberships`   | `(userId, weddingId)` UNIQUE                                                                                | No duplicate membership        | Built   |
| `wedding_memberships`   | `userId` UNIQUE where `memberType = OWNER`                                                                  | One owned wedding per user     | Built   |
| `events`                | `(weddingId, date, startTime)`                                                                              | Event listing and order        | Phase 4 |
| `events`                | `(weddingId, deletedAt)`                                                                                    | Active/deleted filtering       | Phase 4 |
| `guests`                | `(weddingId, name)`                                                                                         | Guest search                   | Phase 4 |
| `guests`                | `(weddingId, mobile)`                                                                                       | Lookup and duplicate warning   | Phase 4 |
| `guests`                | `(weddingId, deletedAt)`                                                                                    | Active/deleted filtering       | Phase 4 |
| `guest_events`          | `(weddingId, guestId, eventId)` UNIQUE where `isActive = true`                                              | One active assignment          | Phase 4 |
| `guest_events`          | `(weddingId, eventId, rsvpStatus)`                                                                          | Event RSVP counts and filters  | Phase 4 |
| `guest_invitations`     | `guestId` UNIQUE                                                                                            | One invitation per guest       | Phase 4 |
| `guest_invitations`     | `tokenHash` UNIQUE (partial: when present)                                                                  | Token lookup                   | Phase 4 |
| `invitation_deliveries` | `(guestInvitationId, createdAt)`                                                                            | Delivery history               | Phase 4 |
| `invitation_deliveries` | `idempotencyKey` UNIQUE                                                                                     | Safe job retries               | Phase 4 |
| `invitation_deliveries` | `(status, createdAt)`                                                                                       | Recent failures                | Phase 4 |
| `invitation_activities` | `(guestInvitationId, occurredAt)`                                                                           | Activity history               | Phase 4 |
| `expenses`              | `(weddingId, expenseDate)`, `(weddingId, category)`, `(weddingId, paymentStatus)`, `(weddingId, createdAt)` | Reporting and filters          | Planned |
| `expense_payments`      | `(expenseId, paymentDate)`                                                                                  | Payment history                | Planned |
| `tasks`                 | `(weddingId, status)`, `(weddingId, priority)`, `(weddingId, dueDate)`, `(weddingId, eventId)`              | Board and filters              | Planned |
| `task_assignments`      | `(taskId, userId)` UNIQUE; `(userId, weddingId)`                                                            | Assignees; my tasks            | Planned |
| `task_activities`       | `(taskId, createdAt)`                                                                                       | History                        | Planned |
| `wedding_vendors`       | `(weddingId, category)`, `(weddingId, status)`, `(weddingId, deletedAt)`                                    | Filters                        | Planned |
| `wedding_websites`      | `publicIdentifier` UNIQUE; `weddingId` UNIQUE                                                               | Public lookup; one per wedding | Planned |
| `memory_qrs`            | `tokenHash` UNIQUE; `(weddingId, status)`; `(eventId, status)`                                              | QR lookup and management       | Planned |
| `notifications`         | `(recipientUserId, isRead, createdAt)`; `(recipientUserId, createdAt)`; `(weddingId, createdAt)`            | Feeds                          | Planned |
| `live_streams`          | `(weddingId, eventId)`; `(weddingId, status)`                                                               | Stream lookup                  | Planned |
| `report_exports`        | `(weddingId, createdAt)`; `(requestedBy, createdAt)`; `(status, createdAt)`                                 | History and processing         | Planned |

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
- Wedding deletion is archive first, permanent later; account deletion is support-controlled.

## 22. Audit and traceability (Phase 4 for RSVP resets and invitation token changes)

```ts
{ _id, weddingId?: ObjectId, actorUserId?: ObjectId, action: string, resourceType: string,
  resourceId: ObjectId, metadata?: object, createdAt: Date }
```

Audit important security and business events (membership and permission changes, RSVP
updates, expense edits, task changes, vendor lifecycle, website publish and unpublish, QR and
invitation token revocation and regeneration), not every read. Retention is open.

Phase 4 writes audit entries at least for organizer resets of an RSVP to `PENDING` (0018),
for invitation token regeneration and revocation, and for every retrieval of an invitation
link by an organizer (0019).

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

| Operation                         | Guidance                                                  |
| --------------------------------- | --------------------------------------------------------- |
| Simple CRUD                       | No transaction                                            |
| Create wedding + OWNER membership | Transaction (Built — 0016)                                |
| Accept partner invitation         | Transaction: membership and connection change together    |
| Create expense + first payment    | Transaction if both must succeed or fail together         |
| Regenerate or revoke a token      | Single-document update                                    |
| Upload photo                      | S3 and metadata coordinated with compensating cleanup     |
| Publish website                   | Transaction only if several documents change together     |
| RSVP update                       | Single-document update; audit per consistency requirement |

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
| List events            | `events.weddingId` (not deleted) ordered by `date, startTime` |
| Search guests          | `guests.weddingId + name/mobile`                              |
| Duplicate mobile       | `guests.weddingId + mobile`                                   |
| Guest RSVP             | `guest_events.weddingId + guestId + eventId` (active)         |
| Open invitation        | `guest_invitations.tokenHash`                                 |
| Delivery history       | `invitation_deliveries.guestInvitationId + createdAt`         |
| Unread notifications   | `notifications.recipientUserId + isRead + createdAt`          |
| Expense report         | `expenses.weddingId + date/category/status`                   |
| My tasks               | `task_assignments.userId + weddingId`                         |
| Vendor workflow        | `wedding_vendors.weddingId + status/category`                 |
| Public website         | `wedding_websites.publicIdentifier`                           |
| QR upload entry        | `memory_qrs.tokenHash`                                        |
| Event streams          | `live_streams.weddingId + eventId`                            |
| Report history         | `report_exports.weddingId + createdAt`                        |

## 27. Key data invariants

- A user owns at most one wedding; one membership per user per wedding.
- A guest belongs to exactly one wedding; at most one active assignment per guest and event.
- `attendeeCount` matches `rsvpStatus` (0017).
- One invitation per guest; only the current token works; a deleted guest has no working
  token; delivery history never creates guests or assignments.
- `deliveryStatus` never becomes `DELIVERED` without provider confirmation; opens never
  change it.
- `publicIdentifier` and `memory_qrs.tokenHash` are globally unique.
- No duplicate task assignee.
- Expense payment totals are validated against payment status in the application.
- Every wedding-scoped query is tenant-scoped and authorization-checked.

## 28. Growth and scalability

Separate high-growth collections (photos, notifications, invitation deliveries and
activities, task activities, audit logs, payments); paginate growing lists, with cursors for
large chronological feeds; no unbounded arrays on weddings, users or guests; compound
indexes matching real filters and sorts; BullMQ for email, reminders, reports, media and
cleanup; a stateless backend.

## 29. Backup and recovery

Atlas backups for the production tier; documented and tested restores; an S3 lifecycle and
versioning strategy; database and S3 recovery documented together. **Open:** RPO/RTO,
backup retention, S3 versioning and disaster-recovery runbooks.

## 30. Schema migration and versioning

Version-controlled schema changes; backward-compatible migrations for rolling deployments;
add fields before switching readers and writers; backfill large collections asynchronously;
remove obsolete fields only when no deployed version uses them; index changes are monitored
deployment operations (automatic only in local and test).

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
| Permissions   | Default matrix per role                                            |
| Website       | `publicIdentifier` generation and collisions; sitemap and metadata |
| Google Places | Fields that may be stored or cached                                |
| Notifications | Templates and default schedules (product-deferred)                 |
| Media         | S3 bucket and prefix layout; image processing; lifecycle           |
| Retention     | Audit, delivery history, soft-deleted data, permanent purge        |
| Backups       | RPO/RTO, retention, restore-test cadence                           |
| Indexes       | Final production set after observing real query plans              |

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
