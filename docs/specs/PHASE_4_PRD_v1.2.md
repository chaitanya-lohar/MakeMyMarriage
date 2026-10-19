# MakeMyMarriage — Phase 4 PRD v1.2: events, guests, RSVP and invitations

| Item         | Value                                                                                                                                                                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status       | **Canonical** for Phase 4. Approved scope; **implemented** (merged in PR #12).                                                                                                                                                                                                     |
| Date         | 2026-10-10                                                                                                                                                                                                                                                                         |
| Parent       | [PRD v1.2](PRD_v1.2.md) (sections 9–13)                                                                                                                                                                                                                                            |
| Decision     | [0017](../decisions/0017-phase-4-guests-and-invitations.md), [0018](../decisions/0018-invitation-token-storage-and-guest-access.md) and [0019](../decisions/0019-phase-4-design-decisions.md) and [0020](../decisions/0020-email-status-after-regeneration.md), with 0008 and 0010 |
| Contracts    | [Database Design v1.1](DB_DESIGN_v1.1.md) §9–10, [API Design v1.1](API_DESIGN_v1.1.md) §8–10                                                                                                                                                                                       |
| Supersedes   | Phase 4 PRD v1.1 FINAL and the earlier v1.0 draft (archived)                                                                                                                                                                                                                       |
| Out of scope | Website records and public identifiers, partner connection and sharing, tasks, expenses, vendors, QR and gallery, live stream, reports, reminder scheduling, WhatsApp API, SMS                                                                                                     |

| Version | Date       | Change                                                                                    |
| ------- | ---------- | ----------------------------------------------------------------------------------------- |
| 1.0     | 2026-10    | Draft (outside this repository).                                                          |
| 1.1     | 2026-10-10 | "Final" draft in the reconciled set.                                                      |
| 1.2     | 2026-10-10 | Corrected after the documentation audit and the product-owner answers Q2, Q3, Q6, Q7, Q8. |
| 1.2     | 2026-10-14 | Decision 0025: emails sent during the request; no worker and no automatic retry.          |

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
| Name          | Required; trimmed; 1–100 characters.                                                       |
| Event type    | Required: `ENGAGEMENT`, `MEHENDI`, `HALDI`, `SANGEET`, `WEDDING`, `RECEPTION` or `CUSTOM`. |
| Date          | Required calendar date in the wedding's timezone. Past dates are valid.                    |
| Start time    | Optional, `HH:mm`, wedding timezone.                                                       |
| End time      | Optional, `HH:mm`; requires a start time and must be later on the same day.                |
| Description   | Optional; at most 1,000 characters.                                                        |
| Venue name    | Optional; at most 120 characters.                                                          |
| Venue address | Optional; at most 300 characters.                                                          |
| Dress code    | Optional; at most 120 characters.                                                          |
| Notes         | Optional; at most 1,000 characters; organizer-only.                                        |

- Not in Phase 4: map location, cover image, `isPublic`, `instructions`, `publicId`
  (decision 0017 #15).
- All limits are approved (0019 #6) and apply to server validation, the API and the
  designs.
- The date and time convention is decision 0017 #17: a date-only event is stored without an
  invented time. Overnight events (end after midnight) are deferred.

### 3.2 Behaviour

- Create, list, view, update and soft-delete events.
- Lists sort by date, then start time; events without a start time come first on their day.
- Deleting an event removes it from active event lists, active assignments and all active
  counts. Its guest-event RSVP records and invitation delivery and activity history are
  kept; nothing related is hard-deleted. Since Phase 7, its tasks become whole-wedding tasks
  (0026 #12).

## 4. Guests

| Field         | Rule                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------- |
| Name          | Required; trimmed; 1–100 characters.                                                        |
| Mobile number | Required; 7–15 digits; optional leading `+`; spaces and hyphens allowed; no country format. |
| Email         | Optional; valid email address when given; at most 254 characters.                           |
| Relation      | Optional; at most 100 characters.                                                           |
| Notes         | Optional; at most 1,000 characters; organizer-only, never in guest-facing responses.        |

- Mobile numbers are stored normalized (separators removed, leading `+` kept) and compared
  in that form for duplicate detection.
- A likely duplicate mobile number in the same wedding returns a warning with the matching
  guests; saving still succeeds, and guests are never merged automatically.
- Create, list, search (by name or mobile), view, update and soft-delete guests. Lists can
  be filtered by event and RSVP status.
- All limits are approved (Phase 4 PRD v1.1, 0017 #14, 0019 #6). Character limits do not
  replace the email and mobile format checks.
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
- Guest token endpoints are rate-limited (120 requests a minute per IP, 60 per link — 0023)
  and return the same safe error for unknown,
  revoked or regenerated tokens, revealing nothing about other guests or internal IDs.
- Organizers can retrieve the **current** link at any time
  (`GET …/guests/{guestId}/invitation/link`, 0019). Retrieval never creates a token; it is
  recorded in the audit history and the token never appears in logs.

### 7.2 Guest view and sharing

- The guest sees the couple's display name, wedding date, and only their own active events
  (name, type, date, times, venue, dress code, description) with an RSVP control per event.
  Organizer notes, the guest's mobile and email, other guests, and wedding or event IDs are
  never included; only the guest's own assignment IDs are returned, for the RSVP request.
- Copy Link copies the guest's current invitation link; WhatsApp opens the user's own share
  flow with a prefilled message and that link. Both reuse the existing link; only
  Regenerate replaces it (0019).
- Email is sent by the platform through the email adapter, during the send request (0025).
  Sending needs the guest's email address.

### 7.3 Delivery state and activity

| Concept                 | Values                                      | Rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current delivery status | `DRAFT`, `SENT`, `DELIVERED`, `FAILED`      | `DRAFT` when created and again whenever the link is regenerated (0020). `SENT` when the provider accepts a send; `FAILED` when it rejects the request (0018), or when it cannot be reached ("The email service could not be reached."); there is no automatic retry, and the organizer resends (0025). Otherwise follows the latest attempt; revoking never changes it. An email carries the link current when it is sent; if the link changes while it is being sent, the attempt is recorded but the status is left as it is, so a regenerated link stays `DRAFT` (0020). `DELIVERED`, and failures reported after acceptance, only from provider webhooks (not in Phase 4). |
| Activity history        | Timestamped events: sent, resent, opened    | Opens never overwrite the delivery status. The first-open time is kept. Every open is stored (0023).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| RSVP status             | `PENDING`, `ATTENDING`, `DECLINED`, `MAYBE` | Per assignment; never inferred from delivery or opens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

- Every send and resend attempt is stored with its provider message ID when available.
  History is never rewritten: regenerating, revoking or a failed resend leaves earlier
  attempts and their results unchanged (0020).
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
  `…/revoke`; `GET …/invitation/link`, `GET …/invitation/deliveries`.
- Guest: `GET /api/v1/guest/invitations/{token}`, `PATCH /api/v1/guest/invitations/{token}/rsvp`.
- Dashboard: `GET /api/v1/weddings/{weddingId}/dashboard` (0022; contract in API Design
  v1.1 §6).

## 10. UI

Decisions 0019 and 0021.

### 10.1 Screens and behaviour

- The approved Stitch screens and the corrections applied in code are listed in decision 0021. Only those screen IDs are used.
- Screens show only the approved fields and actions, each with loading, empty, validation,
  error and success states, on desktop and mobile.
- Navigation adds **Events** and **Guests & RSVP** only. There is no "Invitation" navigation
  item and no separate invitation workspace.
- **Invitations are managed on the guest's detail screen**, which offers only the actions
  that fit the invitation's current state:

  | Invitation state      | Actions offered                                                                |
  | --------------------- | ------------------------------------------------------------------------------ |
  | None (no invitation)  | Create invitation                                                              |
  | Draft, Sent or Failed | Copy Link, WhatsApp, Send (Draft) or Resend (Sent, Failed), Regenerate, Revoke |
  | Revoked               | Regenerate (creates a new link; email status becomes Draft — 0020)             |

  Send and Resend also need the guest's email address.

- **Status labels:** None, Draft, Sent, Failed — the email delivery state — and Revoked,
  shown as the link's availability rather than a delivery result. Delivered is never shown
  in Phase 4.
- **Confirmations.** These actions do nothing until the user confirms, and the confirmation
  explains the consequence:

  | Action                       | The confirmation explains                                                   |
  | ---------------------------- | --------------------------------------------------------------------------- |
  | Delete an event              | It leaves active use; its history (RSVPs, invitation records) is kept.      |
  | Delete a guest               | It leaves active use; history is kept; their invitation link stops working. |
  | Remove a guest from an event | The assignment leaves active use; its RSVP history is kept.                 |
  | Regenerate the link          | The old link stops working; the new link must be shared again.              |
  | Revoke the link              | The current link stops working; no replacement is created.                  |

- **Wording** is drafted on the copy-drafts screen and recorded in decision 0021 as a
  draft; it awaits product-owner approval (0019 #7). It never says an email was delivered or
  an RSVP saved unless that operation succeeded.
- **Invitation email with missing details** (0021): a missing wedding date or city is left
  out, with no empty labels or invented details; the couple's names and the link are always
  included.

### 10.2 Dashboard summaries

Decision 0019 #5 adds four summaries, calculated only from existing data. The product owner
approved these rules on 2026-10-10, as written:

- **Counted records.** An event counts if it is not deleted. A guest counts if not deleted.
  An assignment counts if it is active and both its event and its guest count. Deleted
  events and guests and removed assignments are excluded from every summary but kept as
  history.
- **Upcoming events:** counted events whose date is today or later in the wedding's
  timezone, in date and start-time order (untimed first on their day). The rule is date
  only: an event dated today stays upcoming after its start or end time has passed (0022).
  The dashboard shows at most five, the first five in that order; the dashboard API returns
  only those five (0021, 0022). Events are not limited anywhere else, and there is no
  "View all" or pagination.
- **Guest totals:** the number of counted guests, including guests not yet assigned to any
  event.
- **RSVP breakdown:** the number of counted assignments in each status — Pending,
  Attending, Declined and Maybe — across all counted events, past and future. A guest invited
  to three events counts three times, once per event.
- **Expected attendees:** for each upcoming event shown on the dashboard (the same up to
  five — 0022), the sum of `attendeeCount` over its counted Attending assignments.
  Declined (0), Pending and Maybe (no count) add nothing.
- **Per event only.** There is no wedding-wide "expected attendees" total: it would count the
  same person once for every event they attend, so it would mislead as a count of people.

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
10. Copy Link and WhatsApp reuse the guest's current link, retrieved without creating a
    token and recorded in the audit history; neither needs a WhatsApp API.
11. Each send and resend is recorded; the status becomes `SENT` on provider acceptance,
    `FAILED` on an immediate rejection, and never `DELIVERED` without provider confirmation;
    opens are stored as activity without changing the status.
12. Resending never creates duplicate guests or assignments.
13. Deleting an event removes it from active views and counts and keeps its RSVP and
    invitation history unchanged.
14. Cross-wedding IDs fail with `404`; token endpoints are rate-limited.
15. Invitations are managed on the guest detail screen with only state-appropriate actions;
    the five destructive actions ask for confirmation first.
16. The dashboard shows the four summaries using the §10.2 rules; deleted and removed
    records are excluded.
17. Unit, integration, contract and security tests cover the above, including token
    guessing, rate limiting and tenant isolation.

## 12. Deferred or open

- Token expiry: none in Phase 4; revisit only by decision.
- Wording drafted in Stitch, awaiting product-owner approval (0019 #7, 0021).
- Delivery webhooks (`DELIVERED`, later `FAILED`).

- Retention periods for audit and delivery history.
- Overnight events; locale-specific phone formatting.
- Partner sharing and organizer roles beyond `OWNER`.
- Website and public identifiers, reminder cadence, WhatsApp API, SMS.

## 13. Definition of done

- Code, database and API match this PRD, decision 0017, Database Design v1.1 and API Design
  v1.1, all under `/api/v1`.
- Automated tests pass for behaviour, authorization, tenant isolation and invitation tokens.
- The UI implements only approved fields and states, from approved Stitch screens.
- `PROJECT_STATUS.md` and the documentation index are updated when the phase is merged.
