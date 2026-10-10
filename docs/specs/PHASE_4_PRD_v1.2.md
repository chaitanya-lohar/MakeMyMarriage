# MakeMyMarriage — Phase 4 PRD v1.2: events, guests, RSVP and invitations

| Item         | Value                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status       | **Canonical** for Phase 4. Approved scope; **not implemented**.                                                                                                                |
| Date         | 2026-10-10                                                                                                                                                                     |
| Parent       | [PRD v1.2](PRD_v1.2.md) (sections 9–13)                                                                                                                                        |
| Decision     | [0017](../decisions/0017-phase-4-guests-and-invitations.md) and [0018](../decisions/0018-invitation-token-storage-and-guest-access.md), with 0008 and 0010                     |
| Contracts    | [Database Design v1.1](DB_DESIGN_v1.1.md) §9–10, [API Design v1.1](API_DESIGN_v1.1.md) §8–10                                                                                   |
| Supersedes   | Phase 4 PRD v1.1 FINAL and the earlier v1.0 draft (archived)                                                                                                                   |
| Out of scope | Website records and public identifiers, partner connection and sharing, tasks, expenses, vendors, QR and gallery, live stream, reports, reminder scheduling, WhatsApp API, SMS |

| Version | Date       | Change                                                                                    |
| ------- | ---------- | ----------------------------------------------------------------------------------------- |
| 1.0     | 2026-10    | Draft (outside this repository).                                                          |
| 1.1     | 2026-10-10 | "Final" draft in the reconciled set.                                                      |
| 1.2     | 2026-10-10 | Corrected after the documentation audit and the product-owner answers Q2, Q3, Q6, Q7, Q8. |

## 1. Purpose and outcomes

Deliver the first usable guest workflow: organizers manage events and guests, assign guests
to specific events, send or share one secure invitation link per guest, and collect an
independent RSVP for every assigned event. Guests never create accounts.

Phase 4 replaces the earlier roadmap's separate phases for events, guests and RSVP, and
invitations (answer Q3).

## 2. Governing rules

- Signup creates only a user; wedding creation is separate and is not part of Phase 4.
- Phase 3 created no website record or public identifier, and Phase 4 creates none either.
- A user owns at most one wedding. A guest record belongs to exactly one wedding. Guest
  identity and event participation are separate.
- Guests have no account. Guest access uses a cryptographically secure, non-guessable
  token, stored as a hash and an encrypted copy, never in plain form and never logged
  (0018).
- Invitation delivery state, activity history and RSVP state are independent.
- WhatsApp sharing opens the user's own WhatsApp; no WhatsApp API. Copy Link is supported.
  The platform sends invitation emails through the email provider adapter (Resend).
- Every organizer endpoint checks the user's membership of the wedding; every query is
  scoped to the wedding. A client-supplied `weddingId` is never trusted on its own.
- No user-facing limit on the number of guests or on attendee counts.
- Until roles arrive (Phase 10) only `OWNER` members exist; owners can do everything in
  this phase.

## 3. Events

### 3.1 Fields

| Field         | Rule                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------ |
| Name          | Required; trimmed; 1–100 characters (**proposed**).                                        |
| Event type    | Required: `ENGAGEMENT`, `MEHENDI`, `HALDI`, `SANGEET`, `WEDDING`, `RECEPTION` or `CUSTOM`. |
| Date          | Required calendar date in the wedding's timezone. Past dates are valid.                    |
| Start time    | Optional, `HH:mm`, wedding timezone.                                                       |
| End time      | Optional, `HH:mm`; requires a start time and must be later on the same day.                |
| Description   | Optional; at most 1,000 characters (**proposed**).                                         |
| Venue name    | Optional; at most 120 characters (**proposed**).                                           |
| Venue address | Optional; at most 300 characters (**proposed**).                                           |
| Dress code    | Optional; at most 120 characters (**proposed**).                                           |
| Notes         | Optional; at most 1,000 characters (**proposed**); organizer-only.                         |

- Not in Phase 4: map location, cover image, `isPublic`, `instructions`, `publicId`
  (decision 0017 #15).
- Limits marked **proposed** follow the Phase 3 conventions (names 100, places 120, long
  text 1,000) and are not approved until confirmed (0018 #10). Validation, the API and the
  Phase 4 screens use them as written until then.
- The date and time convention is decision 0017 #17: a date-only event is stored without an
  invented time. Overnight events (end after midnight) are deferred.

### 3.2 Behaviour

- Create, list, view, update and soft-delete events.
- Lists sort by date, then start time; events without a start time come first on their day.
- Deleting an event removes it from active event lists, active assignments and all active
  counts. Its guest-event RSVP records and invitation delivery and activity history are
  kept; nothing related is hard-deleted.

## 4. Guests

| Field         | Rule                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------- |
| Name          | Required; trimmed; 1–100 characters.                                                                |
| Mobile number | Required; 7–15 digits; optional leading `+`; spaces and hyphens allowed; no country format.         |
| Email         | Optional; valid email address when given; at most 254 characters (**proposed**).                    |
| Relation      | Optional; at most 100 characters (**proposed**).                                                    |
| Notes         | Optional; at most 1,000 characters (**proposed**); organizer-only, never in guest-facing responses. |

- Mobile numbers are stored normalized (separators removed, leading `+` kept) and compared
  in that form for duplicate detection.
- A likely duplicate mobile number in the same wedding returns a warning with the matching
  guests; saving still succeeds, and guests are never merged automatically.
- Create, list, search (by name or mobile), view, update and soft-delete guests. Lists can
  be filtered by event and RSVP status.
- The guest name limit and the mobile rule are approved (Phase 4 PRD v1.1, 0017 #14); the
  limits marked **proposed** are not yet approved (0018 #10).
- Changing a guest's mobile or email keeps their invitation token (0018).
- **Deleting a guest revokes their invitation token** immediately; their assignments, RSVPs
  and invitation history are kept as soft-deleted history (0018).

## 5. Guest–event assignments

- A guest may be assigned to zero or more active events; at most one active assignment per
  guest and event. Assigning the same pair twice never creates a duplicate.
- A new assignment starts with RSVP `PENDING` and `attendeeCount: null`.
- Removing an assignment keeps it as history (decision 0017 #18); the guest can be assigned
  to that event again later.
- The guest's invitation covers their active assignments to active events.
- Guest and event IDs from another wedding can never be used to read or change records.

## 6. RSVP

| Status      | Meaning                  | `attendeeCount` |
| ----------- | ------------------------ | --------------- |
| `PENDING`   | No response yet.         | `null`          |
| `ATTENDING` | Accepts the invitation.  | integer ≥ 1     |
| `DECLINED`  | Declines the invitation. | `0`             |
| `MAYBE`     | Not yet confirming.      | `null`          |

- RSVP is per assignment: the same guest can attend Haldi with 4 and decline Sangeet.
- The count covers everyone in the RSVP, including the named guest. Companions are counted,
  not created as guests. No upper limit.
- Every RSVP write sends `rsvpStatus` and `attendeeCount` explicitly; mismatching
  combinations are rejected with `VALIDATION_FAILED`.
- A guest can never set an RSVP back to `PENDING`. Organizers can update RSVPs, including
  resetting one to `PENDING` (with `attendeeCount: null`); every organizer reset is
  recorded in the audit history (0018).
- Changing one RSVP never changes another RSVP or the invitation's delivery history.
- RSVPs never lock automatically at the event start.
- The responder and time are recorded (`respondedAt` for guests; `rsvpUpdatedBy` and
  `rsvpUpdatedAt` for organizers).

## 7. Invitations and secure access

### 7.1 Token rules

- One token per guest, created when the organizer starts the invitation or link flow
  (`POST …/invitation`), not when the guest is saved.
- High-entropy random token, stored as a hash (to verify guest requests) and an encrypted
  copy (decrypted by the server only to send and resend the email). The encryption key is
  held outside the database in the platform's secret manager and can be rotated. No form
  of the token is ever logged (0018).
- The same token is reused for resends and when the guest's contact details change.
- Regenerate, revoke and guest deletion invalidate the previous token immediately; only the
  current token works.
- No automatic expiry in Phase 4. Accepted trade-off: an unrevoked link stays usable,
  including by anyone it is forwarded to.
- Guest token endpoints are rate-limited and return the same safe error for unknown,
  revoked or regenerated tokens, revealing nothing about other guests or internal IDs.
- **Open (0018):** whether an organizer can see the link again after creating it, for Copy
  Link or WhatsApp, without regenerating. Until decided, the link is shown in the create
  and regenerate responses.

### 7.2 Guest view and sharing

- The guest sees the couple's display name, wedding date, and only their own active events
  (name, type, date, times, venue, dress code, description) with an RSVP control per event.
  Organizer notes, the guest's mobile and email, other guests, and wedding or event IDs are
  never included; only the guest's own assignment IDs are returned, for the RSVP request.
- Copy Link copies the secure invitation URL, from the create or regenerate response.
- WhatsApp opens the user's own share flow with a prefilled message and that link.
- Email is sent by the platform through the worker (BullMQ) and the email adapter. Sending
  needs the guest's email address.

### 7.3 Delivery state and activity

| Concept                 | Values                                      | Rules                                                                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current delivery status | `DRAFT`, `SENT`, `DELIVERED`, `FAILED`      | `DRAFT` when created. `SENT` when the provider accepts a send; `FAILED` when it rejects the request immediately (0018). Follows the latest attempt. `DELIVERED`, and failures reported after acceptance, only from provider webhooks (not in Phase 4). |
| Activity history        | Timestamped events: sent, resent, opened    | Opens never overwrite the delivery status. The first-open time is kept. Whether repeated opens are all stored or de-duplicated is an implementation choice.                                                                                            |
| RSVP status             | `PENDING`, `ATTENDING`, `DECLINED`, `MAYBE` | Per assignment; never inferred from delivery or opens.                                                                                                                                                                                                 |

- Every send and resend attempt is stored with its provider message ID when available.
- Resending never creates duplicate guests or assignments; sends are idempotent jobs.
- **Phase 4 shows `SENT` as the highest delivery status.** It never claims delivery the
  provider has not confirmed.
- An immediate provider rejection marks that send attempt `FAILED`, with the provider's
  reason (0018). Send-attempt history stays separate from RSVP state.
- Deleting an event never changes delivery status or erases send and open history.

## 8. Authorization and data integrity

- Every organizer endpoint resolves an `ACTIVE` membership for the wedding first; anything
  else is `404` (as `WEDDING_NOT_FOUND` in Phase 3).
- Guest token endpoints are the only account-free exception and see only the token's guest
  and wedding.
- One active assignment per (wedding, guest, event), enforced by a partial unique index.
- Server-side DTO validation; client-side validation is supplementary.
- Soft deletion keeps history; active queries exclude deleted events, guests and removed
  assignments.

## 9. API

Routes are fixed by decision 0017 #16. Full contracts — payloads, status codes, errors —
are in API Design v1.1 §8–10:

- Events: `GET/POST /api/v1/weddings/{weddingId}/events`,
  `GET/PATCH/DELETE …/events/{eventId}`.
- Guests: `GET/POST …/guests`, `GET/PATCH/DELETE …/guests/{guestId}`.
- Assignments: `GET/POST …/guests/{guestId}/events`, `PATCH/DELETE …/guest-events/{guestEventId}`.
- Invitations: `POST …/guests/{guestId}/invitation`, `…/regenerate`, `…/send`, `…/resend`,
  `…/revoke`; `GET …/invitation/deliveries`.
- Guest: `GET /api/v1/guest/invitations/{token}`, `PATCH /api/v1/guest/invitations/{token}/rsvp`.

## 10. UI

- New screens are designed in Google Stitch and approved before they are built (working
  rule). None exist yet for Phase 4.
- Screens show only the approved fields and actions, each with loading, empty, validation,
  error and success states.
- Navigation adds Events and Guests & RSVP; the dashboard adds event and guest summaries
  only for data that exists.

## 11. Acceptance criteria

1. An owner can create, edit, list and soft-delete events with the Phase 4 fields; past
   dates and events without times are accepted; an end time without a start time, or before
   it, is rejected.
2. An owner can create, update, list, filter and search guests with the approved fields and
   validation; a mobile number outside the rule is rejected.
3. A likely duplicate mobile (after normalization) returns a warning; the guest is saved and
   nothing is merged.
4. A guest can be assigned to several events; assigning the same pair twice returns the
   existing active assignment instead of creating a second; a removed assignment keeps its
   history.
5. Each assignment's RSVP is independent and accepts only the four status/count
   combinations; every other combination returns `VALIDATION_FAILED`.
6. A guest cannot return an RSVP to `PENDING`; an organizer can, and the reset appears in
   the audit history.
7. The token is created only when the invitation flow starts; it is stored only as a hash
   and an encrypted copy, whose key is not in the database; no form of it appears in logs;
   resends and contact changes reuse it.
8. After regeneration, revocation or deletion of the guest, the old token cannot view the
   invitation or submit an RSVP.
9. A guest sees only their own active events, never organizer notes or other guests, and can
   RSVP per event without an account.
10. Copy Link and WhatsApp sharing of the link from the create or regenerate response work
    without a WhatsApp API.
11. Each send and resend is recorded; the status becomes `SENT` on provider acceptance,
    `FAILED` on an immediate rejection, and never `DELIVERED` without provider confirmation;
    opens are stored as activity without changing the status.
12. Resending never creates duplicate guests or assignments.
13. Deleting an event removes it from active views and counts and keeps its RSVP and
    invitation history unchanged.
14. Cross-wedding IDs fail with `404`; token endpoints are rate-limited.
15. Unit, integration, contract and security tests cover the above, including token
    guessing, rate limiting and tenant isolation.

## 12. Deferred or open

- Token expiry: none in Phase 4; revisit only by decision.
- Delivery webhooks (`DELIVERED`, later `FAILED`); provider retry and backoff details.
- Showing the invitation link again after creation (0018, Open).
- Confirmation of the limits marked proposed (0018 #10).
- Retention periods for audit and delivery history.
- De-duplication of repeated opens (first open always kept).
- Overnight events; locale-specific phone formatting.
- Partner sharing and organizer roles beyond `OWNER`.
- Website and public identifiers, reminder cadence, WhatsApp API, SMS.

## 13. Definition of done

- Code, database and API match this PRD, decision 0017, Database Design v1.1 and API Design
  v1.1, all under `/api/v1`.
- Automated tests pass for behaviour, authorization, tenant isolation and invitation tokens.
- The UI implements only approved fields and states, from approved Stitch screens.
- `PROJECT_STATUS.md` and the documentation index are updated when the phase is merged.
