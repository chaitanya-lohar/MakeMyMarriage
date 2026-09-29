# 0010 — Approved database changes

**Status:** Accepted, except #7 (expense category values), which is pending (C4).

Each change is applied **when its module is implemented** — not as one up-front
migration — after re-checking the exact schema against the latest PRD, System Design,
Database Design and API Design. No fields or relationships are added beyond what is
listed here or in those documents.

| #   | Change                                                                              | Module        | See       |
| --- | ----------------------------------------------------------------------------------- | ------------- | --------- |
| 1   | `guest_events.attendeeCount`                                                        | Guests/RSVP   |           |
| 2   | One guest-level invitation instead of guest-event-level                             | Invitations   | 0008      |
| 3   | Task statuses `TODO`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `CANCELLED`            | Tasks         | 0013      |
| 4   | Task notes and task attachments                                                     | Tasks         |           |
| 5   | Expense `eventId`                                                                   | Expenses      |           |
| 6   | Optional expense `vendorId`                                                         | Expenses      |           |
| 7   | Fixed expense category list — **values pending (C4)**                               | Expenses      | below     |
| 8   | Remove expense `visibility`                                                         | Expenses      | 0009      |
| 9   | Wedding fields such as `brideName`, `groomName`, `coverImage`, `theme`              | Weddings      |           |
| 10  | Event fields such as `dressCode`, `instructions`, `notes`, `coverImage`, `publicId` | Events        |           |
| 11  | Guest upload sessions / deletion-token storage                                      | QR/Memories   |           |
| 12  | Photo upload state / `publicId`                                                     | Gallery       |           |
| 13  | Member invitation token storage                                                     | Memberships   |           |
| 14  | Partner invitation token storage, as previously discussed                           | Partner       |           |
| 15  | Report export `storageKey` / `expiresAt`                                            | Reports       |           |
| 16  | Idempotency keys                                                                    | Platform      |           |
| 17  | User signup creates the user; wedding creation is a separate step                   | Auth/Weddings | 0012 (C2) |
| 18  | At most one `OWNER` membership per user, across all weddings                        | Weddings      | 0012 (C1) |

## Superseded statements

| #   | Source                                 | Statement                                                   | Resolution                                 |
| --- | -------------------------------------- | ----------------------------------------------------------- | ------------------------------------------ |
| 3   | PRD v1.1 §16; System Design v1.2 §12.2 | Statuses: Todo, In Progress, Blocked, Completed             | `CANCELLED` added.                         |
| 3   | Database Design v1.0 §13.1             | `status // TODO, IN_PROGRESS, COMPLETED, CANCELLED`         | `BLOCKED` added.                           |
| 17  | System Design v1.2 §7.1                | "Register → … → create User → create one Wedding/workspace" | Registration creates only the user (0012). |

## #7 — Expense categories (C4): pending

The documents do not define an unambiguous category list, and none documents an `OTHER`
expense category. No list is chosen until one is approved.

| Source                              | Text                                                                                                                                                                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRD v1.1 §15 (latest)               | "Title, amount, category, date, optional event, paid by, …" — a category field, no values.                                                                                                                                 |
| System Design v1.2 §12.1            | "amount, category, date, …" — no values.                                                                                                                                                                                   |
| Database Design v1.0 §12.1          | `categoryId?: ObjectId` — a reference to a category record, but no category collection is defined anywhere in the document.                                                                                                |
| Database Design v1.0 §20            | Index `(weddingId, categoryId)` for category filtering.                                                                                                                                                                    |
| API Design v1.0 §24                 | Expense list filter `?categoryId=…`.                                                                                                                                                                                       |
| PRD v1.0 §15 (older — context only) | "Categories **can include** venue, catering, decoration, photography, clothing, jewellery, makeup, entertainment, invitations, gifts, and miscellaneous." — an open-ended example list; uses "miscellaneous", not `OTHER`. |

`OTHER` appears in the documents only as an expense **payment method**
(Database Design §12.2), not as a category.

If a fixed list is approved, it also replaces `categoryId` with a category value in the
schema (Database Design §12.1, §20) and the list filter (API Design §24).
