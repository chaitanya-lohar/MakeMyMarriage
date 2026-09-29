# 0010 — Approved database changes

**Status:** Accepted.

Each change is applied **when its module is implemented** — not as one up-front
migration — after re-checking the exact schema against the latest PRD, System Design,
Database Design and API Design. No fields or relationships are added beyond what is
listed here or in those documents.

| #   | Change                                                                              | Module        |
| --- | ----------------------------------------------------------------------------------- | ------------- |
| 1   | `guest_events.attendeeCount`                                                        | Guests/RSVP   |
| 2   | One guest-level invitation instead of guest-event-level (0008)                      | Invitations   |
| 3   | Task statuses `TODO`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `CANCELLED`            | Tasks         |
| 4   | Task notes and task attachments                                                     | Tasks         |
| 5   | Expense `eventId`                                                                   | Expenses      |
| 6   | Optional expense `vendorId`                                                         | Expenses      |
| 7   | Fixed expense category list including `OTHER`                                       | Expenses      |
| 8   | Remove expense `visibility` (0009)                                                  | Expenses      |
| 9   | Wedding fields such as `brideName`, `groomName`, `coverImage`, `theme`              | Weddings      |
| 10  | Event fields such as `dressCode`, `instructions`, `notes`, `coverImage`, `publicId` | Events        |
| 11  | Guest upload sessions / deletion-token storage                                      | QR/Memories   |
| 12  | Photo upload state / `publicId`                                                     | Gallery       |
| 13  | Member invitation token storage                                                     | Memberships   |
| 14  | Partner invitation token storage, as previously discussed                           | Partner       |
| 15  | Report export `storageKey` / `expiresAt`                                            | Reports       |
| 16  | Idempotency keys                                                                    | Platform      |
| 17  | User signup creates the user; wedding creation is a separate step                   | Auth/Weddings |
| 18  | One active `OWNER` wedding per user                                                 | Weddings      |

## Superseded statements

| #   | Source                                 | Statement                                                   | Resolution                                                                                                             |
| --- | -------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 3   | PRD v1.1 §16; System Design v1.2 §12.2 | Statuses: Todo, In Progress, Blocked, Completed             | `CANCELLED` added.                                                                                                     |
| 3   | Database Design v1.0 §13.1             | `status // TODO, IN_PROGRESS, COMPLETED, CANCELLED`         | `BLOCKED` added.                                                                                                       |
| 7   | Database Design v1.0 §12.1             | `categoryId?: ObjectId`, index `(weddingId, categoryId)`    | Fixed category list.                                                                                                   |
| 17  | System Design v1.2 §7.1                | "Register → … → create User → create one Wedding/workspace" | Registration creates only the user. The PRD user flow and API Design §6 already make wedding creation a separate step. |

## Details still to confirm

- The exact values of the fixed expense category list (#7).
- Whether `CANCELLED` tasks appear in the task report, whose PRD §26 buckets are
  completed, pending, blocked and overdue (#3).
