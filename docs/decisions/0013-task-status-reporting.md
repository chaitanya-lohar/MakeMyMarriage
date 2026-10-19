# 0013 — Task status reporting

**Status:** Accepted (resolutions C5 and N2). The overdue rule is clarified by 0026 #8: the
due date is a calendar date, and a task is overdue from the day after it.

PRD v1.1 §26 and System Design v1.2 §26 define the task report buckets as completed,
pending, blocked and overdue. The approved statuses (0010 #3) map to them as follows:

| Status        | Report bucket                                                    |
| ------------- | ---------------------------------------------------------------- |
| `TODO`        | Pending                                                          |
| `IN_PROGRESS` | Pending                                                          |
| `BLOCKED`     | Blocked                                                          |
| `COMPLETED`   | Completed                                                        |
| `CANCELLED`   | Excluded from the Pending, Blocked, Completed and Overdue counts |

- Cancelled tasks remain available historically with status `CANCELLED`.

## Overdue (N2)

Overdue is an **additional** reporting dimension, not a replacement for the status
buckets above.

```text
Overdue = dueDate is in the past
          AND status != COMPLETED
          AND status != CANCELLED
```

| Task                         | Counts as                |
| ---------------------------- | ------------------------ |
| `TODO`, past due date        | Pending + Overdue        |
| `IN_PROGRESS`, past due date | Pending + Overdue        |
| `BLOCKED`, past due date     | Blocked + Overdue        |
| `COMPLETED`                  | Completed; never Overdue |
| `CANCELLED`                  | No bucket; never Overdue |

A task can therefore count in both Pending and Overdue, or in both Blocked and Overdue.
