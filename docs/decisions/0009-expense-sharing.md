# 0009 — Expense sharing: no visibility field

**Status:** Accepted. Resolves a conflict between the product decision and Database
Design v1.0 / API Design v1.0.

## Decision

Expenses are automatically shared with the connected partner. V1 has **no**
user-selectable expense visibility:

- no `visibility` field in the Expense API contract,
- no `visibility` field in the Expense schema,
- no private/shared expense toggle.

Expenses support the previously agreed fields: `eventId`, optional `vendorId`, category
(fixed list including `OTHER` — see 0010), amount, payments, receipts, and the other
documented fields such as notes. No other expense behaviour is added.

## Superseded statements

| Source                     | Statement                                                                                       | Resolution                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| API Design v1.0 §12        | Create-expense example includes `"visibility": "SHARED"`                                        | Field removed.                                 |
| API Design v1.0 §23        | "View private expense — VIEW + visibility/share check"                                          | No private expenses; normal VIEW permission.   |
| Database Design v1.0 §12.1 | `visibility: string // PRIVATE, SHARED`                                                         | Field removed.                                 |
| Database Design v1.0 §12.1 | "Bride and groom can maintain their own private expenses; an expense can be explicitly shared." | Superseded: expenses are automatically shared. |

System Design v1.2 §12 already matches this decision ("expense information is shared
with the connected partner"). API Design route authority (0004) does not carry stale
fields over.
