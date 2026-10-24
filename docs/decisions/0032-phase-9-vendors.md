# 0032 — Phase 9: vendors

**Status:** Accepted (approved by the product owner on 2026-10-24). Answers P9-VEN-Q01–Q12
and confirmations A–J from the Phase 9 discovery; the full specification is the
[Phase 9 PRD v1.0](../specs/PHASE_9_PRD_v1.0.md).

Phase 9 builds the vendor management of PRD v1.2 §17 and its dashboard summary (§18), and
activates the optional expense vendor link kept in the data model since Phase 8 (0010 #6,
0028 #4). It replaces the planned single vendor record (Database Design §14, API Design §14)
with wedding-scoped vendors and their bookings, and defers what needs another decision first:
vendor discovery, file storage and access across weddings.

The discovery input was the working draft "MakeMyMarriage Phase 9 Vendors PRD Draft v0.1"
(24 October 2026, kept outside this repository). Where it and this record differ, this
record and the Phase 9 PRD win; the draft is not used for implementation.

## Decisions

### Scope

1. **In scope:** a vendor directory per wedding (create, view, edit, soft-delete); several
   bookings per vendor (create, view, edit, cancel, reopen); the vendor link on expenses;
   the dashboard vendor summary; a **Vendors** navigation item; an event shortcut.
2. **Out of scope:** vendor discovery (3); attachments (6); copying vendors between weddings
   (7); quotation tracking and history (5); contracts and documents; a vendor payment ledger
   (8); reminders (Phase 14); reports and export (Phase 15); fine-grained permissions (Phase
   10); a public marketplace, public profiles, reviews or ratings; vendor details on the
   public website.
3. **Discovery deferred (Q01):** Google Places discovery, `googlePlaceId`, the three
   `vendor-discovery` routes and "Add to My Vendors" are not built in Phase 9. They stay in
   the designs, marked Deferred until a decision brings them back.

### Model

4. **Vendor and booking (Q02):** a vendor is a wedding-scoped profile with contact details.
   A booking is one service from that vendor, with its own status, event (or the whole
   wedding), booking date, service date, agreed price and notes. A vendor can have any number
   of bookings. The planned vendor-level `status`, `eventIds`, `quotationAmountMinor` and
   `finalAmountMinor` are removed.
5. **Money (Q04):** one optional **agreed price** per booking, integer paise, more than ₹0 and
   at most ₹10 crore when present, following 0028 #6. There is no quotation amount, final
   amount or quotation history.
6. **Attachments deferred (Q05)** until a project-wide file-storage decision, as for task
   attachments (0026 #3) and receipts (0028 #3). `vendor_attachments` and its upload route
   stay in the designs, marked Deferred.
7. **Copying vendors deferred (Q06)** until a user can belong to more than one wedding
   (Phase 10 or Phase 16). Today a user has at most one wedding (0012), so there is nothing to
   copy from.
8. **Expenses (Q07):** Phase 8 Expenses stays the source of truth for amounts, payments,
   payers and payment status. The existing `expenses.vendorId` is accepted by the API and set
   through an optional vendor picker on the expense form. There is **no `expense.bookingId`**.
   An expense works with or without a vendor.

### Fields

9. **Categories (Q12):** one fixed value — Venue; Catering; Photography & Videography;
   Decoration & Flowers; Makeup & Beauty; Clothing & Jewellery; Entertainment & DJ;
   Invitations & Printing; Transportation; Wedding Planner; Mehendi; Other. Marriage gardens
   are classified as Venue. The list is separate from the expense categories (0010 #7).
10. **Vendor fields (C):** name (required, 1–150 characters); category (required); contact
    person (optional, at most 150); phone (optional, the guest mobile rule: 7–15 digits,
    optional leading `+`, spaces and hyphens allowed); email (optional, valid format); address
    (optional, at most 500); website (optional, an `http` or `https` URL); notes (optional, at
    most 1,000).
11. **Booking fields (D):** title (required, 1–150); status (defaults to Not contacted);
    booking date (optional); service date (optional, past or future); event (optional; empty
    means the whole wedding); agreed price (optional, rule 5); notes (optional, at most
    1,000). **A booking's vendor cannot be changed** after it is created.

### Behaviour

12. **Statuses (Q03):** Not contacted, Contacted, Quotation received, Negotiating, Booked,
    Cancelled. There is no Completed.
13. **Status changes (A):** any status may change to any other, including reopening a
    Cancelled booking. No reason is required; audit entries keep the history.
14. **Removing a booking (Q09):** by cancelling it only. There is no booking deletion; a
    cancelled booking stays on the vendor's page and in the audit history.
15. **Deleting a vendor (Q08):** a confirmed soft delete, refused while the vendor has any
    booking that is not cancelled; the user cancels those bookings first. A deleted vendor
    leaves every list, picker and route; its bookings, and the expenses and payments linked to
    it, are kept unchanged.
16. **Deleted events (E):** when an event is deleted, its bookings become whole-wedding
    bookings, and each change is audited, as for tasks (0026 #12) and expenses (0028 #17).
17. **Deleted vendors on expenses (I):** the expense vendor picker lists active vendors only.
    An expense linked to a vendor that is later deleted keeps the link and shows the vendor as
    "Name (deleted)". On edit that link may be kept or removed, but a deleted vendor cannot be
    newly selected — the same rule 0030 applies to former members.
18. **Audit, no timeline (Q10):** creating, editing and deleting a vendor; creating and
    editing a booking; every status change; the event link removed by a deleted event; and
    changes to an expense's vendor are written to `audit_logs`. No vendor or booking history
    is shown in Phase 9 (the Phase 8 pattern, 0028 #18).
19. **Access:** any `ACTIVE` member of the wedding can view, create, edit, cancel and delete
    its vendors and bookings. Everything else returns `404`, as for other wedding routes.
    Vendor details are private management data and never appear on the public website.
    Fine-grained permissions arrive in Phase 10.

### Screens

20. **Vendor list (G):** one list, 25 vendors at a time with "Load more".
    - Search by vendor name; filters: category, booking status and event (including "Whole
      wedding"). The status and event filters apply to bookings: a vendor appears when **any**
      of its bookings matches, and the screen says so.
    - Order: name A–Z only.
    - Row: name, category, contact details when present, and a booking summary such as
      "1 booked · 2 in progress". Cancelled bookings are not counted in the summary.
21. **Vendor page (H):** contact details, notes, every booking (cancelled ones marked) and the
    linked expenses (title, amount, payment status, each linking to its expense). No vendor
    money totals. Bookings are managed here; there is no separate bookings page. One
    **Vendors** navigation item.
22. **Event shortcut (F):** "Add vendor booking" on the event page, with that event
    preselected and still changeable.
23. **Expense form (Q07, I):** an optional vendor picker. The expense list gets no vendor
    filter in Phase 9.
24. **Dashboard (Q11, B, J):** computed on every request, with no background job.
    - **Active vendors:** vendors that are not deleted.
    - **Booked vendors:** distinct vendors that are not deleted with at least one Booked
      booking.
    - **Bookings needing follow-up:** bookings in Not contacted, Contacted or Negotiating.
      Quotation received is not counted.
    - **Upcoming booked services:** up to five Booked bookings with a service date of today or
      later in the wedding's timezone (`Asia/Kolkata`), soonest first. Bookings without a
      service date never appear.
    - With no vendors, the card shows "No vendors yet" and an "Add a vendor" link.

## Superseded and clarified statements

| Source                                          | Statement                                                                                     | Resolution                                                                 |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| PRD v1.2 §17                                    | Vendor records include status, associated events, quotation and final cost, and attachments   | Status, event and price move to bookings (4, 5); attachments deferred (6). |
| PRD v1.2 §17                                    | Status: Prospect, Contacted, Quotation received, Negotiating, Confirmed, Completed, Cancelled | Booking statuses as in 12.                                                 |
| PRD v1.2 §17                                    | Vendor discovery through Google Places; "Add to My Vendors"                                   | Deferred (3).                                                              |
| PRD v1.2 §30                                    | Vendor management depth: detailed workflow deferred                                           | Settled for Phase 9 by this record.                                        |
| Database Design v1.1 §14.1                      | `wedding_vendors` with `status`, `eventIds`, quotation and final amounts, `googlePlaceId`     | Removed (3, 4, 5); bookings in `vendor_bookings`.                          |
| Database Design v1.1 §14.2                      | `vendor_attachments` with S3 storage keys                                                     | Deferred (6).                                                              |
| Database Design v1.1 §19                        | Vendor → events: reference IDs                                                                | Each booking references one event or none (11).                            |
| Database Design v1.1 §12.1; API Design v1.1 §12 | `vendorId` kept but not accepted or set (0028 #4)                                             | Accepted and set (8, 17).                                                  |
| API Design v1.1 §14                             | Attachment upload and vendor-discovery routes                                                 | Deferred (3, 6); booking routes added.                                     |
| System Design v1.3 §13, §20                     | Discovery through Google Places; vendor attachments in S3                                     | Deferred (3, 6).                                                           |
| Phase 4 PRD v1.2 §3.2                           | Deleting an event: effects on RSVPs, invitations, tasks and expenses                          | Its vendor bookings also become whole-wedding bookings (16).               |
| Phase 8 PRD v1.0 §3.1, §12                      | Vendor not in Phase 8; vendor linking in Phase 9                                              | The vendor link is built in Phase 9 (8, 17, 23).                           |
| 0010 #6                                         | Optional expense `vendorId`                                                                   | Activated (8); no `bookingId`.                                             |
