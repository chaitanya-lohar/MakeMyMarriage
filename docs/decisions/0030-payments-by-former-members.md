# 0030 — Payments by a former member

**Status:** Accepted (approved by the product owner on 2026-10-22, option (a), raised by the
Phase 8 code review under protocol 0004).

## Context

A payment's payer is either a wedding member or a typed name (0028 #12). API Design §12 says a
member payer must be "an active member". It does not say what happens when a payment was made
by a member who has since left the wedding and the payment is edited without changing its payer.
Refusing such an edit would block the correction that 0028 #10 asks for — fixing the payments
before lowering an expense's amount. This cannot happen until a wedding has more than one
member (Phase 10).

## Decision

1. **Keeping the payer is allowed.** When a payment is edited and its payer stays the same
   member, the edit is accepted even if that person is no longer an active member. The record
   stays true: they made the payment.
2. **A new member payer must be active.** Adding a payment, or changing a payment's payer to a
   member, still requires an active member of the wedding (`MEMBER_NOT_FOUND` otherwise).
3. The payer's name is shown as before (their display name).

## Superseded and clarified statements

| Source              | Statement                                | Resolution                                                |
| ------------------- | ---------------------------------------- | --------------------------------------------------------- |
| API Design v1.1 §12 | `paidByUserId` must be an active member  | On an edit that keeps the same payer, it need not be (1). |
| Phase 8 PRD §3.2    | Payer: a wedding member, or a typed name | Clarified by 1–2.                                         |
