# MakeMyMarriage — Phase 9 PRD v1.0: vendors

| Item         | Value                                                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status       | **Canonical** for Phase 9. Approved scope and screens (0033); implementation merged to `main` in PR #31.                                                                                                      |
| Date         | 2026-10-24                                                                                                                                                                                                    |
| Parent       | [PRD v1.2](PRD_v1.2.md) (sections 15, 17 and 18)                                                                                                                                                              |
| Decision     | [0032](../decisions/0032-phase-9-vendors.md), with 0010 #6, [0028](../decisions/0028-phase-8-expenses.md) and [0030](../decisions/0030-payments-by-former-members.md)                                         |
| Contracts    | [Database Design v1.1](DB_DESIGN_v1.1.md) §12.1 and §14, [API Design v1.1](API_DESIGN_v1.1.md) §6, §12 and §14                                                                                                |
| Out of scope | Vendor discovery, attachments, copying vendors between weddings, quotations and contracts, a vendor payment ledger, reminders, reports and export, fine-grained permissions, a public marketplace or profiles |

| Version | Date       | Change                                                     |
| ------- | ---------- | ---------------------------------------------------------- |
| 1.0     | 2026-10-24 | First version, from the Phase 9 discovery (decision 0032). |
| 1.0     | 2026-10-24 | §4.2, §10: screens approved in Stitch (decision 0033).     |

## 1. Purpose and outcomes

Give each wedding one organized place for its vendors — who they are, how to reach them —
and for every service booked from them, for the whole wedding or one event, from the first
contact to the confirmed booking. Money stays in Expenses: a vendor's advances and payments
are recorded as expenses linked to the vendor, never in a second ledger.

## 2. Governing rules

- Vendors and bookings belong to exactly one wedding. Every route is wedding-scoped and
  admits only `ACTIVE` members; anything else is `404` (System Design §7.2).
- Any active member can do everything with a wedding's vendors and bookings in Phase 9
  (0032 #19). Vendor details are private management data and never appear on the public
  website. Fine-grained permissions arrive in Phase 10.
- Money is integer paise, rupees only (0028 #6). No floating-point arithmetic for money.
- Dates are calendar dates in the wedding's timezone (`Asia/Kolkata`), as for events, tasks
  and expenses. Nothing is scheduled (0025).
- Expenses are the source of truth for amounts and payments (0032 #8).
- Deleting a vendor is soft and refused while it has bookings that are not cancelled;
  bookings are cancelled, never deleted. Changes are audited.

## 3. Fields

### 3.1 Vendor

| Field          | Rule                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------ |
| Name           | Required; trimmed; 1–150 characters.                                                             |
| Category       | Required; one of the twelve in §3.3.                                                             |
| Contact person | Optional; at most 150 characters.                                                                |
| Phone          | Optional; 7–15 digits; optional leading `+`; spaces and hyphens allowed (the guest mobile rule). |
| Email          | Optional; a valid email address; at most 254 characters.                                         |
| Address        | Optional; at most 500 characters.                                                                |
| Website        | Optional; an absolute `http` or `https` URL; at most 500 characters.                             |
| Notes          | Optional; at most 1,000 characters.                                                              |

- Text fields are trimmed; an empty optional field is stored as absent. The email is stored
  lower-cased.
- System fields: created by and at, updated at, deleted by and at.
- Not in Phase 9: Google place ID (0032 #3), attachments (0032 #6), a vendor-level status,
  events or amounts (0032 #4).

### 3.2 Booking

| Field        | Rule                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------- |
| Vendor       | Required; an active vendor of the same wedding. Cannot be changed after creation (0032 #11). |
| Title        | Required; trimmed; 1–150 characters (for example "Mehendi artist for the Mehendi night").    |
| Status       | Required; defaults to **Not contacted** (§3.4).                                              |
| Booking date | Optional; past or future allowed.                                                            |
| Service date | Optional; past or future allowed.                                                            |
| Event        | Optional; an active event of the same wedding. Empty means a whole-wedding booking.          |
| Agreed price | Optional; rupees with at most two decimals; more than ₹0 and at most ₹10,00,00,000.          |
| Notes        | Optional; at most 1,000 characters.                                                          |

- System fields: created by and at, updated at.

### 3.3 Categories

`VENUE` (Venue — includes marriage gardens), `CATERING` (Catering),
`PHOTOGRAPHY_VIDEOGRAPHY` (Photography & Videography), `DECORATION_FLOWERS` (Decoration &
Flowers), `MAKEUP_BEAUTY` (Makeup & Beauty), `CLOTHING_JEWELLERY` (Clothing & Jewellery),
`ENTERTAINMENT_DJ` (Entertainment & DJ), `INVITATIONS_PRINTING` (Invitations & Printing),
`TRANSPORTATION` (Transportation), `WEDDING_PLANNER` (Wedding Planner), `MEHENDI` (Mehendi),
`OTHER` (Other). This list is separate from the expense categories (0032 #9).

### 3.4 Booking statuses

| Status                                    | Meaning                                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| Not contacted (`NOT_CONTACTED`)           | No outreach yet; the default.                                                |
| Contacted (`CONTACTED`)                   | The vendor has been contacted.                                               |
| Quotation received (`QUOTATION_RECEIVED`) | The vendor has sent a quotation (its amount is not tracked — 0032 #5).       |
| Negotiating (`NEGOTIATING`)               | Terms are being discussed.                                                   |
| Booked (`BOOKED`)                         | The service is confirmed.                                                    |
| Cancelled (`CANCELLED`)                   | No longer pursued; kept for history; counted nowhere except the vendor page. |

- Any status may change to any other, including reopening a Cancelled booking. No reason is
  required (0032 #13). There is no Completed status.

## 4. Behaviour

### 4.1 Vendors

- Create from the Vendors page. Every field in §3.1 can be edited.
- **Delete** asks for confirmation, then soft-deletes the vendor: it leaves the list, the
  pickers, the dashboard and its routes (`404`).
- **Delete is refused while the vendor has any booking that is not cancelled** (0032 #15).
  The confirmation explains how many bookings must be cancelled first; the API returns
  `409 VENDOR_HAS_ACTIVE_BOOKINGS`. A booking created or reopened at the same moment as the
  deletion cannot slip through: one of the two requests fails (§9).
- A deleted vendor's bookings stay in the database, and the expenses and payments linked to
  it are unchanged.

### 4.2 Bookings

- Create from the vendor's page (the vendor is fixed), or from "Add vendor booking" on an
  event page, where the form asks for the vendor (active vendors only) and preselects the
  event, which can still be changed (0032 #22). "Add vendor booking" is always shown; when
  the wedding has no vendors, the form's Vendor select reads "No vendors yet" and offers an
  "Add a vendor" link (0033 #3).
- Every field in §3.2 except the vendor can be edited. Changing or clearing the event moves
  the booking between events and the whole wedding.
- **Cancelling** sets the status to Cancelled immediately, with no confirmation dialog, and
  shows "Booking cancelled." (0033 #2). A cancelled booking stays on the vendor's page,
  marked, and can be reopened by changing its status; editing it shows a short note that it
  is cancelled (0033 #5). Bookings are never deleted (0032 #14).
- When a vendor cannot be deleted (§4.1), the message lists the bookings that are not
  cancelled, with title, agreed price when present and status (0033 #6).

### 4.3 Deleted events

- When an event is deleted, every booking linked to it becomes a whole-wedding booking, and
  an audit entry records the removed link for each (0032 #16).

### 4.4 Expenses

- The expense form (Phase 8 PRD §3.1) gets an optional **Vendor** field: a picker of the
  wedding's active vendors, or none (0032 #8).
- An expense whose vendor is later deleted keeps the link and shows "Name (deleted)" on the
  expense page and form. On edit that vendor may be kept or removed, but a deleted vendor
  cannot be newly selected (0032 #17, as 0030 for payers).
- Linking or unlinking a vendor changes nothing about the expense's amount, payments or
  status. The expense list gets no vendor filter in Phase 9.

### 4.5 Audit

- Written to `audit_logs` with actor and time: vendor created, edited (the changed fields),
  deleted; booking created, edited (the changed fields); booking status changed (old and new
  status, including cancelling and reopening); booking event link removed by a deleted
  event. An expense's vendor change is part of the existing expense-edit entry (0028 #18).
- No vendor or booking history is shown in Phase 9 (0032 #18).

## 5. Vendor list

- One list; 25 vendors at a time with "Load more", like the task and expense lists (0032 #20).
- **Row:** name; category; contact person, phone and email when present; booking summary,
  "_n_ booked · _m_ in progress", where in progress counts Not contacted, Contacted,
  Quotation received and Negotiating. Cancelled bookings are not counted. A vendor with no
  counted bookings shows "No bookings".
- **Filters** (combinable):
  - Search: vendor name contains the text, ignoring case.
  - Category.
  - Booking status.
  - Event, including **Whole wedding**.
  - The status and event filters apply to bookings: a vendor is listed when **at least one**
    of its bookings matches every booking filter set. A line above the results says so.
- **Order:** name A–Z, ignoring case; stable across "Load more".
- States: loading; empty (no vendors yet, with "Add a vendor"); no results for the filters
  (with "Clear filters"); error with retry.

## 6. Vendor page

- Contact details, category and notes.
- **Bookings:** every booking of the vendor, cancelled ones included and marked — title,
  status, event name or **Whole wedding**, booking date, service date, agreed price. Ordered by
  service date, soonest first, bookings without a service date last, then newest created
  first.
- **Linked expenses:** every expense linked to the vendor that is not deleted — title, amount,
  payment status — each opening the expense; expense date, newest first. No totals (0032
  #21).
- Actions: edit vendor; delete vendor (with confirmation, §4.1); add booking; edit a booking;
  cancel or reopen a booking.

## 7. Dashboard summary

Added to the existing dashboard (PRD §18; API Design §6), computed on every request (0032
#24):

- **Active vendors:** vendors that are not deleted.
- **Booked vendors:** distinct vendors that are not deleted with at least one `BOOKED`
  booking.
- **Bookings needing follow-up:** bookings of vendors that are not deleted in `NOT_CONTACTED`,
  `CONTACTED` or `NEGOTIATING`. `QUOTATION_RECEIVED` is not counted.
- **Upcoming booked services:** at most five `BOOKED` bookings of vendors that are not
  deleted, with a service date today or later in the wedding's timezone; service date
  soonest first, then the earliest created. Each shows the booking title, vendor name,
  service date and event name or **Whole wedding**. Bookings without a service date never
  appear.
- **No vendors:** "No vendors yet" and an "Add a vendor" link.

## 8. API and data

- Routes: API Design §14; the expense vendor field in §12; the dashboard fields in §6.
- Data: Database Design §14 — `wedding_vendors` and `vendor_bookings`; `expenses.vendorId`
  (§12.1). `vendor_attachments` and discovery are deferred.
- Errors follow API Design §21: `404` for a vendor, booking, event or expense outside the
  wedding or deleted (`VENDOR_NOT_FOUND`, `VENDOR_BOOKING_NOT_FOUND`, `EVENT_NOT_FOUND`);
  `400 VALIDATION_FAILED` with field errors for invalid input; `409
VENDOR_HAS_ACTIVE_BOOKINGS` for §4.1.

## 9. Consistency

- Creating a booking, and changing a booking's status away from Cancelled, write to the
  vendor inside the same transaction, as linking to an event does today (0026 #12, 0028
  #17). Deleting the vendor checks its bookings and sets the deletion inside a transaction.
  The two therefore conflict, and the vendor is never deleted with a booking that is not
  cancelled.
- Linking a booking to an event claims the event in the same transaction, so a concurrent
  event deletion cannot leave a booking linked to a deleted event.
- Linking an expense to a vendor that is deleted at the same moment is harmless: the link
  is kept and shown as deleted (§4.4).

## 10. UI

- A **Vendors** item in the workspace navigation, after Expenses (PRD §29).
- Screens: approved in Stitch (decision 0033, with its corrections) — vendor list (filters,
  booking summary, states), add and edit vendor, vendor page (bookings and linked
  expenses), the booking dialog (from the vendor page and from the event shortcut, with the
  vendor picker and the no-vendors state), cancel and reopen, the delete confirmation and
  its refused state, the vendor field on the expense form and page (including "Name
  (deleted)"), the dashboard vendor card, and the "Add vendor booking" shortcut on the event
  page — on desktop and mobile. The vendor list shows no total count (0033 #7).
- The UI never implies a vendor has one status: it shows each booking's status and the
  booking summary.
- Reuse the workspace design system and the patterns of Phases 3, 4, 7 and 8 (forms, confirm
  dialog, toasts, the date picker, "Load more", Indian number format).
- Long names and titles wrap; actions stay reachable on small screens; every control is
  keyboard-accessible with visible focus.
- Wording is drafted with the screens and approved separately (as in 0031).

## 11. Acceptance criteria

1. A member creates a vendor with only a name and a category.
2. A name over 150 characters, a contact person over 150, an address over 500, notes over
   1,000, an invalid phone, email or website, or an unknown category is rejected by the form
   and the API.
3. A vendor can have several bookings, each with its own status, dates, event, price and
   notes; a new booking is Not contacted and whole-wedding.
4. A booking title over 150 characters, notes over 1,000, an agreed price of ₹0, more than
   ₹10 crore or with more than two decimals, or an unknown status is rejected; ₹75,000.50 is
   stored as 7500050 paise.
5. Any status can change to any other, including reopening a Cancelled booking.
6. A booking's vendor cannot be changed; a booking cannot be added to a deleted vendor.
7. An event of another wedding, or a deleted event, is rejected for a booking.
8. Deleting a vendor with a booking that is not cancelled is refused with
   `409 VENDOR_HAS_ACTIVE_BOOKINGS`; once every booking is cancelled, it succeeds, and a
   booking created or reopened concurrently cannot leave a deleted vendor with an active
   booking.
9. A deleted vendor disappears from the list, pickers, dashboard and its routes; its bookings
   and linked expenses and payments remain unchanged.
10. Deleting an event turns its bookings into whole-wedding bookings and writes an audit entry
    for each.
11. An expense can be saved with an active vendor or none; a deleted vendor or another
    wedding's vendor is rejected; an expense linked to a vendor that is later deleted keeps
    the link, shows "Name (deleted)", and can keep or remove it on edit.
12. Vendor, booking, status and expense-vendor changes write audit entries.
13. Search, filters and order combine and stay stable across "Load more"; a vendor appears
    when one of its bookings matches the booking filters.
14. The dashboard counts and upcoming services follow §7; Quotation received is not counted as
    needing follow-up; cancelled bookings and bookings without a service date never appear in
    upcoming services.
15. A non-member gets `404` for every vendor, booking and dashboard route, and no vendor of
    another wedding is visible or selectable anywhere.

## 12. Deferred or open

- Vendor discovery (Google Places) — deferred by 0032 #3.
- Attachments — with a file-storage decision (0032 #6).
- Copying vendors between weddings — Phase 10 or 16 (0032 #7).
- Quotation amounts and history, contracts and documents — not planned in Phase 9.
- Reminders — Phase 14. Reports and export — Phase 15. Fine-grained permissions — Phase 10.
- A vendor filter on the expense list — not in Phase 9.

## 13. Definition of done

- Code, database and API match this PRD, decision 0032, Database Design v1.1 and API Design
  v1.1, all under `/api/v1`.
- Automated tests pass for behaviour, validation, the deletion guard (including concurrent
  booking changes), the event-deletion effect, the expense vendor link, the dashboard rules,
  authorization and tenant isolation.
- The UI implements only approved fields and states, from approved Stitch screens.
- `PROJECT_STATUS.md` and the documentation index are updated when the phase is merged.
