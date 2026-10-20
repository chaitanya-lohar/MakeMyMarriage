# Decision records

Decisions that shape the implementation. The approved specifications live in
[`../specs/`](../specs/) and are not rewritten; where a decision supersedes a statement
in a specification, the record names that statement.

| ID                                                        | Decision                                                           | Status                          |
| --------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------- |
| [0001](0001-same-origin-api-proxy.md)                     | Browser reaches the API same-origin via a web proxy (A1)           | Accepted                        |
| [0002](0002-one-backend-codebase-two-runtimes.md)         | One NestJS codebase and image, API and worker runtimes (A2)        | Accepted; amended by 0025       |
| [0003](0003-documentation-structure.md)                   | Repository documentation structure (A3)                            | Accepted                        |
| [0004](0004-specification-authority.md)                   | Specification authority and conflict resolution                    | Accepted                        |
| [0005](0005-production-hosting.md)                        | Production hosting: Vercel web, containerized API/worker           | Accepted; amended by 0025       |
| [0006](0006-backend-module-architecture.md)               | Backend module architecture                                        | Accepted                        |
| [0007](0007-web-app-structure.md)                         | Web app structure                                                  | Accepted                        |
| [0008](0008-guest-invitation-model.md)                    | One invitation token per guest; RSVP per event                     | Accepted; amended by 0017, 0018 |
| [0009](0009-expense-sharing.md)                           | Expenses automatically shared; no visibility field                 | Accepted                        |
| [0010](0010-approved-database-changes.md)                 | Approved database changes, applied per module (C4)                 | Accepted                        |
| [0011](0011-pending-partner-sharing-decisions.md)         | Partner/Sharing decisions A4 and A5                                | Pending                         |
| [0012](0012-wedding-ownership-and-membership.md)          | Wedding ownership and membership (C1, C2, N1)                      | Accepted                        |
| [0013](0013-task-status-reporting.md)                     | Task status reporting (C5, N2)                                     | Accepted                        |
| [0014](0014-design-system-and-home-page.md)               | Design system and marketing home page                              | Accepted                        |
| [0015](0015-authentication.md)                            | Authentication (Phase 2)                                           | Accepted; amended by 0025       |
| [0016](0016-wedding-setup.md)                             | Wedding setup and dashboard shell (Phase 3)                        | Accepted                        |
| [0017](0017-phase-4-guests-and-invitations.md)            | Phase 4: events, guests, RSVP and invitations                      | Accepted; amended by 0018, 0019 |
| [0018](0018-invitation-token-storage-and-guest-access.md) | Invitation token storage and guest-access rules                    | Accepted; amended by 0019, 0020 |
| [0019](0019-phase-4-design-decisions.md)                  | Phase 4 design decisions                                           | Accepted                        |
| [0020](0020-email-status-after-regeneration.md)           | Email status after regenerating an invitation link                 | Accepted                        |
| [0021](0021-phase-4-design-approval.md)                   | Phase 4 design approval: screens and rules; wording draft          | Accepted; amended by 0022       |
| [0022](0022-dashboard-api-contract.md)                    | Dashboard API contract (Phase 4)                                   | Accepted                        |
| [0023](0023-phase-4-engineering-decisions.md)             | Phase 4 engineering decisions (retries, rate limits, order, opens) | Accepted; #1 superseded by 0025 |
| [0024](0024-live-updates.md)                              | Live updates on organizer screens (SSE)                            | Deferred (parked enhancement)   |
| [0025](0025-vercel-only-hosting.md)                       | Vercel-only hosting: no worker, email sent directly                | Accepted                        |
| [0026](0026-phase-7-tasks.md)                             | Phase 7: tasks (scope, rules, list, dashboard)                     | Accepted                        |
| [0027](0027-phase-7-design-approval.md)                   | Phase 7 design approval: screens and corrections; wording draft    | Accepted                        |
| [0028](0028-phase-8-expenses.md)                          | Phase 8: expenses (scope, money rules, payments, list, dashboard)  | Accepted                        |
| [0029](0029-phase-8-design-approval.md)                   | Phase 8 design approval: screens and corrections; wording draft    | Accepted                        |

Conflicts between specifications or decision records are handled with the protocol in
[0004](0004-specification-authority.md) — never resolved silently in code.
