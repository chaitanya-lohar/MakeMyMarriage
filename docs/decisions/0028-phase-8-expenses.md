# 0028 — Phase 8: expenses

**Status:** Accepted (approved by the product owner on 2026-10-20). Answers P8-EXP-Q01–Q27,
C1–C3 and P1–P3 from the Phase 8 discovery; the full specification is the
[Phase 8 PRD v1.0](../specs/PHASE_8_PRD_v1.0.md).

Phase 8 builds the expense tracker of PRD v1.2 §15 and its dashboard summary (§18). It keeps
the approved rules — automatic sharing with the partner and no visibility field (0009), the
fixed category list and the optional event and vendor links (0010 #5–#8), no `CANCELLED`
status (0018) and amounts in integer paise — and settles what the planned data model and
routes (Database Design §12, API Design §12) left open.

## Decisions

### Scope

1. **In scope (Q01):** the expense list; create, edit and soft-delete an expense; add, edit
   and remove its payments; an optional link to one event; the dashboard expense summary; an
   **Expenses** navigation item.
2. **Out of scope (Q01, Q27):** budgets and forecasts; receipts (3 below); vendor linking in
   the UI (Phase 9); reports and Excel export (Phase 15); reminders for due payments (Phase
   14); fine-grained permissions (Phase 10); a `CANCELLED` status (0018); splitting costs
   between families; other currencies; recurring expenses; refunds or any other financial
   workflow not listed here.
3. **Receipts are deferred (Q02, C3).** Phase 8 introduces no file storage and no receipt
   upload. `expense_receipts` and the two receipt routes stay in the designs, marked
   Deferred until a storage decision.
4. **Vendor link (Q03):** `vendorId` stays in the data model but is not shown, accepted or
   set in Phase 8. There is no free-text vendor name.

### Money model

5. **Amount (Q04)** is the full cost of the expense. Advances, instalments and the
   settlement are recorded as separate payments against it.
6. **Money (Q07, Q08):** amounts are entered in rupees with at most two decimal places and
   stored as integer paise; calculations use integers only, never floating point. An expense
   amount is more than ₹0 and at most ₹10 crore (₹10,00,00,000), enforced in the UI and the
   API. The currency is always `INR`, set by the server.
7. **Payment status is calculated, never entered (Q05, C2):** `PENDING` when nothing is
   paid, `PARTIALLY_PAID` when some but less than the amount is paid, `PAID` when the full
   amount is paid. The server sets it on every change to the amount or the payments; clients
   cannot send it, and there is no manual override. It is stored so the status filter is
   fast.
8. **Stored paid total (P3):** each expense keeps `paidMinor`, the sum of its payments. The
   payment records remain the source of truth. `paidMinor` and the status are updated in the
   same transaction as every payment change, by a conditional update that fails when the
   result would exceed the amount, so concurrent requests cannot bypass rules 9 and 10.
9. **No overpayment (Q09):** a payment that would make the total paid exceed the amount is
   rejected with a clear message, including when requests race.
10. **No amount below the paid total (Q10):** lowering an amount below what is already paid
    is rejected; the payments must be corrected first.

### Fields

11. **Expense fields (Q13, Q14, P1):** title (required, 1–150 characters), amount
    (required), category (required, one of the 11), expense date (required, defaults to
    today, past or future allowed; separate from payment dates), event (optional) and notes
    (optional, at most 1,000). **There is no description field** (P1 b); the planned
    `description` is removed.
12. **Who paid moves to each payment (Q06, C1):** each payment has a required payer — a
    wedding member, or a typed name such as "Bride's father" (at most 100 characters). The
    expense has no payer of its own; the planned `paidByType`, `paidByUserId` and
    `paidByName` move from `expenses` to `expense_payments`.
13. **Payment fields (Q11, Q12, Q14):** amount (required, more than ₹0), payment date
    (required, today or earlier in the wedding's timezone), payer (required), method
    (optional: Cash, UPI, Bank transfer, Card, Cheque, Other), reference number (optional,
    at most 100) and notes (optional, at most 500).

### Behaviour

14. **Mark as fully paid (Q23, P2 a)** opens the add-payment form filled with the remaining
    balance, today's date and the signed-in member as payer. Saving it follows the normal
    payment rules. It is not offered when the expense is paid.
15. **Payments can be edited and removed (Q17).** Removing asks for confirmation. The paid
    total, pending amount and status are recalculated after every addition, edit and
    removal.
16. **Deleting an expense (Q16)** is a soft delete after a confirmation: it leaves every
    list, total and route, and the expense and its payments stay in the database.
17. **Deleted events (Q15):** when an event is deleted, its expenses become whole-wedding
    expenses with their payments unchanged, and the change is audited.
18. **Audit, no timeline (Q18):** creating, editing and deleting an expense, adding, editing
    and removing a payment, and the event link removed by a deleted event are written to
    `audit_logs`. No expense history is shown in Phase 8; the payments list shows what was
    paid and when. Removing a payment deletes its record, and its audit entry keeps the
    removed payment's details (amount, date, payer, method, reference and notes) with the
    removal time and actor.
19. **Access (Q19):** any `ACTIVE` member of the wedding can view, create, edit and delete its
    expenses and manage their payments. Everything else returns `404`, as for other wedding
    routes. Expenses are shared with the connected partner with no private option (0009) and
    never appear on the public website. Fine-grained permissions arrive in Phase 10.

### Screens

20. **List (Q20–Q22):** one list, 25 at a time with "Load more".
    - Row: title, category, event name or "Whole wedding", amount, paid, pending, status and
      expense date.
    - Filters: category, event (including "Whole wedding") and payment status; search by
      title. Order: expense date, newest first.
    - Above the list: **Total**, **Paid** and **Pending** for the current filters, calculated
      the same way as the dashboard.
21. **Expense page (Q23):** the expense's details and its payments, with add, edit and remove
    and "Mark as fully paid".
22. **Event shortcut (Q25):** "Add expense for this event" on the event page, preselecting the
    event, which can still be changed.
23. **Dashboard (Q24):** **Total** (sum of active expense amounts), **Paid** (sum of their
    payments) and **Pending** (Total minus Paid); spending by category, only categories with
    spending, largest first; spending by event, including "Whole wedding". Plain amounts, no
    charts. The category and event breakdowns each add up to Total.
24. **Number format (Q26):** Indian grouping everywhere — ₹1,50,000 and ₹12,50,000.

### Known limitation

25. **No server-side idempotency (known MVP limitation):** the optional payment
    `Idempotency-Key` (API Design §25) is not built. The form prevents double submission, but
    that does not guarantee a repeated request cannot record a payment twice; the
    overpayment rule (9) still caps the total. Accepted for the MVP; revisit with Platform
    idempotency keys (0010 #16).

## Superseded and clarified statements

| Source                        | Statement                                                                   | Resolution                                                                               |
| ----------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| PRD v1.2 §15                  | Fields include "paid by", "payment status", "payment method" and receipt    | Payer and method are per payment (12, 13); status calculated (7); receipts deferred (3). |
| Database Design v1.1 §12.1    | `description`; `paidByType`, `paidByUserId`, `paidByName` on the expense    | `description` removed (11); payer moved to payments (12); `paidMinor` added (8).         |
| Database Design v1.1 §12.2    | Payer only as an optional `paidByUserId`                                    | Required payer: member or typed name (12).                                               |
| Database Design v1.1 §12.3    | `expense_receipts` with S3 storage keys                                     | Deferred (3).                                                                            |
| Database Design v1.1 §24, §27 | "Create expense + first payment"; totals "validated against payment status" | Status calculated; payment changes and `paidMinor` in one transaction (7, 8).            |
| API Design v1.1 §12           | Create accepts `paymentStatus` and `currency`; receipt upload routes        | Status and currency set by the server (6, 7); receipt routes deferred (3).               |
| API Design v1.1 §24           | Expense list example with `from`, `to` and `sort`                           | Filters and order as in 20.                                                              |
| System Design v1.3 §12.1, §20 | Receipts stored in S3                                                       | Deferred (3).                                                                            |
| Phase 4 PRD v1.2 §3.2         | Deleting an event: effects on RSVPs, invitations and tasks                  | Its expenses also become whole-wedding expenses (17).                                    |
