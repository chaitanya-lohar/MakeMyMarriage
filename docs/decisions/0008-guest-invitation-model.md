# 0008 — Guest invitation model

**Status:** Accepted. Supersedes Database Design v1.0 §10.3–10.4 where they differ.

## Decision

One secure, non-guessable invitation token **per guest**. The invitation covers all of
the guest's applicable events. RSVP remains **per event** (`GuestEvent`).

```text
Guest
 └── GuestInvitation            one token per guest
       └── InvitationDeliveries

Guest
 ├── GuestEvent → Event A → RSVP
 ├── GuestEvent → Event B → RSVP
 └── GuestEvent → Event C → RSVP
```

Do not revert to one invitation token per guest-event.

## Superseded statements (Database Design v1.0)

| Section | Statement                                       | Resolution                       |
| ------- | ----------------------------------------------- | -------------------------------- |
| §10.3   | `guest_invitations` keyed by `guestEventId`     | Keyed by guest.                  |
| §10.4   | `invitation_deliveries` keyed by `guestEventId` | Belongs to the guest invitation. |

Unchanged: only a token hash is stored, never the raw token (Database Design §10.3);
regeneration revokes the previous token.

## Open for the Invitations module

`guest_events.invitationStatus` (Database Design §10.2) is per event, while the
invitation is now per guest. Whether that field stays, moves or is derived must be
decided with the conflict protocol in 0004 before the Invitations module is built.
