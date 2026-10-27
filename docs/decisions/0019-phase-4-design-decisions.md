# 0019 — Phase 4 design decisions

**Status:** Accepted (approved by the product owner on 2026-10-10, answers Q1–Q6 of the
Phase 4 readiness check). Amends [0017](0017-phase-4-guests-and-invitations.md) #16 (adds a
route) and closes the open item in [0018](0018-invitation-token-storage-and-guest-access.md).
Q1 #1 (who may retrieve the link) amended by [0034](0034-phase-10-authorization.md) on
2026-10-27.

## Decisions

### Q1 — Showing the invitation link again

1. Add an organizer-only route that returns the guest's **current** invitation link:
   `GET /api/v1/weddings/{weddingId}/guests/{guestId}/invitation/link`.
   - It returns the existing link; it never creates a token. The server decrypts the stored
     encrypted copy (0018).
   - The usual wedding-membership check applies (organizer authorization). **Amended by
     [0034](0034-phase-10-authorization.md):** from Phase 10 it needs `INVITATIONS:SEND`,
     which is owner-only by default and can be granted by override (P10-6).
   - Every retrieval is recorded in the audit history.
   - The token never appears in application logs.
2. Copy Link and WhatsApp sharing **reuse the existing link**. Only regeneration replaces it;
   retrieving or sharing it never does.

### Q2 — Where invitations are managed

3. Invitations are managed on each **guest's detail screen**. Phase 4 adds no "Invitation"
   navigation item and no separate invitation workspace.
4. The guest detail screen offers create invitation, Copy Link, WhatsApp, send, resend,
   regenerate and revoke, showing **only the actions that fit the invitation's current
   state**.

### Q3 — Dashboard summaries

5. Phase 4 adds four dashboard summaries: **upcoming events**, **guest totals**, **RSVP
   breakdown** and **expected attendees**, calculated only from existing data. Their exact
   calculation rules are in [Phase 4 PRD v1.2](../specs/PHASE_4_PRD_v1.2.md) §10.2; the
   product owner approved them as written (2026-10-10): every summary counts only active
   records; the RSVP breakdown covers past and future events; expected attendees are shown
   per event only, with no wedding-wide total; guest totals include guests not yet assigned
   to an event.

### Q4 — Field limits

6. The limits marked "proposed" in 0018 #10 are **approved**: event name 100, event
   description 1,000, venue name 120, venue address 300, dress code 120, event notes 1,000,
   guest email 254, relation 100, guest notes 1,000 (characters). They apply to server
   validation, the API and the designs; required/optional rules are unchanged, and they do
   not replace the email and mobile format checks.

### Q5 — User-facing copy

7. No Phase 4 wording is approved yet. The following are drafted in Stitch and approved at
   design review: the invitation email subject and body, the WhatsApp prefilled message, the
   duplicate-mobile warning, the guest confirmation message, the invalid or revoked link
   message, and the no-events message. Wording is clear, respectful and suited to Indian
   wedding invitations, and never implies that an email was delivered or an RSVP saved
   unless that operation succeeded.
8. Invitation status labels on organizer screens: **None** (no invitation yet), **Draft**,
   **Sent**, **Failed** — the email delivery state — and **Revoked**, shown as the link's
   availability, not as a delivery result. **Delivered is never shown in Phase 4.**

### Q6 — Confirmations

9. These actions ask for confirmation and do nothing until the user confirms:

   | Action                       | The confirmation explains                                                   |
   | ---------------------------- | --------------------------------------------------------------------------- |
   | Delete an event              | It leaves active use; its history (RSVPs, invitation records) is kept.      |
   | Delete a guest               | It leaves active use; history is kept; their invitation link stops working. |
   | Remove a guest from an event | The assignment leaves active use; its RSVP history is kept.                 |
   | Regenerate the link          | The old link stops working; the new link must be shared again.              |
   | Revoke the link              | The current link stops working; no replacement is created.                  |

## Superseded statements

| Source               | Statement                                                  | Resolution                                      |
| -------------------- | ---------------------------------------------------------- | ----------------------------------------------- |
| 0017 #16             | Invitation route list without a link-retrieval route       | Adds `GET …/invitation/link` (decision 1).      |
| 0018, Open           | Whether an organizer can see the link again after creation | Yes, through the new route (decisions 1–2).     |
| 0018 #3              | Only create and regenerate return the link                 | The link route also returns it (decision 1).    |
| 0018 #10             | Nine limits labelled "proposed"                            | Approved (decision 6).                          |
| PRD v1.2 §29         | "Invitation" listed as a workspace navigation item         | Not in Phase 4 (decision 3).                    |
| Phase 4 PRD v1.2 §10 | "Dashboard adds event and guest summaries" (unspecified)   | Four summaries with defined rules (decision 5). |
