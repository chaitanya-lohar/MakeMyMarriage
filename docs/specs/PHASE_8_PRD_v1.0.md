# MakeMyMarriage — Phase 8 PRD v1.0: expenses

| Item         | Value                                                                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status       | **Canonical** for Phase 8. Approved scope; screens approved (0029); **not implemented**.                                                                                                   |
| Date         | 2026-10-20                                                                                                                                                                                 |
| Parent       | [PRD v1.2](PRD_v1.2.md) (sections 15 and 18)                                                                                                                                               |
| Decision     | [0028](../decisions/0028-phase-8-expenses.md), with [0009](../decisions/0009-expense-sharing.md), 0010 #5–#8 and 0018                                                                      |
| Contracts    | [Database Design v1.1](DB_DESIGN_v1.1.md) §12, [API Design v1.1](API_DESIGN_v1.1.md) §6 and §12                                                                                            |
| Out of scope | Budgets and forecasts, receipts, vendor linking, reports and export, payment reminders, fine-grained permissions, a Cancelled status, cost splitting, other currencies, recurring expenses |

| Version | Date       | Change                                                     |
| ------- | ---------- | ---------------------------------------------------------- |
| 1.0     | 2026-10-20 | First version, from the Phase 8 discovery (decision 0028). |
| 1.0     | 2026-10-21 | §10: screens approved in Stitch (decision 0029).           |

## 1. Purpose and outcomes

Give the couple one place to record what the wedding actually costs — each booking or
purchase, for the whole wedding or one event — and every advance, instalment and settlement
paid toward it, so they can see at a glance what has been paid and what is still pending.
It is an expense tracker, not a budgeting tool.

## 2. Governing rules

- Expenses belong to exactly one wedding. Every route is wedding-scoped and admits only
  `ACTIVE` members; anything else is `404` (System Design §7.2).
- Any active member can do everything with a wedding's expenses in Phase 8 (0028 #19).
  Expenses are shared with the connected partner, with no private option (0009), and never
  appear on the public website. Fine-grained permissions arrive in Phase 10.
- Money is integer paise, rupees only (0028 #6). No floating-point arithmetic for money,
  in the API or the web app.
- Dates are calendar dates in the wedding's timezone (`Asia/Kolkata`), as for events and
  tasks. Nothing is scheduled (0025).
- Payment records are the source of truth; the stored paid total and status follow them
  (0028 #7, #8).
- Deleting an expense is soft; changes are audited.

## 3. Fields

### 3.1 Expense

| Field          | Rule                                                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title          | Required; trimmed; 1–150 characters.                                                                                                                            |
| Amount         | Required; the full cost. Rupees with at most two decimals; more than ₹0 and at most ₹10,00,00,000; not below the paid total (§4).                               |
| Category       | Required; one of `VENUE`, `CATERING`, `DECORATION`, `PHOTOGRAPHY`, `CLOTHING`, `JEWELLERY`, `MAKEUP`, `ENTERTAINMENT`, `INVITATIONS`, `GIFTS`, `MISCELLANEOUS`. |
| Expense date   | Required; defaults to today; past or future allowed. Separate from payment dates.                                                                               |
| Event          | Optional; an active event of the same wedding. Empty means a whole-wedding expense.                                                                             |
| Notes          | Optional; at most 1,000 characters.                                                                                                                             |
| Payment status | Calculated, read-only (§4).                                                                                                                                     |

- Text fields are trimmed; an empty optional field is stored as absent.
- System fields: currency (`INR`), paid total, created by and at, updated at, deleted by
  and at.
- Not in Phase 8: description (0028 #11), vendor (0028 #4), receipts (0028 #3).

### 3.2 Payment

| Field     | Rule                                                                                                            |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| Amount    | Required; more than ₹0, at most two decimals; with the other payments, never more than the expense amount (§4). |
| Date      | Required; today or earlier in the wedding's timezone.                                                           |
| Payer     | Required; either a wedding member, or a typed name (1–100 characters), such as "Bride's father".                |
| Method    | Optional; `CASH`, `UPI`, `BANK_TRANSFER`, `CARD`, `CHEQUE`, `OTHER`.                                            |
| Reference | Optional; at most 100 characters (for example a UPI or cheque number).                                          |
| Notes     | Optional; at most 500 characters.                                                                               |

## 4. Money rules

- **Paid** = the sum of the expense's payments. **Pending** = amount − paid.
- **Status:** `PENDING` when paid is 0; `PARTIALLY_PAID` when 0 < paid < amount; `PAID`
  when paid = amount. Set by the server after every change; never sent by a client.
- **No overpayment:** adding or editing a payment is rejected when paid would exceed the
  amount; the message gives the remaining balance.
- **No amount below paid:** editing an expense's amount is rejected when the new amount is
  less than paid.
- **Concurrency:** each payment change and the expense's paid total and status are written
  in one transaction, with a conditional update that fails if the rules above would break,
  so two members saving at once cannot overpay (0028 #8).
- Amounts are shown with Indian grouping: ₹1,50,000 and ₹12,50,000. Paise are shown only
  when present (₹1,50,000.50).

## 5. Behaviour

### 5.1 Create, edit and move

- Create from the Expenses page; or from "Add expense for this event" on an event, with
  that event preselected and still changeable (0028 #22).
- Every field in §3.1 can be edited. Changing or clearing the event moves the expense
  between events and the whole wedding.

### 5.2 Payments

- Add, edit and remove payments on the expense page. Removing asks for confirmation.
- **Mark as fully paid** opens the add-payment form filled with the remaining balance,
  today's date and the signed-in member as payer; the member reviews and saves (0028 #14).
  It is not shown when the expense is paid.
- Until partners (Phase 16) and organizers (Phase 10) exist, the only member is the owner,
  so the payer is "Me" or a typed name.

### 5.3 Delete

- **Delete** asks for confirmation, then soft-deletes the expense: it leaves every list,
  total and route (`404`); the expense and its payments are kept in the database.

### 5.4 Deleted events

- When an event is deleted, every expense linked to it becomes a whole-wedding expense; its
  payments are unchanged and an audit entry records the removed link (0028 #17).

### 5.5 Audit

- Written to `audit_logs` with actor and time: expense created, edited (the changed fields),
  deleted; payment added, edited, removed; event link removed by a deleted event.
- Removing a payment deletes its record; the audit entry keeps the removed payment's
  amount, date, payer, method, reference and notes, with the removal time and actor.
- No history timeline is shown in Phase 8 (0028 #18).

## 6. Expense list

- One list; 25 expenses at a time with "Load more", like the task list (0028 #20).
- **Row:** title; category; the event name or **Whole wedding**; amount; paid; pending;
  status; expense date.
- **Filters** (combinable):
  - Category.
  - Event, including **Whole wedding**.
  - Payment status.
  - Search: title contains the text, ignoring case.
- **Order:** expense date, newest first; then newest created first. Stable across "Load
  more".
- **Totals** above the list: **Total**, **Paid** and **Pending** over every expense matching
  the filters (not only the loaded page), calculated as on the dashboard.
- States: loading; empty (no expenses yet, with "Add an expense"); no results for the
  filters (with "Clear filters"); error with retry.

## 7. Expense page

- All fields, the calculated paid, pending and status, and the payments list (date, amount,
  payer, method, reference, notes), oldest payment first.
- Actions: edit, delete (with confirmation), add payment, edit or remove a payment (removal
  with confirmation), "Mark as fully paid".

## 8. Dashboard summary

Added to the existing dashboard (PRD §18; API Design §6), computed on every request over
expenses that are not deleted:

- **Total** = sum of amounts; **Paid** = sum of payments; **Pending** = Total − Paid.
- **By category:** only categories with expenses, largest total first.
- **By event:** each event with expenses, and **Whole wedding**, largest total first.
- Both breakdowns add up to Total; nothing is counted twice. Plain amounts, no charts.
- **No expenses:** an empty state with an "Add an expense" link.

## 9. API and data

- Routes: API Design §12. Filters, ordering, totals and pagination as in §6 above; the
  dashboard fields as in API Design §6.
- Data: Database Design §12 — `expenses` (with `paidMinor` and the server-set
  `paymentStatus`) and `expense_payments` (with the payer). `expense_receipts` is deferred.
- Errors follow API Design §21: `404` for an expense, payment, event or member outside the
  wedding or deleted; `400 VALIDATION_FAILED` with field errors for invalid input;
  `409 PAYMENT_EXCEEDS_BALANCE` and `409 AMOUNT_BELOW_PAID` for the money rules.

## 10. UI

- An **Expenses** item in the workspace navigation, after Tasks (PRD §29).
- Screens: approved in Stitch (decision 0029, with its corrections) — expense list (with
  totals, filters and states), add and edit expense, expense page with payments, add and
  edit payment (including "Mark as fully paid"), the delete and remove confirmations (the
  remove dialog previews paid and pending before and after), the dashboard expense card,
  and the event shortcut — on desktop and mobile. A payment is removed only from its row.
  The wording is draft.
- Reuse the workspace design system and the patterns of Phases 3, 4 and 7 (forms, confirm
  dialog, toasts, the date picker, "Load more").
- Amounts are right-aligned and use tabular figures; long titles wrap; actions stay
  reachable on small screens; every control is keyboard-accessible with visible focus.
- Wording follows the V1 copy rules: no "budget", "forecast" or "cash flow".

## 11. Acceptance criteria

1. A member creates an expense with title, amount, category and date; it is whole-wedding,
   `PENDING`, paid ₹0, pending the full amount.
2. Amounts of ₹0, more than ₹10 crore, or with more than two decimals are rejected by the
   form and the API; ₹1,50,000.50 is stored as 15000050 paise.
3. A title over 150 characters, notes over 1,000, a payer name over 100, a reference over
   100 or payment notes over 500 are rejected by the form and the API.
4. A payment changes the status to `PARTIALLY_PAID`; payments reaching the amount make it
   `PAID`; removing one returns it to the right status.
5. A payment that would exceed the amount is rejected; two concurrent payments that
   together exceed it cannot both succeed.
6. Lowering the amount below the paid total is rejected.
7. A payment dated tomorrow in the wedding's timezone is rejected; today is accepted.
8. A client cannot set `paymentStatus` or `currency`.
9. "Mark as fully paid" fills the remaining balance, today and the member; saving makes the
   expense `PAID`.
10. A deleted expense disappears from the list, totals, dashboard and its routes, and its
    payments remain in the database.
11. Deleting an event turns its expenses into whole-wedding expenses, keeps their payments,
    and writes an audit entry.
12. Expense and payment changes write audit entries.
13. Filters, search and order combine and stay stable across "Load more"; the totals match
    the filtered expenses.
14. The dashboard Total, Paid and Pending match the list with no filters, and the category
    and event breakdowns each add up to Total.
15. A non-member gets `404` for every expense and payment route and sees no expense in any
    total.

## 12. Deferred or open

- Receipts — with a file-storage decision (0028 #3).
- Vendor linking — Phase 9.
- Reports and Excel export — Phase 15. Payment reminders — Phase 14.
- Fine-grained permissions — Phase 10.
- The optional payment `Idempotency-Key` (API Design §25) — not built in Phase 8. **Known
  MVP limitation** (0028 #25): the form prevents double submission, but a repeated request
  can still record a payment twice; the overpayment rule still caps the total.
- Budgets, cost splitting, other currencies, recurring expenses, refunds — not planned.

## 13. Definition of done

- Code, database and API match this PRD, decision 0028, Database Design v1.1 and API Design
  v1.1, all under `/api/v1`.
- Automated tests pass for behaviour, validation, money rules (including concurrent
  payments), the event-deletion effect, authorization and tenant isolation.
- The UI implements only approved fields and states, from approved Stitch screens.
- `PROJECT_STATUS.md` and the documentation index are updated when the phase is merged.
