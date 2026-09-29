# 0010 — Approved database changes

**Status:** Accepted (includes resolution C4).

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
| 7   | Fixed expense category list: `category: ExpenseCategory` (C4)                       | Expenses      | below     |
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

## #7 — Expense categories (C4)

The expense category is a fixed value, `category: ExpenseCategory`, not a `categoryId`
referencing a category collection — V1 defines no expense-category collection.

```text
ExpenseCategory =
  VENUE | CATERING | DECORATION | PHOTOGRAPHY | CLOTHING | JEWELLERY |
  MAKEUP | ENTERTAINMENT | INVITATIONS | GIFTS | MISCELLANEOUS
```

- `MISCELLANEOUS` is used, not `OTHER`: the source list (PRD v1.0 §15) says
  "miscellaneous", and `OTHER` is documented only as a payment method (Database Design
  §12.2).
- No other categories (for example transportation, accommodation, videography or music)
  are added unless the list is explicitly expanded later.

### Sources and superseded statements

| Source                                 | Statement                                                                                                                                             | Resolution                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| PRD v1.0 §15 (older)                   | "Categories can include venue, catering, decoration, photography, clothing, jewellery, makeup, entertainment, invitations, gifts, and miscellaneous." | Adopted as the fixed V1 list.                                |
| PRD v1.1 §15; System Design v1.2 §12.1 | Expense has a "category" — no values                                                                                                                  | Values defined by this record.                               |
| Database Design v1.0 §12.1             | `categoryId?: ObjectId`                                                                                                                               | Replaced by `category: ExpenseCategory`.                     |
| Database Design v1.0 §20               | Index `(weddingId, categoryId)`                                                                                                                       | Indexes the `category` value instead.                        |
| API Design v1.0 §24                    | Expense list filter `?categoryId=…`                                                                                                                   | Filters by `category` value instead; the route is unchanged. |
