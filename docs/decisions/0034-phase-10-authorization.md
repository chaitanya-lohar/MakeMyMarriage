# 0034 — Phase 10: organizers, roles and permissions

**Status:** Accepted for the default role matrix and decisions P10-1–P10-8 (approved by the
product owner on 2026-10-27). The interpretations R1–R6 below are **Proposed**: recommended,
not yet confirmed by the product owner. The numeric rate limits (R1, R2) are not contractual
until confirmed. Amends [0026](0026-phase-7-tasks.md) #14, [0028](0028-phase-8-expenses.md)
#19, [0032](0032-phase-9-vendors.md) #19, [0019](0019-phase-4-design-decisions.md) Q1 #1 and
[0022](0022-dashboard-api-contract.md); supplements [0012](0012-wedding-ownership-and-membership.md).

Phase 10 builds organizer and permission management, as set out in PRD v1.2 §24. It adds:

- organizer invitations;
- the roles Owner, Admin, Organizer, Editor, Viewer and Custom;
- per-member permission overrides;
- the owner-seat transfer;
- the audit-log view;
- a permission check on every wedding route.

The full design is in System Design v1.3 §7.2–§7.11, Database Design v1.1 §7.2, §7.5, §7.6 and
§8, and API Design v1.1 §6, §7.1 and §23. This record does not repeat that design. It records:

- what was decided;
- what is still to confirm;
- which earlier statements it replaces.

## Phase 10 replaces unrestricted member access

Before Phase 10, any `ACTIVE` member could do everything in a wedding. Being a member was the
only check, enforced by `WeddingAccessGuard`. The decisions that gave this access are:

- 0026 #14 for tasks;
- 0028 #19 for expenses;
- 0032 #19 for vendors;
- 0019 Q1 #1 for retrieving a guest link;
- 0022 for the dashboard.

The Phase 4 routes for events, guests, invitations and RSVP worked the same way. Because only
owners existed, this rule was never tested by a member with fewer rights.

From Phase 10 every wedding route requires one `(module, action)` permission (API Design §23).
Membership is still the first check: a non-member or revoked member receives `404`, as
before. Being a member is no longer enough to act. A member without the permission receives
`403 PERMISSION_DENIED`. There is no fallback to the old rule.

Owners hold every permission, so their behaviour does not change. The rollout over the built
routes is set out in API Design §23 and System Design §7.11.

## Decisions

### Model (approved)

1. **Default role matrix:** the modules, actions, role defaults and evaluation rules are those
   in Database Design §8.1–§8.4 and PRD v1.2 §24:
   - The Custom role starts with no access.
   - `DENY` overrides `ALLOW`.
   - `DENY` on `VIEW` closes the whole module.
   - A member cannot grant more than they hold.
   - Protected actions are never granted by override.
2. **Separate concepts:** partner connection, ownership, membership, overrides and resource
   sharing stay separate. Phase 10 does not use `resource_shares`, and does not depend on A4
   or A5 (0011).

### P10-1 to P10-8 (approved)

3. **P10-1 — no email verification.** A signed-in user may accept an invitation without
   verifying their email. The account email must equal the invitation email. The single-use
   emailed token and the matching email are the proof.
4. **P10-2 — seven-day expiry.** An invitation expires 7 days (168 hours) after its token is
   issued.
   - Expiry is checked on every read and in the acceptance update itself.
   - No background job is needed (0025).
   - The first request that sees an expired invitation writes `EXPIRED`.
5. **P10-3 — re-inviting a revoked member.** The existing membership row is reused, because
   the unique `(userId, weddingId)` index allows only one row.
   - The row stays `REVOKED` while the invitation is pending.
   - On acceptance, old overrides are cleared and the new role and overrides are applied.
   - History is kept in `audit_logs`.
6. **P10-4 — Admin limits.** An Admin cannot assign the Admin role. An Admin cannot invite,
   resend to, revoke, change or remove an Admin. These actions are refused with `403` and the
   reasons `ADMIN_ROLE_OWNER_ONLY` and `ADMIN_MEMBERSHIP_OWNER_ONLY`.
7. **P10-5 — owner-seat transfer.** An owner transfers only **their own** seat, to an
   `ACTIVE` non-owner member of the wedding.
   - The recipient must accept.
   - On acceptance the giver becomes Admin.
   - A wedding has at most two owners, enforced by `ownerSeat`, 1 or 2, under the
     `owner_seat_per_wedding` index.
   - Acceptance is one audited transaction.
   - The other owner is not affected. For example, with owners A and B, A transfers to C. The
     owners are then B and C, and A becomes an Admin.
   - The 0012 rule that a user owns at most one wedding is unchanged.
8. **P10-6 — guest links and QR.** Sending a guest link (`INVITATIONS:SEND`) is owner-only by
   default. So are regenerating and revoking a link (`INVITATIONS:MANAGE`) and regenerating a
   QR code (`MEMORY_QR:REGENERATE`). An owner may grant each of these to a member by override.
9. **P10-7 — `INVITED` reserved.** The membership status `INVITED` is never written and never
   admitted. A pending invitation exists only as a `member_invitations` record.
10. **P10-8 — dashboard and selection.** Each dashboard section is returned only with `VIEW`
    on its module. Any `ACTIVE` member can be chosen as a task assignee or an expense payer.
    Being chosen grants no access.

### Interpretations awaiting confirmation (Proposed)

The specifications already describe R3–R6 as the working interpretation. R1 and R2 are not in
the specifications as numbers. API Design §28 and Database Design §32 point here until R1 and
R2 are confirmed.

| #   | Item                    | Recommendation                                                                                                                                                                                                                                                                                             |
| --- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Invitation creation     | At most **10 member invitations per wedding per hour**; `429 RATE_LIMITED` beyond it                                                                                                                                                                                                                       |
| R2  | Invitation resend       | At most **3 resends per invitation per 24 hours**; `429 RATE_LIMITED` beyond it                                                                                                                                                                                                                            |
| R3  | Ownership-offer expiry  | **No expiry.** An offer ends when the recipient declines, the giver cancels (`BY_OWNER`), or the offer is cancelled automatically (`MEMBERSHIP_CHANGED`). Automatic cancellation happens when the giver is no longer an owner, or the recipient is removed or becomes an owner. One open offer per wedding |
| R4  | Guest-link access       | **Owner-only by default**, grantable by override. Retrieving a link (`GET …/invitation/link`), Copy Link and WhatsApp sharing count as sending (`INVITATIONS:SEND`), the same as email send and resend                                                                                                     |
| R5  | Resending an invitation | Issues a new token and resets `expiresAt` to **7 days from the resend**. The previous link stops working                                                                                                                                                                                                   |
| R6  | Declining an invitation | The **token alone** is enough, so an invitee without an account can decline. The token is single use, and declining is conditional on `PENDING` and not expired                                                                                                                                            |

When the product owner confirms an item, its row is marked Accepted here. For R1 and R2, the
numbers are also written into API Design §28 and Database Design §32 (0003). An item that is
rejected is reopened through 0004.

### Still open

11. **A4 and A5 (0011)** stay Pending. Phase 10 neither needs nor settles them.

## Implementation migration: owner seats

The `owner_seat_per_wedding` index can only be created once every existing `OWNER` row has a
seat. The migration runs with the Phase 10 implementation, as a versioned migration (Database
Design §28). It is **not** part of this documentation change.

1. **Identify** every `wedding_memberships` row with `memberType = OWNER`, grouped by
   `weddingId`.
2. **Backfill** `ownerSeat = 1` on each existing owner row. Today each wedding has exactly one
   owner, so each gets seat `1`.
3. **Validate** that no wedding has more than two owner rows.
4. **Detect and resolve** inconsistent data, and stop the migration if any is found:
   - rows where `memberType` and `role` disagree (Database Design §7.2);
   - more than one owner row in a wedding;
   - owner rows that are not `ACTIVE`;
   - a user with owner rows in several weddings.

   Each case is reported and resolved by hand, and never fixed silently (0004). Because
   `one_owner_membership_per_user` already exists, the last case should not occur.

5. **Create** the partial unique index on `(weddingId, ownerSeat)` where `memberType = OWNER`,
   after the backfill and validation pass.
6. **Verify** the result:
   - every owner row has a seat and every other row has none;
   - a wedding can still create its first owner, who takes seat `1`;
   - the bride-and-groom co-owner model (0012 C1) still fits, with two owners in one wedding
     on seats 1 and 2. Partner connection (Phase 16) will take the free seat;
   - a third owner is refused.

## Superseded and clarified statements

| Source                        | Statement                                                          | Resolution                                                                    |
| ----------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 0026 #14                      | Any `ACTIVE` member can do everything with tasks                   | `TASKS` permissions; any active member can be an assignee (10)                |
| 0028 #19                      | Any `ACTIVE` member can do everything with expenses and payments   | `EXPENSES` permissions; any active member can be the payer (10)               |
| 0032 #19                      | Any `ACTIVE` member can do everything with vendors and bookings    | `VENDORS` permissions                                                         |
| 0019 Q1 #1                    | Link retrieval needs the usual wedding-membership check            | `INVITATIONS:SEND`, owner-only by default (8, R4)                             |
| 0022                          | Dashboard authorization: an active member (`OWNER` until Phase 10) | Active membership, and each section needs `VIEW` on its module (10)           |
| 0016                          | Only `OWNER` members exist in Phase 3; they may edit               | Editing the wedding needs `WEDDING_SETTINGS:EDIT`                             |
| 0012 C1; Database Design §7.2 | The owner index does not limit the number of owners in a wedding   | At most two, through owner seats (7); one owned wedding per user is unchanged |
| PRD v1.2 §24, §30             | Roles and permission templates: default matrix deferred            | Approved; rewritten in §24 (1, 3–10)                                          |
| API Design v1.1 §28           | Member invitation limit: number set with Phase 10                  | Proposed R1, R2; not contractual until confirmed                              |
| Database Design v1.1 §7.2     | `INVITED` membership status                                        | Reserved, never written (9)                                                   |
