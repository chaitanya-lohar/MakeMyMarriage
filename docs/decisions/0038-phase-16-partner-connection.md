# 0038 — Phase 16: partner connection and sharing

**Status:** Accepted. Decisions D1–D10 were approved by the product owner on 2026-11-03. They
answer A4 and A5 of [0011](0011-pending-partner-sharing-decisions.md), which becomes
Accepted. Amends [0012](0012-wedding-ownership-and-membership.md) (disconnection and how an
invitee who owns a wedding resolves it) and [0026](0026-phase-7-tasks.md) #14 (partner
privacy of tasks). Ordering: [0037](0037-phase-16-before-phases-11-15.md). The full
specification is the [Phase 16 PRD v1.0](../specs/PHASE_16_PRD_v1.0.md).

## Context

Partner connection was planned but not designed: A4 (what partners share) and A5 (what
happens when they disconnect) were open. The Phase 16 discovery (2026-11-03) found:

- An invitee cannot own a wedding when accepting (0012, N1), so a partner always joins the
  inviter's wedding and brings no records of their own into it. "Connection never merges
  private data" holds by construction.
- Every wedding record is scoped by `weddingId` only; no record has an owning partner or a
  visibility field.
- Owners hold every permission (Phase 10, 0034), and organizers see what their role allows.
  Partner-private records inside a shared wedding would conflict with both.
- Phase 16 depends on none of Phases 11–15 (0037).

## Product decisions (approved)

1. **D1 — One shared wedding.** Both partners automatically share every resource of the
   wedding: wedding settings, events, guests, invitations and RSVP, tasks, expenses, vendors,
   members, audit history, and every future wedding module (website, gallery, memory QR,
   live stream, reports), whose public parts remain governed by their own phase. Personal
   account information (profile, password, sessions, other weddings) is never shared. There
   are **no** private-resource or sharing switches and **no** `resource_shares` collection.
   Partner sharing is the wedding itself; what organizers see is still decided by their role
   and overrides (0034).
2. **D2 — Phase ordering.** Phase 16 is built before Phases 11–15 (0037).
3. **D3 — Partner identity.** The partner is the wedding's second owner, however they became
   one (partner invitation, or a Phase 10 seat transfer while two owners existed).
4. **D4 — Invitation security.** A partner invitation is valid for seven days; the signed-in
   account's email must equal the invited email; no other email verification is required; the
   token is random, single-use and stored only as a hash; a resend issues a new token and resets
   the expiry to seven days from the resend; the Phase 10 invitation rate limits apply.
5. **D5 — Existing organizer.** An invitee who is already an active organizer (non-owner
   member) of the wedding is promoted on their **existing** membership record, and their custom
   permission overrides are cleared. This is not an ordinary role change, which keeps overrides
   (0035 #2).
6. **D6 — Invitee who owns another wedding.** The invitee must first transfer ownership of
   their own wedding (the Phase 10 seat transfer) before accepting. Weddings are never deleted
   or merged.
7. **D7 — Disconnection.** A partner disconnects by leaving the shared wedding. They lose access
   immediately; their membership becomes removed (`REVOKED`) as in the membership lifecycle; the
   remaining partner is the sole owner; all wedding records stay unchanged.
8. **D8 — No removal.** Neither partner can remove the other. Changes to an owner's membership
   stay owner-protected and self-only (0034).
9. **D9 — No bride/groom labels.** Bride/groom type is not collected (PRD §8 stands); owners are
   shown as "Owner". The planned `ownerType` field is not added. The wedding's bride and groom
   names are unaffected.
10. **D10 — Reconnection.** A former partner can be invited again. Their previous membership
    record is reused; the earlier connection records and the audit history are kept; no access
    returns until the new invitation is accepted.

## Technical design

### Model

- **`partner_connections`** holds both the invitation and the connection, one record per
  attempt (Database Design §7.3):
  - statuses `PENDING`, `ACTIVE`, `DECLINED`, `REVOKED`, `EXPIRED`, `DISCONNECTED`;
  - `inviteeEmail` (lower-cased), `tokenHash` (SHA-256 of 32 random bytes), `expiresAt`,
    `lastSentAt`, `emailSent`, `resentAt[]` (as `member_invitations`, 0034 R2);
  - `inviterUserId`, `inviteeUserId?` and `membershipId?` (set on acceptance),
    `acceptedAt?`, `respondedAt?`, `revokedAt?`/`revokedBy?`, `expiredAt?`,
    `disconnectedAt?`/`disconnectedBy?`;
  - `open: true` while `PENDING` or `ACTIVE`, unset otherwise, with a partial unique index on
    `weddingId` where `open = true`: at most one pending or active connection per wedding;
    unique `tokenHash`; `(weddingId, createdAt)` for the latest record.
- **No change to `wedding_memberships` fields.** The partner takes the free owner seat
  (`owner_seat_per_wedding`); the one-owned-wedding index (`one_owner_membership_per_user`) is
  unchanged.
- **`weddings.ownersVersion`** (number, absent means 0) is incremented inside every transaction
  that changes the wedding's owners (partner acceptance, leaving, Phase 10 seat transfer). Two
  such transactions on one wedding therefore conflict and one retries, so concurrent owner
  changes are serialized and the owner checks below are always read fresh.
- No data migration: the collection is new; existing weddings have one owner and no
  connection.

### Lifecycle

- **Invite** — an owner, while the wedding has exactly one owner and no open connection. Not to
  the inviter's own email. The email is sent during the request (0025); a failed send leaves the
  invitation pending with `emailSent: false`.
- **Resend / revoke** — owners, while `PENDING` and not expired. Resend: new token, expiry reset,
  at most three per rolling 24 hours. Revoke: `REVOKED`; the link stops working.
- **Expiry** — checked on every read and in the acceptance update; the first request that sees
  it writes `EXPIRED` (no background job), as P10-2.
- **Accept** — signed in; account email = invited email (D4); invitation live; invitee does not
  own a wedding (D6); the wedding still has a free owner seat. One transaction, conditional at
  each step:
  1. increment `ownersVersion`;
  2. connection `PENDING` and live → `ACTIVE` (`inviteeUserId`, `membershipId`, `acceptedAt`);
  3. the invitee's membership of the wedding: none → a new `OWNER` row on the free seat; an
     `ACTIVE` non-owner row → promoted in place to `OWNER` on the free seat, overrides cleared
     (D5); a `REVOKED` row → reactivated as `OWNER` on the free seat, overrides and revocation
     cleared (D10);
  4. audit entries.
     Any failed condition aborts the whole transaction.
- **Decline** — with the token alone, while `PENDING` and live (as 0034 R6); grants nothing.
- **Leave** — an owner, while the wedding has two owners. One transaction: increment
  `ownersVersion`; the caller's row `OWNER` → `memberType = MEMBER`, `role = VIEWER`,
  `status = REVOKED`, `revokedAt`, `revokedBy` = the caller, seat and overrides unset; check that
  one `ACTIVE` owner remains; the open connection, if any, → `DISCONNECTED`; pending ownership
  offers involving the caller → `CANCELLED` (`MEMBERSHIP_CHANGED`); audit. The leaver keeps no
  access and may own a wedding afterwards. Records they created, assignments and payments stay
  and show them as a former member (0030). Organizer invitations they sent stay valid.

### API (API Design §7.2)

| Method | Endpoint                                                | Who                               |
| ------ | ------------------------------------------------------- | --------------------------------- |
| GET    | `/weddings/{weddingId}/partner`                         | Owners (`PARTNER_SHARING:VIEW`)   |
| POST   | `/weddings/{weddingId}/partner/invitations`             | Owners (`PARTNER_SHARING:CREATE`) |
| POST   | `/weddings/{weddingId}/partner/invitations/{id}/resend` | Owners (`PARTNER_SHARING:EDIT`)   |
| POST   | `/weddings/{weddingId}/partner/invitations/{id}/revoke` | Owners (`PARTNER_SHARING:DELETE`) |
| POST   | `/weddings/{weddingId}/partner/leave`                   | Owners (`PARTNER_SHARING:DELETE`) |
| GET    | `/partner-invitations/{token}`                          | Token (public)                    |
| POST   | `/partner-invitations/{token}/accept`                   | Signed in, matching email         |
| POST   | `/partner-invitations/{token}/decline`                  | Token (public)                    |

`PARTNER_SHARING` is already owner-only and never grantable (0034). The v1.0 share routes
(`…/shares`, `…/events/{eventId}/share`) are not built (D1). The email links to the web page
`/partner-invite/{token}`; sign-in and sign-up may return there (as for member invitations).

Errors: `PARTNER_INVITATION_NOT_FOUND` 404; `PARTNER_ALREADY_CONNECTED` 409 (two owners);
`PARTNER_INVITATION_ALREADY_PENDING` 409; `PARTNER_INVITATION_NOT_PENDING` 409
(`details.status`); `PARTNER_INVITATION_EXPIRED` 409; `PARTNER_INVITATION_EMAIL_MISMATCH` 403;
`PARTNER_INVITEE_OWNS_WEDDING` 409; `PARTNER_SEAT_UNAVAILABLE` 409; `PARTNER_NOT_CONNECTED` 409
(leaving with one owner); `VALIDATION_FAILED` 400 (own email); `RATE_LIMITED` 429.

Limits (API Design §28): 10 partner invitations per wedding per rolling hour, 3 resends per
invitation per rolling 24 hours, and on the token routes 120 per IP and 60 per token a minute.

### Audit (Database Design §22)

`resourceType` `partner_connection`: `PARTNER_INVITATION_CREATED`, `_RESENT`, `_REVOKED`,
`_ACCEPTED`, `_DECLINED`, `_EXPIRED`, `PARTNER_CONNECTED`, `PARTNER_DISCONNECTED`; and on the
membership `MEMBER_PROMOTED_TO_OWNER` (D5) and `MEMBER_REACTIVATED` (D10). Metadata never holds
the token or its hash.

### Web

- The Members page gains a partner section for owners (Stitch M16-01 to M16-09, approved
  separately). Non-owners do not see it.
- The public page `/partner-invite/{token}`.
- The web copy guard that rejects the word "partner" (`v1-copy-guard.ts`) allows it in the
  partner feature.

## Superseded and clarified statements

| Source                                 | Statement                                                                 | Resolution                                                      |
| -------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 0011                                   | A4 and A5 pending                                                         | Answered (D1, D7); 0011 Accepted                                |
| PRD v1.2 §7, §9, §23, §30, §31         | Private by default; selective, explicit, event-scoped sharing             | One shared wedding (D1)                                         |
| System Design v1.3 §3, §6, §7.4, §8    | Resources private by default; Sharing module; sharing after overrides     | One shared wedding; no Sharing module (D1)                      |
| Database Design v1.1 §7.2              | Planned `ownerType` (BRIDE, GROOM)                                        | Not added (D9)                                                  |
| Database Design v1.1 §7.3              | `partner_connections` without token, email or expiry; invitee required    | Redesigned above                                                |
| Database Design v1.1 §7.4, §8.4 step 7 | `resource_shares`                                                         | Not built (D1)                                                  |
| API Design v1.1 §7.2, §8               | Share routes; `…/partner/disconnect`                                      | Routes above; leave instead of disconnect (D7)                  |
| 0012                                   | Statuses counting after disconnection are part of A5; resolution UX later | The leaver becomes `MEMBER`/`REVOKED` (D7); transfer first (D6) |
| 0026 #14                               | Partner privacy of tasks decided by A4                                    | Tasks are shared (D1)                                           |
