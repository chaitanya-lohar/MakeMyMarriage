# 0008 — Guest invitation model

**Status:** Accepted (includes resolution C3). Supersedes Database Design v1.0 §10 and
System Design v1.2 §9 where they differ. **Amended by [0017](0017-phase-4-guests-and-invitations.md)
(2026-10-10):** `OPENED` is no longer a status — opens are activity history — and the
statuses are `DRAFT`, `SENT`, `DELIVERED`, `FAILED`. Everything else below stands.

## Decision

One secure, non-guessable invitation token **per guest**. The invitation covers all of
the guest's applicable events. RSVP remains **per event** (`GuestEvent`).

```text
Guest
 └── GuestInvitation            one token per guest; owns the invitation lifecycle status
       └── InvitationDeliveries

Guest
 ├── GuestEvent → Event A → RSVP
 ├── GuestEvent → Event B → RSVP
 └── GuestEvent → Event C → RSVP
```

Do not revert to one invitation token per guest-event.

### Invitation status (C3)

The invitation lifecycle status belongs to `GuestInvitation`, not to `GuestEvent`:

| Record            | Holds                        | Status values                                    |
| ----------------- | ---------------------------- | ------------------------------------------------ |
| `GuestInvitation` | Invitation lifecycle         | `DRAFT`, `SENT`, `DELIVERED`, `OPENED`, `FAILED` |
| `GuestEvent`      | Event participation and RSVP | `PENDING`, `ATTENDING`, `DECLINED`, `MAYBE`      |

There is no per-`GuestEvent` invitation status.

## Superseded statements

| Source                        | Statement                                                                 | Resolution                                   |
| ----------------------------- | ------------------------------------------------------------------------- | -------------------------------------------- |
| Database Design v1.0 §10.2    | `guest_events.invitationStatus // DRAFT, SENT, DELIVERED, OPENED, FAILED` | Moved to `GuestInvitation` (C3).             |
| Database Design v1.0 §10.3    | `guest_invitations` keyed by `guestEventId`                               | Keyed by guest.                              |
| Database Design v1.0 §10.4    | `invitation_deliveries` keyed by `guestEventId`                           | Belongs to the guest invitation.             |
| Database Design v1.0 §20, §26 | Indexes/access patterns on `invitation_deliveries.guestEventId`           | Follow the guest invitation instead.         |
| System Design v1.2 §9         | `GuestEvent ├─ Invitation state`                                          | Invitation state is on the guest invitation. |

Unchanged: only a token hash is stored, never the raw token (Database Design §10.3);
regeneration revokes the previous token; RSVP states and `attendeeCount` (0010 #1) stay
on `GuestEvent`.
