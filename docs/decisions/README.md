# Decision records

Decisions that shape the implementation. The approved specifications live in
[`../specs/`](../specs/) and are not rewritten; where a decision supersedes a statement
in a specification, the record names that statement.

| ID                                                | Decision                                                    | Status   |
| ------------------------------------------------- | ----------------------------------------------------------- | -------- |
| [0001](0001-same-origin-api-proxy.md)             | Browser reaches the API same-origin via a web proxy (A1)    | Accepted |
| [0002](0002-one-backend-codebase-two-runtimes.md) | One NestJS codebase and image, API and worker runtimes (A2) | Accepted |
| [0003](0003-documentation-structure.md)           | Repository documentation structure (A3)                     | Accepted |
| [0004](0004-specification-authority.md)           | Specification authority and conflict resolution             | Accepted |
| [0005](0005-production-hosting.md)                | Production hosting: Vercel web, containerized API/worker    | Accepted |
| [0006](0006-backend-module-architecture.md)       | Backend module architecture                                 | Accepted |
| [0007](0007-web-app-structure.md)                 | Web app structure                                           | Accepted |
| [0008](0008-guest-invitation-model.md)            | One invitation token per guest; RSVP per event              | Accepted |
| [0009](0009-expense-sharing.md)                   | Expenses automatically shared; no visibility field          | Accepted |
| [0010](0010-approved-database-changes.md)         | Approved database changes, applied per module (C4)          | Accepted |
| [0011](0011-pending-partner-sharing-decisions.md) | Partner/Sharing decisions A4 and A5                         | Pending  |
| [0012](0012-wedding-ownership-and-membership.md)  | Wedding ownership and membership (C1, C2, N1)               | Accepted |
| [0013](0013-task-status-reporting.md)             | Task status reporting (C5, N2)                              | Accepted |
| [0014](0014-design-system-and-home-page.md)       | Design system and marketing home page                       | Accepted |

Conflicts between specifications or decision records are handled with the protocol in
[0004](0004-specification-authority.md) — never resolved silently in code.
