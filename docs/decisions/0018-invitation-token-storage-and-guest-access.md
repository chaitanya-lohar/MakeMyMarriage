# 0018 — Invitation token storage and guest-access rules

**Status:** Accepted (approved by the product owner on 2026-10-10). Amends
[0008](0008-guest-invitation-model.md) and [0017](0017-phase-4-guests-and-invitations.md)
as listed under "Superseded statements". **Amended by
[0019](0019-phase-4-design-decisions.md) (2026-10-10):** the open item below is decided (an
organizer route returns the current link), #3 now includes that route, and the #10 limits
are approved. **Amended by [0020](0020-email-status-after-regeneration.md) (2026-10-10):**
regenerating sets the current email status to Draft (#8).

## Context

0008 and 0017 #6 stored only the invitation token's hash. The raw link then existed only at
the moment it was created, while sending and resending the invitation email need it later.
The documentation audit raised this as blocking Phase 4; the product owner chose option (a).

## Decisions

### Token storage (option a)

1. The invitation token is a cryptographically random value. It is stored **twice**:
   - its **hash**, used to verify guest requests (lookup by hash); and
   - an **encrypted copy**, which the server decrypts only for authorized organizer
     operations — sending and resending the invitation email.
2. The encryption key is **kept outside the database**, supplied to the API and worker from
   the platform's secret manager. It is never committed, logged or stored with the data. The
   encrypted copy records which key version encrypted it, so the key can be rotated.
3. Neither the raw token, its hash nor its encrypted copy is ever written to logs or returned
   by any endpoint other than those that deliberately return the invitation link (create and
   regenerate).
4. The **same token is reused** for every resend and when the guest's contact details
   (mobile, email) change.
5. **Regenerating** the token or **deleting the guest** revokes the previous token at once.
6. Tokens do **not expire automatically** in Phase 4 (unchanged from 0017 #8).

Security trade-off, accepted: anyone holding both a database copy and the encryption key
could recover live invitation links. Keeping the key out of the database limits a database
leak to hashes and ciphertext; revocation and regeneration remain the remedy for a link that
has spread.

### RSVP, delivery and deletion rules

7. An **organizer may reset an RSVP to `PENDING`** (with `attendeeCount: null`). Every reset is
   recorded in the audit history (`audit_logs`). Guests still cannot set `PENDING` (0017 #4).
8. An **immediate rejection** of a send request by the email provider marks that **send
   attempt `FAILED`**, with the provider's reason. The invitation's current delivery status
   follows its latest attempt. Send-attempt history stays separate from RSVP state, and
   `DELIVERED` still requires provider confirmation (0017 #10).
9. **Deleting a guest** revokes their invitation token: the link stops working at once and
   guest endpoints answer as for any invalid token. The guest's records are soft-deleted and
   their history (assignments, RSVPs, deliveries, activity) is kept under the deletion policy
   (Database Design v1.1 §21).

### Field limits and expense statuses

10. Field limits not set by an approved source are labelled **proposed** wherever they appear
    and are not treated as approved until confirmed. Approved Phase 4 limits: guest name
    1–100 (Phase 4 PRD v1.1) and the mobile rule (0017 #14). Proposed: event name 100,
    event description 1,000, venue name 120, venue address 300, dress code 120, event notes
    1,000, guest email 254, relation 100, guest notes 1,000.
11. **Expense status `CANCELLED` is not added.** The approved V1 expense lifecycle (PRD v1.1
    §15, carried into PRD v1.2 §15) has Paid, Pending and Partially paid only; Database Design
    v1.0's extra `CANCELLED` value was lower in precedence (0004) and is removed. Adding it
    later needs its own decision, because it would change expense totals, the
    pending-payments summary, reports and payment validation.

## Open — not decided by this record (decided by 0019)

- **Showing the link again after creation.** Create and regenerate return the invitation link.
  Letting an organizer copy it later (Copy Link, WhatsApp) without regenerating would need a
  route that returns the link, which is not in the approved route list (0017 #16). Until
  decided, the link is available from the create and regenerate responses, and email
  send/resend uses the stored encrypted copy.

## Superseded statements

| Source                                                                                                               | Statement                                                                                      | Resolution                                                                |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Decision 0008                                                                                                        | "Only a token hash is stored, never the raw token"                                             | Hash plus encrypted copy (decisions 1–2).                                 |
| Decision 0017 #6                                                                                                     | "Only its hash is stored"                                                                      | Hash plus encrypted copy (decisions 1–2).                                 |
| Decision 0017, Open                                                                                                  | Raw link availability; organizer reset to `PENDING`; immediate rejection; deleted guest's link | Decided here (decisions 1–9), except showing the link again (still open). |
| Database Design v1.0 §12.1                                                                                           | `paymentStatus` includes `CANCELLED`                                                           | Not in V1 (decision 11).                                                  |
| PRD v1.2, Phase 4 PRD v1.2, System Design v1.3, Database Design v1.1, API Design v1.1 (first versions of 2026-10-10) | Hash-only wording, the open items above, unlabelled proposed limits                            | Updated in the same change (0003).                                        |
