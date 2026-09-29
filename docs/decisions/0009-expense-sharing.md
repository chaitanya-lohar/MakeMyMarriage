# 0009 — Expense sharing: no visibility field

**Status:** Accepted. Resolves a conflict between the product decision and the PRD,
System Design, Database Design and API Design statements listed below.

## Decision

Expenses are automatically shared with the connected partner. V1 has **no**
user-selectable expense visibility:

- no `visibility` field in the Expense API contract,
- no `visibility` field in the Expense schema,
- no private/shared expense toggle.

Expenses support the previously agreed fields: `eventId`, optional `vendorId`, category
(values pending — C4 in 0010), amount, payments, receipts, and the other documented
fields such as notes. No other expense behaviour is added.

This is an explicitly approved product decision, so it takes precedence over the
statements below (0004, precedence level 1).

## Superseded statements

| Source                     | Statement                                                                                                  | Resolution                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| PRD v1.1 §7                | "Private guests, expenses, tasks, notes and other protected data remain private unless explicitly shared." | Superseded for expenses only; the rest is unchanged and is defined by A4 (0011). |
| System Design v1.2 §8      | "Events, expenses and other protected resources are not automatically exposed."                            | Superseded for expenses only; events are defined by A4 (0011).                   |
| API Design v1.0 §12        | Create-expense example includes `"visibility": "SHARED"`                                                   | Field removed.                                                                   |
| API Design v1.0 §23        | "View private expense — VIEW + visibility/share check"                                                     | No private expenses; normal VIEW permission.                                     |
| Database Design v1.0 §12.1 | `visibility: string // PRIVATE, SHARED`                                                                    | Field removed.                                                                   |
| Database Design v1.0 §12.1 | "Bride and groom can maintain their own private expenses; an expense can be explicitly shared."            | Superseded: expenses are automatically shared.                                   |

System Design v1.2 §12.1 already matches this decision ("expense information is shared
with the connected partner"). API Design route authority (0004) does not carry stale
fields over.

Unchanged: expenses are never exposed on the public wedding website (API Design §15
"must not expose … private expenses" — no expense data is public).
