# MakeMyMarriage — Phase 7 PRD v1.0: tasks

| Item         | Value                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status       | **Canonical** for Phase 7. Approved scope; not yet designed or built.                                                                                                    |
| Date         | 2026-10-19                                                                                                                                                               |
| Parent       | [PRD v1.2](PRD_v1.2.md) (sections 16 and 18)                                                                                                                             |
| Decision     | [0026](../decisions/0026-phase-7-tasks.md), with 0010 #3–#4 and [0013](../decisions/0013-task-status-reporting.md)                                                       |
| Contracts    | [Database Design v1.1](DB_DESIGN_v1.1.md) §13, [API Design v1.1](API_DESIGN_v1.1.md) §6 and §13                                                                          |
| Out of scope | Task attachments, reminders and notifications, task reports and export, permissions matrix, partner privacy, status board, bulk actions, recurring tasks, task templates |

| Version | Date       | Change                                                     |
| ------- | ---------- | ---------------------------------------------------------- |
| 1.0     | 2026-10-19 | First version, from the Phase 7 discovery (decision 0026). |

## 1. Purpose and outcomes

Give the couple one place to track everything that has to be done for the wedding — booking,
shopping, calls, arrangements — either for the whole wedding or for a particular event, and
see on the dashboard what is pending, blocked, done and late.

## 2. Governing rules

- Tasks belong to exactly one wedding. Every route is wedding-scoped and admits only
  `ACTIVE` members; anything else is `404` (System Design §7.2).
- Any active member can do everything with a wedding's tasks in Phase 7 (0026 #14).
  Per-member permissions arrive in Phase 10; partner privacy is decision A4 (0011).
- Dates are calendar dates in the wedding's timezone (`Asia/Kolkata`), as for events
  (0017 #17). Nothing is scheduled: overdue state is computed when tasks are read (0025).
- Deletion is soft; history is never erased.

## 3. Fields

| Field       | Rule                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| Title       | Required; trimmed; 1–150 characters.                                                                    |
| Description | Optional; at most 1,000 characters.                                                                     |
| Notes       | Optional; at most 1,000 characters; a single editable field, separate from the description and history. |
| Status      | `TODO` (default), `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `CANCELLED` (0010 #3).                         |
| Priority    | `LOW`, `MEDIUM` (default), `HIGH`, `URGENT`.                                                            |
| Due date    | Optional calendar date in the wedding's timezone; never a time. Past dates are valid.                   |
| Event       | Optional; an active event of the same wedding. Empty means a whole-wedding task.                        |
| Assignees   | Optional; zero or more wedding members, each at most once.                                              |

- Text fields are trimmed; an empty optional field is stored as absent.
- System fields: created by and at, updated at, deleted by and at.
- Not in Phase 7: attachments (0026 #3).

## 4. Status and overdue

- Any status can change to any other, including reopening a completed or cancelled task. No
  reason is required (0026 #9).
- Reporting buckets (0013): **Pending** = `TODO` + `IN_PROGRESS`; **Blocked**; **Completed**;
  `CANCELLED` is in no bucket.
- **Overdue** (0026 #8): due date before today in the wedding's timezone, and status neither
  `COMPLETED` nor `CANCELLED`. It overlaps Pending or Blocked. A task due today is
  **due today**, not overdue.

## 5. Behaviour

### 5.1 Create, edit and move

- Create from the Tasks page; or from a shortcut on an event, with that event preselected
  and still changeable (0026 #19 — dropped if the event screen cannot take it without
  significant rework).
- Every field can be edited. Changing or clearing the event moves the task between events
  and the whole wedding (0026 #11).

### 5.2 Cancel and delete

- **Cancel** sets `CANCELLED`. The task stays available under the status filter, keeps its
  history and is excluded from all counts.
- **Delete** asks for confirmation, then soft-deletes the task: it leaves every list, count
  and route (`404`), its history is kept, and an audit entry is written (0026 #10, #17).

### 5.3 Assignees

- Assign and unassign wedding members. Assigning a member who is already assigned changes
  nothing. Until Phases 10 and 16 the only member is the owner ("assign to me").

### 5.4 Deleted events

- When an event is deleted, every task linked to it becomes a whole-wedding task, and each
  task's history records the removed event link with the actor who deleted the event
  (0026 #12).

### 5.5 Activity history

- Recorded with actor and time: created; fields edited (old and new values); status changed;
  assignee added or removed; event link changed or removed; deleted.
- Shown as a timeline on the task, newest first. A deleted task's history is kept but not
  shown in Phase 7 (0026 #16).

## 6. Task list

- One list with filters; 25 tasks at a time with "Load more", like the guest list (0026 #18).
- **Row:** title; status; priority; due date with an **Overdue** or **Due today** tag; the
  event name or **Whole wedding**; assignee initials.
- **Filters** (combinable):
  - Status — default: every status except `CANCELLED`; `CANCELLED` is shown only when chosen.
  - Priority.
  - Event, including **Whole wedding**.
  - **Overdue only**.
  - **Assigned to me**.
  - Search: title contains the text, ignoring case.
- **Order:** due date ascending, undated tasks last; then priority `URGENT`, `HIGH`,
  `MEDIUM`, `LOW`; then newest first. The order is stable across "Load more".
- States: loading; empty (no tasks yet, with "Add a task"); no results for the filters (with
  "Clear filters"); error with retry.

## 7. Task page

- All fields, assignees, and the activity timeline (§5.5).
- Actions: edit, change status, assign or unassign, cancel, delete (with confirmation).

## 8. Dashboard summary

Added to the existing dashboard (PRD §18; API Design §6), computed on every request:

- **Counts:** Pending, Blocked, Completed and Overdue (§4), over tasks that are not deleted.
- **Upcoming tasks** (0026 #20): every overdue task plus tasks due from today to seven days
  after today, excluding `COMPLETED` and `CANCELLED`. Overdue first (oldest due date first),
  then due date, then priority. **At most five.** Undated tasks never appear.
- **No tasks:** an empty state with an "Add a task" link.

## 9. API and data

- Routes: API Design §13. List filters, ordering and pagination as in §6 above; the
  dashboard fields as in API Design §6.
- Data: Database Design §13 — `tasks` (with `notes` and a calendar-date `dueDate`),
  `task_assignments`, `task_activities`.
- Errors follow API Design §21: `404` for a task, event or member outside the wedding or
  deleted; `400 VALIDATION_FAILED` with field errors for invalid input.

## 10. UI

- A **Tasks** item in the workspace navigation (PRD §29).
- Screens, to be designed and approved in Stitch before they are built: task list (with its
  filters and states), add and edit task, task page with the timeline, delete confirmation,
  the dashboard task summary, and the event shortcut — on desktop and mobile.
- Reuse the workspace design system and patterns of Phases 3 and 4 (forms, confirm dialog,
  toasts, the date picker, "Load more").
- Long titles wrap rather than overflow; actions stay reachable on small screens; every
  control is keyboard-accessible with visible focus.

## 11. Acceptance criteria

1. A member creates a task with only a title; it is `TODO`, `MEDIUM`, whole-wedding.
2. Titles over 150 characters, or description or notes over 1,000, are rejected by the form
   and the API.
3. A task linked to another wedding's event, or to a deleted event, is rejected.
4. Due yesterday → Overdue; due today → Due today; due tomorrow → neither, in the wedding's
   timezone around midnight.
5. A `COMPLETED` or `CANCELLED` task is never overdue; `CANCELLED` is in no count.
6. Every status can change to every other; each change appears in the timeline.
7. Cancelled tasks are hidden by default and appear when the Cancelled status is chosen.
8. A deleted task disappears from lists, counts and its route, and an audit entry exists.
9. Deleting an event turns its tasks into whole-wedding tasks with a timeline entry.
10. Assigning the same member twice leaves one assignment.
11. Filters, search and ordering combine and stay stable across "Load more".
12. The dashboard shows the four counts and at most five upcoming tasks in the defined order.
13. A non-member gets `404` for every task route and sees no task in any count.

## 12. Deferred or open

- Task attachments — with the first phase that adds file storage (0026 #3).
- Reminders and notifications — Phase 14.
- Task reports and Excel export — Phase 15.
- Per-member permissions — Phase 10; partner privacy — A4 (0011), Phase 16.
- Showing a deleted task's history ("recently deleted") — not in Phase 7.
- Recurring tasks, templates and checklists, status board, bulk actions — future ideas only.

## 13. Definition of done

- Code, database and API match this PRD, decision 0026, Database Design v1.1 and API Design
  v1.1, all under `/api/v1`.
- Automated tests pass for behaviour, validation, overdue edges, authorization and tenant
  isolation.
- The UI implements only approved fields and states, from approved Stitch screens.
- `PROJECT_STATUS.md` and the documentation index are updated when the phase is merged.
