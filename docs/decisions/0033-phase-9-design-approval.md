# 0033 — Phase 9 design approval

**Status:** Accepted (approved by the product owner on 2026-10-24). The screens and rules
below are approved; the **wording stays draft**, as for Phases 4, 7 and 8 before 0031.

The Phase 9 screens were generated in Google Stitch (project `11709379677369700007`) from
prompts written against decision 0032 and the Phase 9 PRD v1.0. A first round was reviewed
and rejected (a booking delete button, the unapproved "Expenses & Budget" shell, invented
features); a second round, generated from corrected prompts that named the approved P7 and
P8 screens as references, was reviewed against 0032 and the PRD. No approved screen
contradicts an approved rule. The remaining corrections below are applied in code, following
the 0021, 0027 and 0029 precedent.

## Approved screens

| Screen                         | Stitch ID                          | Approved content                                                                      |
| ------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------- |
| P9 · V1 Vendors List           | `b55daf1e54f6452eb670eeb52975f5e5` | List, filters, booking summary, "matching booking" line, "Load more"; desktop, mobile |
| P9 · V2 Vendors States         | `bbfef2412fd84f9490bc9d0a26547a7f` | Empty, no results, loading, error; mobile filter sheet                                |
| P9 · V3 Vendor Form            | `a2fca35280a941459ca40d5ca361f854` | Add, edit, validation; desktop, mobile                                                |
| P9 · V4 Vendor Detail          | `9d9a3a4bca9c42ed85bf820a474b37fd` | Contact, bookings in the approved order, linked expenses, both variants               |
| P9 · V5 Booking Form           | `5f5ec889a7b744479f248b85fcebad56` | The booking **dialog** only: add, edit, cancelled, reopened, validation, mobile       |
| P9 · V6 Delete and Cancel      | `e92860288a0443f1bb8776ca57e440ff` | The **dialogs, row change and toasts** only: delete, refused, cancel, mobile          |
| P9 · V7 Dashboard Vendors Card | `026c0a29c32748ae9505b27bb8dbbd2e` | The dashboard **Vendors card** only, in its three states; desktop, mobile             |
| P9 · V8 Event Add Booking      | `d4b407325c4c40cc98c8f9c851b103ea` | "Add vendor booking" on the event page and its dialog, with the no-vendors state      |
| P9 · V9 Expense Vendor Field   | `f7d0c4191888444aa2afa933a4a30809` | The **vendor additions** only: the Vendor field, the link and the deleted variants    |

The pages behind the V5 and V6 dialogs are not approved: the vendor page is V4. On V9,
everything except the vendor additions follows the approved P8 · E3 and P8 · E4 unchanged.

Not approved: the first-round screens — V1 `09a5d8295e8342019e0e7b2d13e9105f` and
`c761329d833f4874ac27e1d043338698`, V2 `782820f44e764463aaf9705c8646981d`, V3
`b1242d5d174140e3bdd131f9c5f636ff`, V4 `f890a93521c348c2b32b0cb8ed4de951` and
`cb0b654a54b74798a955deadde1919fd`, V5 `bf5cc6b874c04508972c61a43faa60a0`, V6
`347ec6ef83df47e79f3636e11d069cfe`, V7 `9ed18ac31193452eb7d4f2f1077f6387`, V8
`c67418c8b0554dcc9a75cdcdae97e280` and V9 `5548df61ed6845a4b89d723088b345ac`. They are
never used.

## Product decisions made at design review

These supplement 0032 for the screens; the Phase 9 PRD is updated to match.

1. **Booking order (confirmed):** on the vendor page, bookings with a service date first,
   soonest first; bookings without one after them; ties newest created first. Cancelled
   bookings keep their place (Phase 9 PRD §6).
2. **Cancelling a booking is immediate (4A):** "Cancel booking" sets the status to Cancelled
   with no confirmation dialog and shows the toast "Booking cancelled."; the booking can be
   reopened.
3. **No vendors yet (5A):** "Add vendor booking" on the event page is always shown. When the
   wedding has no vendors, the dialog opens with an empty Vendor select reading "No vendors
   yet" and an "Add a vendor" link.

## Decisions on additions Stitch made

4. **No Undo on "Booking cancelled." (S1, rejected).** Reopening the booking is the way back.
5. **Reopening banner (S2, accepted).** Editing a cancelled booking shows "This booking is
   cancelled. Choose another status to reopen it." It is informational; the status is never
   changed automatically.
6. **Bookings listed in the refused-delete dialog (S3, accepted).** The dialog lists the
   bookings that are not cancelled — title, agreed price when present and status — from the
   bookings already loaded, and still says they must be cancelled first. It changes no rule.
7. **No total count (S4, rejected).** The vendor list shows no total ("25 Total", "Showing 6
   of 25"); the list API is cursor-based and returns none.

## Corrections applied in code

1. **Workspace shell:** every Phase 9 screen uses the approved shell of Phases 3, 4, 7 and 8 —
   the real sidebar wedding card (the screens vary it: "M&A" monograms, "Meera & Arjun"),
   no role labels under the user's name ("Organizer", "Planner Admin", "Bride", "Host &
   Bride"), no top bar, no mobile bottom tab bar (V6 mobile shows one), no footer inside the
   workspace. A **Vendors** item follows Expenses in the navigation.
2. **V2:** no subtitle under "Vendors" ("Manage contacts, quotes, and confirmed bookings"
   implies quotation tracking, which is not built — 0032 #5); V1 has none.
3. **V4 mobile:** the booking date is labelled "Booking date", not "Booked:", which reads as
   the Booked status.
4. **V6:** the blurred page behind the dialogs (a vendor "Active" chip, "archived in financial
   accounts") is not a design; vendors have no status. Buttons with a plus icon show it once
   ("Add booking").
5. **V7:** one "View all vendors" link; on mobile the metrics keep their full names (Active
   vendors, Booked vendors, Bookings needing follow-up) and wrap.
6. **V9:** the category is one of the eleven expense categories (the screen shows "Mehendi"),
   payment methods are the approved ones (no "NEFT": Bank transfer), and the payments list is
   the approved E4 list with payer, reference, notes and its actions.
7. **V3:** the length message "Use at most 150 characters." also applies to name and contact
   person (Phase 9 PRD §3.1), though the screen draws it only for the address and notes
   limits.
8. Stitch's frame tabs, headers and specification notes (for example "Production View",
   "Full Application Shell", "Desktop Viewport · 1440px Canvas", toast timings) are notes,
   not features.
9. Sample data in the screens (names, amounts, dates, counts) is illustrative only.

## Wording

The copy in these screens and the prompts is **draft**, awaiting the product owner's review
(0031 approved the wording of Phases 4, 7 and 8 only).
