# 0012 — Wedding ownership and membership

**Status:** Accepted (resolutions C1, C2 and N1). Supplemented by
[0034](0034-phase-10-authorization.md) on 2026-10-27: a wedding has at most two owners, each
holding an owner seat, and an owner may transfer their own seat (P10-5). The rule that a user
owns at most one wedding is unchanged. Amended by
[0038](0038-phase-16-partner-connection.md) on 2026-11-03: an invitee who owns a wedding
transfers its ownership before accepting a partner invitation (D6), and a partner who leaves
becomes a removed `MEMBER` membership while the other partner remains sole owner (D7).

## Ownership (C1)

- A user has **at most one `OWNER` membership across all weddings**.
- A user may participate in other weddings through **non-owner** memberships, subject to
  the future membership/sharing rules (A4, 0011).
- When partner A connects with partner B, **both become `OWNER` members of the same
  wedding**. Partner B does not become the owner of a second wedding.
- "One active OWNER wedding per user" (0010 #18) means at most one wedding in which the
  user holds an `OWNER` membership. It does **not** mean only the creator is an owner.

```text
Valid                         Invalid
User A  OWNER → Wedding 1     User A  OWNER → Wedding 1
User B  OWNER → Wedding 1             OWNER → Wedding 2
```

## Signup and wedding creation (C2)

- Signup creates the user account only. A newly registered user may temporarily have no
  wedding.
- A wedding is created through `POST /api/v1/weddings`.
- Once created, the user is the `OWNER` of that wedding and cannot own another.
- Wedding creation is never forced into signup.

## Partner connection when the invitee already owns a wedding (N1)

V1 rule: a partner connection cannot be accepted while the invitee owns an active
wedding.

```text
User A  OWNER → Wedding A
User B  OWNER → Wedding B

A invites B as partner → B cannot accept while B owns Wedding B.
```

- The accept endpoint (`POST /api/v1/partner/invitations/{token}/accept`, API Design §7)
  returns a clear domain error stating that the invitee already owns an active wedding
  and must resolve that wedding before accepting.
- The system never merges the two weddings, automatically archives or deletes the
  invitee's wedding, or silently transfers ownership.
- The UX for resolving the situation is designed with the Partner Connection module.
- This is a resolved decision, independent of the pending A4/A5 decisions (0011). It
  closes the API Design v1.0 §35 open item "Exact invitation acceptance rules when invitee
  already owns a wedding".

## Interpretation of earlier statements

| Source                                        | Statement                                                                                                                                             | Interpretation                                                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| PRD v1.1 §7; §8; System Design v1.2 §3        | "One account contains exactly one wedding." / "One wedding per account."                                                                              | The intended steady state, not a requirement that signup and wedding creation are one step (C2).               |
| System Design v1.2 §7.1                       | "Register → … → create User → create one Wedding/workspace"                                                                                           | Superseded: registration creates only the user (C2).                                                           |
| System Design v1.2 §3, §7.2                   | "Both bride and groom are owners after connection" / "Both connected bride and groom are Owners."                                                     | Confirmed: both are `OWNER` members of the same wedding (C1).                                                  |
| Database Design v1.0 §7.1; API Design v1.0 §6 | "A user may own at most one wedding while still participating in multiple weddings through memberships." / "enforce the one-owned-wedding constraint" | Confirmed (C1).                                                                                                |
| PRD v1.1 §7; System Design v1.2 §8            | "Bride and groom workspaces are independent by default." / "Workspaces remain independent."                                                           | Not separate weddings (C1). What each partner keeps private within the shared wedding is defined by A4 (0011). |

## Implementation notes (for the Weddings/Partner modules)

- Database Design §7.2 defines only the uniqueness `(userId, weddingId)`. The one-owner
  rule needs its own constraint on `wedding_memberships` (for example a partial unique
  index on `userId` for owner memberships), designed when the module is built.
- Which membership statuses count toward the limit after a partner disconnects is part of
  A5 (0011).
