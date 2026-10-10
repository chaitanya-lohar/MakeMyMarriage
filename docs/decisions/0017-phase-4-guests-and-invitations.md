# 0017 — Phase 4: events, guests, RSVP and invitations

**Status:** Accepted. **Amended by [0018](0018-invitation-token-storage-and-guest-access.md)
(2026-10-10):** token storage (hash plus encrypted copy, replacing #6's hash-only rule),
organizer reset to `PENDING`, immediate provider rejection, and deleted guests' links.
**Amended by [0019](0019-phase-4-design-decisions.md) (2026-10-10):** adds the route
`GET …/guests/{guestId}/invitation/link` to #16.

## History

| Date       | Event                                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-10 | Drafted as "ADR-0017" with the reconciled documentation set (original kept in `docs/archive/specs/reconciled-2026-10-10/`). Its "Approved" label was not yet backed by a recorded approval. |
| 2026-10-10 | Reviewed in the documentation audit, then **approved by the product owner** with the clarifications below (answers Q2, Q3, Q6, Q7 and Q8).                                                  |

## Scope

Phase 4 combines events, guests and RSVP, and invitations into one phase (answer Q3). The
requirements and acceptance criteria are in the
[Phase 4 PRD v1.2](../specs/PHASE_4_PRD_v1.2.md).

## Decisions

### RSVP (Q2.1, Q8a)

1. RSVP belongs to the guest–event assignment (`GuestEvent`), never to the guest.
2. `attendeeCount` must match the status:

   | Status      | `attendeeCount` |
   | ----------- | --------------- |
   | `PENDING`   | `null`          |
   | `MAYBE`     | `null`          |
   | `DECLINED`  | `0`             |
   | `ATTENDING` | integer ≥ 1     |

   The count includes the named guest. There is no user-facing upper limit.

3. Every RSVP write sends both `rsvpStatus` and `attendeeCount` explicitly (`null` or `0`
   where the table says so). The server rejects any other combination with
   `VALIDATION_FAILED`; it never fills values in silently.
4. A guest cannot change an RSVP back to `PENDING` after responding. They may change it to
   any other response.
5. RSVPs do not lock automatically when an event starts (Q2.7).

### Invitations (Q2.2–Q2.4, Q8d)

6. One invitation token per guest covers all of the guest's active event assignments. It is
   created when the organizer starts the invitation or link flow, never merely because a
   guest is saved. Only its hash is stored; the raw token and the hash are never logged.
   _(Storage amended by 0018: hash plus an encrypted copy.)_
7. Regenerating or revoking a token invalidates the previous one immediately.
8. **No automatic token expiry in Phase 4.** The organizer can revoke or regenerate a token
   at any time. **Security trade-off, accepted:** a link that is not revoked stays usable
   indefinitely, so anyone the guest forwards it to can view the guest's invitation and
   change the guest's RSVPs until it is revoked.
9. Delivery status is `DRAFT`, `SENT`, `DELIVERED` or `FAILED`. **Opens are recorded as
   activity history**, never as a delivery status, and the first-open time is preserved.
   Delivery state, activity history and RSVP state stay separate.
10. `SENT` means the email provider accepted the send request. `DELIVERED` and `FAILED`
    require provider confirmation (delivery webhooks). Until webhooks are implemented and
    approved, `SENT` is the highest status the application shows; it never marks a message
    delivered because the provider accepted it.
11. Each send and resend attempt is kept in the invitation's delivery history. Resending
    never creates duplicate guests or assignments.

### Events and guests (Q2.5, Q2.6, Q7, Q8b)

12. Deleting an event removes it from active lists and counts and preserves its RSVP history
    and invitation delivery history. Retained records stay consistent with the event they
    belong to.
13. A likely duplicate mobile number within the same wedding shows a warning but does not
    block saving, and guest records are never merged automatically.
14. Mobile numbers: 7–15 digits, an optional leading `+`, spaces and hyphens allowed as
    separators, no country-specific format. The value is normalized (separators removed)
    before duplicate detection. This checks the format only; it does not verify the number.
15. Phase 4 event fields: name, event type (`ENGAGEMENT`, `MEHENDI`, `HALDI`, `SANGEET`,
    `WEDDING`, `RECEPTION`, `CUSTOM`), date, and optional description, start time, end time,
    venue name and address, dress code and notes. Later phases add `isPublic`, cover image,
    map location, `instructions` and `publicId` (0010 #10 still lists them as approved
    fields; they are not built in Phase 4).

### Routes (Q6)

16. Invitation token management is separate from sending email. All routes are under
    `/api/v1`; invitation routes are keyed by guest, never by guest-event.

    | Route                                                               | Purpose                                    |
    | ------------------------------------------------------------------- | ------------------------------------------ |
    | `POST /weddings/{weddingId}/guests/{guestId}/invitation`            | Create the invitation and its first token  |
    | `POST /weddings/{weddingId}/guests/{guestId}/invitation/regenerate` | New token; the previous one stops working  |
    | `POST /weddings/{weddingId}/guests/{guestId}/invitation/send`       | Send the invitation email                  |
    | `POST /weddings/{weddingId}/guests/{guestId}/invitation/resend`     | Send it again                              |
    | `POST /weddings/{weddingId}/guests/{guestId}/invitation/revoke`     | Revoke the token                           |
    | `GET /weddings/{weddingId}/guests/{guestId}/invitation/deliveries`  | Delivery history and activity history      |
    | `POST /weddings/{weddingId}/guests/{guestId}/events`                | Assign the guest to an event               |
    | `PATCH /weddings/{weddingId}/guest-events/{guestEventId}`           | Organizer RSVP update                      |
    | `DELETE /weddings/{weddingId}/guest-events/{guestEventId}`          | Remove the assignment, keeping its history |
    | `GET /guest/invitations/{token}`                                    | Guest view of the invitation               |
    | `PATCH /guest/invitations/{token}/rsvp`                             | Guest submits or updates RSVPs             |

    Payloads, status codes and errors are defined in [API Design v1.1](../specs/API_DESIGN_v1.1.md).

### Technical conventions recorded with this decision

These implement the approved behaviour; they are engineering choices, listed so they can be
reviewed.

17. **Event date and time.** An event stores a required calendar `date` (`YYYY-MM-DD`) and
    optional `startTime` and `endTime` (`HH:mm`), all in the wedding's timezone. An end time
    requires a start time and must be later on the same day; overnight events are deferred.
    This replaces Database Design v1.0's required `startDateTime`, so a date-only event is
    never stored with an invented time. Events sort by date, then start time, with untimed
    events first.
18. **Removing an assignment.** `DELETE …/guest-events/{id}` marks the assignment removed
    (`removedAt`) instead of deleting it, so its RSVP history survives. At most one active
    assignment exists per guest and event; re-assigning after removal creates a new active
    assignment.

## Open — not decided by this record

- _Decided by 0018 (option a):_ **How the raw invitation link is available after creation.** Decision 6 stores only the
  hash, so the link exists only in the create and regenerate responses, while Copy Link,
  WhatsApp sharing and email send/resend need it later. Options: (a) also store the token
  encrypted, recoverable by the server; (b) a new token on every send, resend or copy;
  (c) show it once and require regenerate. **Blocks Phase 4 implementation.**
- _Decided by 0018 (allowed, audited):_ Whether an **organizer** may set an RSVP back to `PENDING` (Q8a covers guests only).
- _Decided by 0018 (the attempt is `FAILED`):_ Whether a provider's **immediate rejection** of a send request may set `FAILED` before
  webhooks exist (Q8d groups `FAILED` with webhook confirmation).
- _Decided by 0018 (revoked):_ What happens to a **deleted guest's** invitation link (recommended: it stops working, as
  for a revoked token).

## Superseded statements

| Source                               | Statement                                                            | Resolution                                                                   |
| ------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Decision 0008 (C3)                   | `GuestInvitation` statuses `DRAFT, SENT, DELIVERED, OPENED, FAILED`  | `OPENED` becomes activity history (decision 9). 0008 is otherwise unchanged. |
| PRD v1.1 §12; System Design v1.2 §10 | "Opened — Guest opened" as an invitation state                       | Activity history.                                                            |
| Database Design v1.0 §9              | `startDateTime: Date` (required), `endDateTime?`                     | `date`, `startTime?`, `endTime?` (decision 17).                              |
| Database Design v1.0 §10.3           | `guest_invitations.expiresAt: Date` (required)                       | No automatic expiry (decision 8).                                            |
| API Design v1.0 §10                  | Invitation routes under `guest-events/{guestEventId}/invitation`     | Keyed by guest (decision 16).                                                |
| API Design v1.0 §35                  | Open: attendee-count validation; token expiry and status transitions | Decided here (decisions 2–4, 8–10).                                          |
| PROJECT_STATUS roadmap               | Phases 4 Events, 5 Guests and RSVP, 6 Invitations                    | One Phase 4 (answer Q3).                                                     |
| Phase 4 PRD v1.1 §8 (reconciled set) | Send, resend and deliveries keyed by `{guestEventId}`                | Keyed by guest (decision 16).                                                |
