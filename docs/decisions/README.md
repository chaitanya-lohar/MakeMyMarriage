# Decision records

Decisions that shape the implementation. The approved specifications live in
[`../specs/`](../specs/); where a decision here refines a specification, the decision
record says so explicitly.

| ID                                                | Decision                                               | Status   |
| ------------------------------------------------- | ------------------------------------------------------ | -------- |
| [0001](0001-same-origin-api-proxy.md)             | Browser reaches the API same-origin via a web proxy    | Accepted |
| [0002](0002-one-backend-codebase-two-runtimes.md) | One NestJS codebase and image, API and worker runtimes | Accepted |
| [0003](0003-documentation-structure.md)           | Repository documentation structure                     | Accepted |
| [0004](0004-v1-product-clarifications.md)         | V1 product and contract clarifications                 | Accepted |
| [0005](0005-pending-partner-sharing-decisions.md) | Partner/Sharing decisions A4 and A5                    | Pending  |

When the specifications conflict with each other, the conflict is raised for a decision
and recorded here — it is never resolved silently in code.
