# 0013 — Task status reporting

**Status:** Accepted (resolution C5).

PRD v1.1 §26 and System Design v1.2 §26 define the task report buckets as completed,
pending, blocked and overdue. The approved statuses (0010 #3) map to them as follows:

| Status        | Report bucket                                                    |
| ------------- | ---------------------------------------------------------------- |
| `TODO`        | Pending                                                          |
| `IN_PROGRESS` | Pending                                                          |
| `BLOCKED`     | Blocked                                                          |
| `COMPLETED`   | Completed                                                        |
| `CANCELLED`   | Excluded from the Pending, Blocked, Completed and Overdue counts |

- A `CANCELLED` task is never overdue.
- Cancelled tasks remain available historically with status `CANCELLED`.
