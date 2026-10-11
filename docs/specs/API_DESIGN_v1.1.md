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

| Version | Date       | Change                                                                                                           |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-09-24 | Baseline contract.                                                                                               |
| 1.1     | 2026-10-10 | Consolidated: v1.0 plus decisions 0001, 0008, 0009, 0010, 0012, 0015–0019 and the endpoints built in Phases 2–3. |

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
Browser → Next.js (Vercel) → /api/v1 proxy (same origin — 0001) → NestJS API container
NestJS API → MongoDB Atlas · Redis/BullMQ · Amazon S3 · Resend · Google Places · YouTube Live
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

| Method | Endpoint                          | Purpose                                             | Auth                          | Status  |
| ------ | --------------------------------- | --------------------------------------------------- | ----------------------------- | ------- |
| POST   | `/weddings`                       | Create the user's wedding; user becomes OWNER       | User                          | Built   |
| GET    | `/weddings`                       | Weddings with an `ACTIVE` membership (may be empty) | User                          | Built   |
| GET    | `/weddings/{weddingId}`           | One wedding                                         | Member                        | Built   |
| PATCH  | `/weddings/{weddingId}`           | Update wedding details                              | Member (OWNER until Phase 10) | Built   |
| DELETE | `/weddings/{weddingId}`           | Archive / soft-delete the wedding                   | Owner                         | Planned |
| GET    | `/weddings/{weddingId}/dashboard` | Dashboard summary (0019, 0021, 0022)                | Member                        | Phase 4 |

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
- The countdown and wedding details come from `GET /weddings/{weddingId}`. Later modules add
  their own summaries when they are built (PRD §18).

## 7. Membership, partner and sharing API (Planned)

| Method | Endpoint                                       | Purpose                          |
| ------ | ---------------------------------------------- | -------------------------------- |
| GET    | `/weddings/{weddingId}/members`                | List members and organizers      |
| POST   | `/weddings/{weddingId}/members/invitations`    | Invite an organizer or member    |
| PATCH  | `/weddings/{weddingId}/members/{membershipId}` | Change role, status or overrides |
| DELETE | `/weddings/{weddingId}/members/{membershipId}` | Revoke a membership              |
| GET    | `/weddings/{weddingId}/partner`                | Get the partner connection       |
| POST   | `/weddings/{weddingId}/partner/invitations`    | Invite the partner               |
| POST   | `/partner/invitations/{token}/accept`          | Accept a partner invitation      |
| POST   | `/weddings/{weddingId}/partner/disconnect`     | Disconnect                       |
| GET    | `/weddings/{weddingId}/shares`                 | List explicit shares             |
| POST   | `/weddings/{weddingId}/shares`                 | Create a resource share          |
| DELETE | `/weddings/{weddingId}/shares/{shareId}`       | Revoke a share                   |

- Membership answers "who can access this wedding"; sharing answers "which protected
  resource is shared"; the partner connection records the relationship.
- Accepting returns a clear domain error while the invitee owns a wedding (0012, N1).
- Share resource types and disconnect behaviour depend on A4 and A5 (0011).

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
  `publicId`; v1.0's `POST/DELETE …/events/{eventId}/share` routes depend on A4 (0011).

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
| POST   | `/invitation/send`       | Queue the invitation email                   | `202`   |
| POST   | `/invitation/resend`     | Queue it again                               | `202`   |
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
- Send and resend accept an optional `Idempotency-Key` header; each attempt becomes an
  `invitation_deliveries` record and the email is sent by the worker, which decrypts the
  stored token copy to build the link. Resends reuse the same token. The attempt and the
  invitation's status become `SENT` when the provider accepts the request and `FAILED`, with
  the provider's reason, when it rejects it immediately (0018). `DELIVERED`, and failures
  reported after acceptance, need provider webhooks (not in Phase 4).
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
  Both guest routes are rate-limited per token and IP (`429`).
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

## 12. Expense API (Planned — decisions 0009, 0010)

| Method | Endpoint                                                          | Purpose          |
| ------ | ----------------------------------------------------------------- | ---------------- |
| GET    | `/weddings/{weddingId}/expenses`                                  | List and filter  |
| POST   | `/weddings/{weddingId}/expenses`                                  | Create           |
| GET    | `/weddings/{weddingId}/expenses/{expenseId}`                      | Get              |
| PATCH  | `/weddings/{weddingId}/expenses/{expenseId}`                      | Update           |
| DELETE | `/weddings/{weddingId}/expenses/{expenseId}`                      | Soft-delete      |
| GET    | `/weddings/{weddingId}/expenses/{expenseId}/payments`             | List payments    |
| POST   | `/weddings/{weddingId}/expenses/{expenseId}/payments`             | Add a payment    |
| PATCH  | `/weddings/{weddingId}/expenses/{expenseId}/payments/{paymentId}` | Update a payment |
| DELETE | `/weddings/{weddingId}/expenses/{expenseId}/payments/{paymentId}` | Remove a payment |
| POST   | `/weddings/{weddingId}/expenses/{expenseId}/receipts/upload-url`  | S3 upload URL    |
| DELETE | `/weddings/{weddingId}/expenses/{expenseId}/receipts/{receiptId}` | Delete a receipt |

```json
POST /api/v1/weddings/{weddingId}/expenses
{ "title": "Decorator advance", "amountMinor": 5000000, "currency": "INR",
  "category": "DECORATION", "eventId": "…", "vendorId": null,
  "expenseDate": "2027-01-20", "paymentStatus": "PARTIALLY_PAID" }
```

- **No `visibility` field**; expenses are shared with the connected partner (0009); normal
  `VIEW` permission applies.
- `category` is a fixed `ExpenseCategory` value (0010 #7); filter with `?category=`.
- `amountMinor` is integer minor units (₹50,000 = 5000000 paise).

## 13. Task API (Planned)

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

Statuses `TODO`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `CANCELLED` (0010 #3, 0013). Note and
attachment endpoints are designed with the Tasks phase (0010 #4).

## 14. Vendor API (Planned)

| Method | Endpoint                                                          | Purpose                 |
| ------ | ----------------------------------------------------------------- | ----------------------- |
| GET    | `/weddings/{weddingId}/vendors`                                   | List managed vendors    |
| POST   | `/weddings/{weddingId}/vendors`                                   | Add a vendor            |
| GET    | `/weddings/{weddingId}/vendors/{vendorId}`                        | Get                     |
| PATCH  | `/weddings/{weddingId}/vendors/{vendorId}`                        | Update                  |
| DELETE | `/weddings/{weddingId}/vendors/{vendorId}`                        | Soft-delete             |
| POST   | `/weddings/{weddingId}/vendors/{vendorId}/attachments/upload-url` | S3 upload URL           |
| GET    | `/weddings/{weddingId}/vendor-discovery/search`                   | Search nearby vendors   |
| GET    | `/weddings/{weddingId}/vendor-discovery/{providerPlaceId}`        | Discovery detail        |
| POST   | `/weddings/{weddingId}/vendor-discovery/{providerPlaceId}/add`    | Add a discovered vendor |

`GET …/vendor-discovery/search?q=photographer&lat=26.9124&lng=75.7873&radius=10000`. The web
app calls MakeMyMarriage, never Google directly; results are not managed vendors until
added.

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

| Code                        | HTTP | Where                                |
| --------------------------- | ---- | ------------------------------------ |
| `VALIDATION_FAILED`         | 400  | Any DTO or rule violation            |
| `UNAUTHENTICATED`           | 401  | No or ended session                  |
| `INVALID_CREDENTIALS`       | 401  | Sign-in (0015)                       |
| `EMAIL_ALREADY_REGISTERED`  | 409  | Registration (0015)                  |
| `RESET_TOKEN_INVALID`       | 400  | Password reset (0015)                |
| `RATE_LIMITED`              | 429  | Rate limits                          |
| `WEDDING_ALREADY_OWNED`     | 409  | Create wedding (0016)                |
| `WEDDING_NOT_FOUND`         | 404  | Any wedding route (0016)             |
| `EVENT_NOT_FOUND`           | 404  | Phase 4                              |
| `GUEST_NOT_FOUND`           | 404  | Phase 4                              |
| `GUEST_EVENT_NOT_FOUND`     | 404  | Phase 4                              |
| `INVITATION_NOT_FOUND`      | 404  | Phase 4 (organizer and guest routes) |
| `INVITATION_ALREADY_EXISTS` | 409  | Phase 4                              |
| `INVITATION_REVOKED`        | 409  | Phase 4                              |
| `GUEST_EMAIL_REQUIRED`      | 422  | Phase 4                              |

## 22. Validation and DTO strategy

Every write endpoint has a DTO; required fields, types, lengths, formats, enums and
cross-field rules are validated; emails and other canonical fields are normalized; unknown
fields are rejected; ObjectId path parameters are validated before repository access;
referenced resources must belong to the same wedding; uploads validate type, size and
signature; business rules stay in application services.

## 23. Authorization model

```text
Request → authentication guard → resolve weddingId → membership lookup → ACTIVE check
        → role + overrides → resource share check (where applicable) → controller
        → application service → repository (weddingId-scoped query)
```

| Example                         | Required authorization                        |
| ------------------------------- | --------------------------------------------- |
| Create guest                    | CREATE on Guests                              |
| Edit RSVP manually              | EDIT/MANAGE on GuestEvent                     |
| Create, send, revoke invitation | MANAGE on Invitations                         |
| Edit expense                    | EDIT on Expenses                              |
| View expense                    | VIEW on Expenses (no visibility check — 0009) |
| Publish website                 | CONFIGURE/MANAGE on Website                   |
| Regenerate QR                   | MANAGE on Memory QR                           |
| Delete guest photo              | DELETE on Gallery                             |
| View audit logs                 | VIEW/MANAGE on Audit                          |

Until Phase 10 only `OWNER` members exist, and owners pass every check.

## 24. Pagination, filtering and sorting

```text
GET /weddings/{weddingId}/guests?search=raju&eventId=…&rsvpStatus=ATTENDING&limit=25&cursor=…
GET /weddings/{weddingId}/expenses?from=2027-01-01&to=2027-02-28&category=DECORATION
    &paymentStatus=PENDING&sort=-expenseDate&limit=25
```

Server-enforced maximum page size; stable indexed sort keys for cursors; allow-listed
parameters; no MongoDB operators from query strings.

## 25. Idempotency and duplicate protection

| Operation              | Strategy                                                                       |
| ---------------------- | ------------------------------------------------------------------------------ |
| Create guest           | Normal POST; duplicate mobile produces a warning, never a block                |
| Assign guest to event  | Partial unique active assignment; repeat returns the existing one              |
| Send/resend invitation | Each attempt is a delivery record; optional `Idempotency-Key`; jobs idempotent |
| Accept partner invite  | Idempotent on invitation/connection state                                      |
| Create payment         | Optional `Idempotency-Key`                                                     |
| Generate QR            | POST creates; regenerate is explicit                                           |
| Report export          | Optional `Idempotency-Key`                                                     |

Idempotency keys are stored with the result for a bounded period (0010 #16).

## 26. File upload architecture

```text
1 client asks for an upload URL → 2 API authorizes and validates → 3 short-lived S3 target
4 client uploads to S3 → 5 client/API confirms → 6 API stores metadata → 7 async cleanup
```

Large media never passes through the API; keys are opaque and wedding-scoped; orphaned
objects are cleaned up asynchronously.

## 27. Background job boundaries

| Job                           | Trigger                      | Queue                  |
| ----------------------------- | ---------------------------- | ---------------------- |
| Password reset email          | Forgot password              | BullMQ `email` (Built) |
| Invitation email              | Send / resend                | BullMQ                 |
| Guest reminders               | Reminder schedule (deferred) | BullMQ                 |
| Organizer notifications       | Business events              | BullMQ                 |
| Report generation             | Export request               | BullMQ                 |
| Media cleanup                 | Deleted or orphaned object   | BullMQ                 |
| Email delivery reconciliation | Provider webhook (future)    | BullMQ                 |

The worker runs in its own container, never as a Vercel request function (0005).

## 28. Rate limiting and abuse protection

| Endpoint class           | Protection                                         |
| ------------------------ | -------------------------------------------------- |
| Sign-in / password reset | Per-identity limits (0015)                         |
| Guest invitation token   | Token and IP limits                                |
| Guest RSVP               | Token and IP limits + state validation             |
| Guest photo upload       | Token and IP limits + file size and content limits |
| QR endpoints             | Token and IP limits                                |
| Public website           | General traffic limit                              |
| Vendor discovery         | Provider-aware limits and permitted caching        |

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
| Google Places (New) | Vendor discovery only; map responses to internal DTOs               |
| YouTube Live        | Store stream identifiers; expose embed information                  |
| Amazon S3           | Binary storage; controlled upload and access URLs                   |
| Redis / BullMQ      | Asynchronous jobs; not a public API                                 |

## 33. Testing strategy

| Level       | Coverage                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | DTO validation, services, permission evaluators, token services                                                                                    |
| Integration | Controllers + MongoDB repositories + authorization (real Redis, in-memory MongoDB)                                                                 |
| Contract    | Generated OpenAPI checked in CI; request/response schemas                                                                                          |
| Security    | Authentication, tenant isolation, token guessing, IDOR, rate limiting                                                                              |
| Workflow    | Invitation → send → open → RSVP; QR → upload → gallery → guest deletion; partner invite → accept → share → disconnect; expense → payment → receipt |
| Provider    | Resend, Google Places, YouTube adapters                                                                                                            |

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
| Roles | Role names' default permission matrix |
| Sharing | Resource types and actions for `resource_shares` (A4) |
| Reminders | Schedules, recipients, templates |
| Uploads | File size and type limits; image processing |
| Vendor discovery | Google fields and caching rules |
| Website | Public payload, caching and revalidation; sitemap and metadata |
| Rate limits | Numeric thresholds beyond 0015 (Phase 4 guest invitation routes use engineering defaults: 60 requests per IP and 30 per link per minute) |
| Reports | Filter contract; download retention |

Resolved since v1.0: invitee-already-owns-a-wedding acceptance (0012, N1); attendee-count
validation and token expiry and status semantics (0017); token and session lifetimes (0015);
invitation token storage, organizer reset to `PENDING`, immediate rejection and deleted
guests' links (0018); showing the link again after creation (0019).

## 36. Implementation order

Built: foundation (prefix, envelope, errors, validation, request IDs, guards); auth and
sessions; weddings and membership. Next: Phase 4 events, guests, RSVP and invitations. Then,
as approved: partner and sharing, notifications, expenses, tasks, vendors, website, gallery
and QR, live stream, reports, audit and operations.

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
