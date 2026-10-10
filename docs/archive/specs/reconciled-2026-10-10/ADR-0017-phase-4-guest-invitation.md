# Decision Record 0017 — Phase 4 Guest & Invitation Contract

**Status:** Approved baseline incorporated into Phase 4 PRD v1.1  
**Date:** 2026-10-10

## Decisions
1. RSVP remains per GuestEvent; attendeeCount is nullable.
2. ATTENDING requires integer attendeeCount >= 1; count includes the named guest. DECLINED stores 0; PENDING and MAYBE store null. No user-facing upper limit.
3. One invitation token per guest, created when organizer initiates invitation/link flow. Store only tokenHash; regeneration/revocation invalidates the previous token. No automatic expiry in Phase 4.
4. Delivery state is DRAFT, SENT, DELIVERED or FAILED. Opens are timestamped activity history and do not overwrite delivery state.
5. Event deletion removes the event from active views/counts but preserves historical GuestEvent RSVP records and does not alter invitation delivery history.
6. Likely duplicate mobile numbers warn but do not block save or silently merge.
7. No automatic RSVP lock at event start.
8. Routes use `/api/v1/...`.
9. Phase 3 does not create a WeddingWebsite record/public identifier; reminder schedules and search indexing remain deferred.

## Supersedes
Any earlier Phase 4 draft wording that conflicts with these rules. The master PRD, architecture, DB and API reconciliations must stay aligned with this record.
