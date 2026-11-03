# 0026 — Phase 7: tasks

**Status:** Accepted (approved by the product owner on 2026-10-19; #20 amended on
2026-10-20; #14 amended by [0034](0034-phase-10-authorization.md) on 2026-10-27 and by
[0038](0038-phase-16-partner-connection.md) on 2026-11-03). Answers
P7-TASK-Q01–Q26
and R1–R3 from the Phase 7 discovery; the full specification is the
[Phase 7 PRD v1.0](../specs/PHASE_7_PRD_v1.0.md).

Phase 7 builds the task planner of PRD v1.2 §16 and its dashboard summary (§18). It keeps
the approved statuses and reporting rules (0010 #3, 0013) and the planned data model and
routes (Database Design §13, API Design §13), and settles what those left open.

## Decisions

### Scope

1. **In scope (Q01):** the task list; create, edit, change status, cancel and delete; an
   optional link to one event; the task's activity history; a **Tasks** navigation item; the
   dashboard task summary.
2. **Out of scope (Q01, Q16, Q23–Q26):** attachments (2 below), reminders and notifications
   (Phase 14; no scheduled jobs — 0025), task reports and Excel export (Phase 15), the roles
   and permissions matrix (Phase 10), partner privacy of tasks (A4, Phase 16), a status
   board, bulk actions, recurring tasks and task templates or checklists.
3. **Attachments are deferred (Q02).** Phase 7 introduces no file storage. 0010 #4 remains
   approved for task notes; task attachments are designed with the first phase that adds
   file storage.

### Fields and rules

4. **Notes (Q04)** are one editable field, separate from the description and from the
   activity history.
5. **Required fields and defaults (Q11):** only the title is required. Status defaults to
   `TODO` and priority to `MEDIUM`. Description, notes, due date, event and assignees are
   optional.
6. **Limits (Q12)**, enforced in the UI and the API: title 150 characters, description
   1,000, notes 1,000.
7. **Due date (Q05, Q13)** is a calendar date in the wedding's timezone (`Asia/Kolkata`),
   never a time. Past dates are allowed.
8. **Overdue (Q05)** refines 0013: a task is overdue when its due date is **before today**
   in the wedding's timezone and its status is neither `COMPLETED` nor `CANCELLED`. A task
   due today is "due today", not overdue. Overdue is computed when tasks are read; no
   background job updates it.
9. **Statuses (Q09, Q10):** any of the five statuses can change to any other, including
   reopening a completed or cancelled task. No reason is required for `BLOCKED` or
   `CANCELLED`; the notes field can hold one.
10. **Cancel and delete (Q06):** cancelling sets `CANCELLED`; the task stays available
    (through the status filter) and is excluded from all counts (0013). Deleting is a soft
    delete after a confirmation: the task disappears from every list, count and route, and
    its history is kept.

### Events

11. **Moving (Q08):** editing a task can change its event or clear it (a whole-wedding task).
    The event must be an active event of the same wedding.
12. **Deleted events (Q07):** when an event is deleted, every task linked to it becomes a
    whole-wedding task, and each task's history records that the event link was removed.

### Assignment and access

13. **Assignees (Q03):** wedding members, several per task, never the same member twice.
    Until partners (Phase 16) and organizers (Phase 10) exist, the only member is the owner,
    so a task can be assigned to oneself.
14. **Access (Q14, Q15):** any `ACTIVE` member of the wedding can view, create, edit, assign,
    change the status of, cancel and delete its tasks. Everything else returns `404`, as for
    other wedding routes. Per-member permissions arrive in Phase 10; partner privacy is
    decided by A4 (0011). Until then all members of a wedding see all its tasks.
    **Amended by [0034](0034-phase-10-authorization.md):** from Phase 10 these actions need
    the `TASKS` permissions (API Design §23). A member without the permission gets `403`. Any
    `ACTIVE` member can still be chosen as an assignee, and being chosen grants no access
    (P10-8).
    **Amended by [0038](0038-phase-16-partner-connection.md):** there is no partner privacy;
    tasks are shared by both partners like every wedding resource (D1).

### History and audit

15. **Activity history (Q22):** creation, field edits, status changes, assignee changes,
    event-link changes (including those caused by a deleted event) and deletion are recorded
    in `task_activities` with the actor and time, and shown as a timeline on the task.
16. **After deletion (R2):** the history is kept in the database but not shown in Phase 7; a
    deleted task's routes return `404`.
17. **Audit log (R3):** the task history is the record of task changes. Deleting a task also
    writes an `audit_logs` entry; other task changes are not duplicated there.

### Screens

18. **List (Q16–Q19):** one list with filters, 25 tasks at a time with "Load more".
    - Row: title, status, priority, due date with an "Overdue" or "Due today" tag, the event
      name or "Whole wedding", and assignee initials.
    - Filters: status (default: every status except `CANCELLED`), priority, event (including
      "Whole wedding"), "Overdue only", "Assigned to me". Search by title.
    - Order: due date ascending with undated tasks last, then priority `URGENT`, `HIGH`,
      `MEDIUM`, `LOW`.
19. **Creating (Q20):** from the Tasks page, and from a shortcut on an event that preselects
    the event (which can still be changed). The shortcut is dropped if the event screen
    cannot take it without significant rework.
20. **Dashboard (Q21, R1):**
    - Counts: **Pending** (`TODO` + `IN_PROGRESS`), **Blocked**, **Completed** and
      **Overdue** (overlapping the first two); `CANCELLED` is excluded (0013).
    - **Upcoming tasks:** every overdue task plus tasks due from today to seven days after
      today, excluding `COMPLETED` and `CANCELLED`. Overdue first (oldest due date first),
      then by due date, then by priority. At most five. Tasks without a due date never
      appear.
    - When the wedding has no tasks: an empty state with an "Add a task" link. When tasks
      exist but every one is cancelled, the card shows the four counts at zero and a "View
      all tasks" link instead (product owner, 2026-10-20).

## Superseded and clarified statements

| Source                        | Statement                                                     | Resolution                                                     |
| ----------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| PRD v1.2 §16                  | Fields include attachments                                    | Attachments deferred (decision 3).                             |
| 0010 #4                       | Task notes and task attachments, designed in the Tasks phase  | Notes designed here (4); attachments deferred (3).             |
| 0013                          | Overdue = "dueDate is in the past"                            | Date-only, before today in the wedding's timezone (8).         |
| Database Design v1.1 §13.1    | `dueDate?: Date`; no notes field; attachments in S3           | Calendar date; `notes` added; attachments deferred (3, 4, 7).  |
| Database Design v1.1 §22      | Task changes are audited                                      | Task history plus an audit entry for deletion (17).            |
| API Design v1.1 §13           | Filters, notes and attachment endpoints designed in the phase | Filters and notes defined (18, 4); attachment routes deferred. |
| System Design v1.3 §12.2, §20 | Task attachments in S3                                        | Deferred (3).                                                  |
| Phase 4 PRD v1.2 §3.2         | Deleting an event: effects on RSVPs and invitations only      | Its tasks also become whole-wedding tasks (12).                |
