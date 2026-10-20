# 0029 — Phase 8 design approval

**Status:** Accepted (approved by the product owner on 2026-10-21). The screens and rules
below are approved; the **wording stays draft**, as for Phases 4 and 7 (0021, 0027).

The Phase 8 screens were generated in Google Stitch (project `11709379677369700007`) from
prompts written against decision 0028 and the Phase 8 PRD v1.0, reviewed against them, and
corrected in Stitch by the product owner. No screen contradicts an approved rule. The
remaining corrections below are applied in code, following the 0021 and 0027 precedent.

## Approved screens

| Screen                          | Stitch ID                          | Contains                                                             |
| ------------------------------- | ---------------------------------- | -------------------------------------------------------------------- |
| P8 · E1 Expenses List (desktop) | `e12e0636e74d452eb21542a6431347bb` | Totals strip, filters, table, "Load more"                            |
| P8 · E1 Expenses List (mobile)  | `54915953b5284a9a9b1eac72ac4311c5` | Totals, Filters button, card list                                    |
| P8 · E2 Expenses States         | `967db3fee5e045c2b4a9aff1f826fce8` | Empty, no results, loading, error; mobile filter sheet               |
| P8 · E3 Expense Form            | `77a264ee916a4e6a864b6efb55d15b03` | Add, edit and validation, desktop and mobile                         |
| P8 · E4 Expense Detail          | `9f578e8e3d664556ac9025267a0a1fd4` | Expense page with payments: partially paid, paid, no payments        |
| P8 · E5 Payment Form            | `853a073ef1674829aadae2c0755daf11` | Add, "Mark as fully paid", edit and validation                       |
| P8 · E6 Delete and Remove       | `f22fe6a8af354ab3b1b6e4af110be887` | Delete-expense and remove-payment confirmations, toasts              |
| P8 · E7 Dashboard Expenses      | `11246c813a0e4c5796c0dd737077e78b` | The dashboard **Expenses card** only, with its empty state           |
| P8 · E8 Event Add Expense       | `d8857ce4c71b43a7beb506e1d6909951` | "Add expense for this event" and the form with the event preselected |

Not approved: "P8 · Expenses Tracker (Desktop)" `05fdeb973bd0481a94ba758f95a052d4` and
"P8 · Expenses Tracker (Mobile)" `baa624d47ebb4c49a34deda926e54fcf`, screens Stitch made
without a prompt, with an "Export Statement" button and an unapproved layout. They are never
used.

## Decisions on additions Stitch made

1. **No "Remove payment" in the edit dialog (D1).** A payment is removed only from its row
   on the expense page, always with a confirmation.
2. **Before-and-after preview in "Remove this payment?" (D2).** The dialog shows the paid
   and pending amounts before and after, and the resulting status. It is calculated from the
   payments already loaded and changes no rule.

## Corrections applied in code

1. **Workspace shell:** every Phase 8 screen uses the approved Phase 3, 4 and 7 shell —
   sidebar with the wedding card, navigation and the user block with "Sign out"; on mobile
   the top bar and drawer. No horizontal top navigation (E2), no "Budget Settings",
   "Concierge Support", "Expenses & Budget" header, notification, search or help icons or
   "Bride Account" (E4), no mobile bottom tab bar, no footer inside the workspace. An
   **Expenses** item follows Tasks in the navigation.
2. **E1 desktop:** the button reads "Add an expense" with one plus icon; dates have no
   leading zero ("5 Jan 2027").
3. **E8:** the event date and time stay on one line where they fit, with no stray "•".
4. Stitch's specification annotations (for example "Specification Board", "Strict Hand-off",
   toast timings, haptic feedback, "Ceremonial Scope Selectors") are notes, not features.
5. Sample data in the screens (names, amounts, dates, counts) is illustrative only.

## Wording

The copy in these screens and the prompts is **draft**, awaiting the product owner's
review, as with Phases 4 and 7 (0019 #7, 0021, 0027).
