# Decision records

Decisions that shape the implementation. The approved specifications live in
[`../specs/`](../specs/) and are not rewritten; where a decision supersedes a statement
in a specification, the record names that statement.

| ID                                                        | Decision                                                            | Status                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| [0001](0001-same-origin-api-proxy.md)                     | Browser reaches the API same-origin via a web proxy (A1)            | Accepted                                            |
| [0002](0002-one-backend-codebase-two-runtimes.md)         | One NestJS codebase and image, API and worker runtimes (A2)         | Accepted; amended by 0025                           |
| [0003](0003-documentation-structure.md)                   | Repository documentation structure (A3)                             | Accepted                                            |
| [0004](0004-specification-authority.md)                   | Specification authority and conflict resolution                     | Accepted                                            |
| [0005](0005-production-hosting.md)                        | Production hosting: Vercel web, containerized API/worker            | Accepted; amended by 0025                           |
| [0006](0006-backend-module-architecture.md)               | Backend module architecture                                         | Accepted                                            |
| [0007](0007-web-app-structure.md)                         | Web app structure                                                   | Accepted                                            |
| [0008](0008-guest-invitation-model.md)                    | One invitation token per guest; RSVP per event                      | Accepted; amended by 0017, 0018                     |
| [0009](0009-expense-sharing.md)                           | Expenses automatically shared; no visibility field                  | Accepted                                            |
| [0010](0010-approved-database-changes.md)                 | Approved database changes, applied per module (C4)                  | Accepted                                            |
| [0011](0011-pending-partner-sharing-decisions.md)         | Partner/Sharing decisions A4 and A5                                 | Accepted; answered by 0038                          |
| [0012](0012-wedding-ownership-and-membership.md)          | Wedding ownership and membership (C1, C2, N1)                       | Accepted; supplemented by 0034; amended by 0038     |
| [0013](0013-task-status-reporting.md)                     | Task status reporting (C5, N2)                                      | Accepted                                            |
| [0014](0014-design-system-and-home-page.md)               | Design system and marketing home page                               | Accepted                                            |
| [0015](0015-authentication.md)                            | Authentication (Phase 2)                                            | Accepted; amended by 0025                           |
| [0016](0016-wedding-setup.md)                             | Wedding setup and dashboard shell (Phase 3)                         | Accepted                                            |
| [0017](0017-phase-4-guests-and-invitations.md)            | Phase 4: events, guests, RSVP and invitations                       | Accepted; amended by 0018, 0019                     |
| [0018](0018-invitation-token-storage-and-guest-access.md) | Invitation token storage and guest-access rules                     | Accepted; amended by 0019, 0020                     |
| [0019](0019-phase-4-design-decisions.md)                  | Phase 4 design decisions                                            | Accepted; Q1 amended by 0034                        |
| [0020](0020-email-status-after-regeneration.md)           | Email status after regenerating an invitation link                  | Accepted                                            |
| [0021](0021-phase-4-design-approval.md)                   | Phase 4 design approval: screens and rules; wording draft           | Accepted; amended by 0022                           |
| [0022](0022-dashboard-api-contract.md)                    | Dashboard API contract (Phase 4)                                    | Accepted; amended by 0034                           |
| [0023](0023-phase-4-engineering-decisions.md)             | Phase 4 engineering decisions (retries, rate limits, order, opens)  | Accepted; #1 superseded by 0025                     |
| [0024](0024-live-updates.md)                              | Live updates on organizer screens (SSE)                             | Deferred (parked enhancement)                       |
| [0025](0025-vercel-only-hosting.md)                       | Vercel-only hosting: no worker, email sent directly                 | Accepted; amended by 0041                           |
| [0026](0026-phase-7-tasks.md)                             | Phase 7: tasks (scope, rules, list, dashboard)                      | Accepted; #14 amended by 0034, 0038                 |
| [0027](0027-phase-7-design-approval.md)                   | Phase 7 design approval: screens and corrections; wording draft     | Accepted                                            |
| [0028](0028-phase-8-expenses.md)                          | Phase 8: expenses (scope, money rules, payments, list, dashboard)   | Accepted; #19 amended by 0034                       |
| [0029](0029-phase-8-design-approval.md)                   | Phase 8 design approval: screens and corrections; wording draft     | Accepted                                            |
| [0030](0030-payments-by-former-members.md)                | Payments by a former member: the payer may be kept on edit          | Accepted                                            |
| [0031](0031-wording-approval.md)                          | Wording of Phases 4, 7 and 8 approved                               | Accepted                                            |
| [0032](0032-phase-9-vendors.md)                           | Phase 9: vendors (bookings, deletion rule, expense link, dashboard) | Accepted; supplemented by 0033; #19 amended by 0034 |
| [0033](0033-phase-9-design-approval.md)                   | Phase 9 design approval: screens, additions and corrections         | Accepted                                            |
| [0034](0034-phase-10-authorization.md)                    | Phase 10: organizers, roles and permissions (P10-1–P10-8)           | Accepted                                            |
| [0035](0035-phase-10-design-approval.md)                  | Phase 10 design approval: screens, UI decisions, corrections        | Accepted                                            |
| [0036](0036-invitation-for-an-existing-member.md)         | An invitation accepted by someone already a member                  | Accepted                                            |
| [0037](0037-phase-16-before-phases-11-15.md)              | Phase 16 before Phases 11–15                                        | Accepted                                            |
| [0038](0038-phase-16-partner-connection.md)               | Phase 16: partner connection and sharing (D1–D10)                   | Accepted; supplemented by 0039                      |
| [0039](0039-phase-16-design-approval.md)                  | Phase 16 design approval: screens and corrections                   | Accepted; #4 answered by 0040                       |
| [0040](0040-phase-16-wording-approval.md)                 | Wording approval for Phase 16                                       | Accepted                                            |
| [0041](0041-brevo-email-provider.md)                      | Brevo as an email provider, without a domain                        | Accepted                                            |

Conflicts between specifications or decision records are handled with the protocol in
[0004](0004-specification-authority.md) — never resolved silently in code.
