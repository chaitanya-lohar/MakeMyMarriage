# 0036 — An invitation accepted by someone who is already a member

**Status:** Accepted (decided on 2026-10-29 under the product owner's delegation: "for issue
7, you can [make the] appropriate decision"). Supplements
[0034](0034-phase-10-authorization.md); found in the Phase 10 code review.

## Context

An invitation cannot be created for an active member (`409 MEMBER_ALREADY_ACTIVE`, API
Design §7.1). A person can still become a member after being invited — through a second
invitation, for example — and then open the first link. Accepting it is refused with
`409 MEMBER_ALREADY_ACTIVE`, as specified, but no specification said what happens to the
invitation. As built, it stayed `PENDING`: listed, resendable and live for up to seven days,
although its invitee was already in the wedding.

## Decision

1. When the signed-in invitee is already an `ACTIVE` member of the wedding, accepting closes
   the invitation as **`ACCEPTED`**, linked to the existing membership (`membershipId`,
   `acceptedByUserId`, `respondedAt`), in the same conditional update as any acceptance
   (still live, single use).
2. Nothing about the membership changes: not its role, not its overrides. An invitation never
   changes an existing member's access; that is done on the member's page (API Design §7.1).
3. The response stays `409 MEMBER_ALREADY_ACTIVE`, so the page shows "You're already a member
   of this wedding" (Stitch P10 · M7).
4. The audit entry is `MEMBER_INVITATION_ACCEPTED` with `metadata.alreadyMember: true`; there
   is no `MEMBER_REACTIVATED`.
5. The email check (P10-1) and the expiry check (P10-2) still come first: an expired or
   another account's invitation is refused as before and is not closed this way.

## Why

`ACCEPTED` is the invitee's answer ("yes"), and the invitee is in the wedding, so the record
is true. `REVOKED` would claim an owner's action that never happened; `DECLINED` would claim
the opposite answer. Leaving it `PENDING` kept a dead link that could be resent.

## Changed statements

| Source               | Statement                                             | Resolution                                       |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| API Design v1.1 §7.1 | Accept: `409 MEMBER_ALREADY_ACTIVE` if already active | Same response; the invitation is closed (1–4)    |
| DB Design v1.1 §7.5  | Lifecycle `PENDING` → `ACCEPTED`                      | Also when the invitee is already a member (1, 2) |
