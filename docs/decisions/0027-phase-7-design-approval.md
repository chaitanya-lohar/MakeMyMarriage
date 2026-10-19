# 0027 — Phase 7 design approval

**Status:** Accepted (approved by the product owner on 2026-10-19). The screens and rules
below are approved; the **wording stays draft**, as for Phase 4 (0021).

The Phase 7 screens were generated in Google Stitch (project `11709379677369700007`) from
prompts written against decision 0026 and the Phase 7 PRD v1.0, and reviewed against them.
No screen contradicts an approved rule. The corrections below are applied in code, following
the 0016 and 0021 precedent.

## Approved screens

| Screen                       | Stitch ID                          | Contains                                                          |
| ---------------------------- | ---------------------------------- | ----------------------------------------------------------------- |
| P7 · T1 Tasks List (desktop) | `d1e0df36916745b283b060ff68ac2f4a` | List, filters, rows, tags, "Load more"                            |
| P7 · T1 Tasks List (mobile)  | `ffbab6ff683548eeab802e06f9b41134` | Card list, Filters button                                         |
| P7 · T2 Tasks States         | `51a5f40afa5e484f87f0de173e1f6eef` | Empty, no results, loading, error; mobile filter sheet            |
| P7 · T3 Task Form            | `ea024f3fc7d04042ac7cbd786bd90282` | Add, edit and validation, desktop and mobile                      |
| P7 · T4 Task Detail          | `76dee4fe76704d12bf630e599dde1f9a` | Task page with actions and history, desktop and mobile            |
| P7 · T5 Delete and Cancelled | `ed56267c26604bc5973e2781a4c64525` | Delete dialog and sheet, "Task deleted" toast, cancelled task     |
| P7 · T6 Dashboard Tasks      | `72675855c99e49e29abb85d1b3ce396a` | The dashboard **Tasks card** only, with its empty state           |
| P7 · T7 Event Add Task       | `376a38a10da74fd5bacdc402a7d66d9c` | "Add task for this event" and the form with the event preselected |

Not approved: "P7 · Tasks (Desktop)" `05c24d5662774bc5b1df774746308379`, a stray screen
with unapproved summary cards and labels. It is never used.

## Decisions on additions Stitch made

1. **No overdue badge** on the Tasks navigation item (T6). The dashboard shows overdue tasks.
2. **No per-event task panel** ("3 tasks linked to Mehendi · Next up…") on the event screen
   (T7). Only the "Add task for this event" button is added.
3. **Completed task titles are struck through** in the list (T1). Visual only.

## Corrections applied in code

1. **Workspace shell:** keep the approved Phase 3 and 4 shell — no "Regal Concierge"
   tagline, no "Planning ›" breadcrumb, no footer inside the workspace. A **Tasks** item
   follows Guests & RSVP in the navigation.
2. **T1:** the "Due today" tag never wraps.
3. **T3:** the edit page has its own subtitle; mobile shows priorities in full (Medium,
   Urgent), never abbreviated.
4. **T4:** the field is labelled "Notes", not "Internal Notes"; no marketing footer on
   mobile.
5. **T5:** only the dialog, the toast and the cancelled-task page are taken from this
   screen; its task list follows T1 (its sample data is wrong).
6. **T6:** only the Tasks card is taken; the rest of the dashboard stays as approved in 0021. The empty card shows "No tasks yet" without a "0 Total Tasks" line.
7. Stitch's specification annotations (for example "Diagnostics", "Retry interval",
   "Fail-safe recovery") are notes, not features.
8. Sample data in the screens (names, dates, counts, event times) is illustrative only.

## Wording

The copy in these screens and the prompts is **draft**, awaiting the product owner's
review, as with Phase 4 (0019 #7, 0021).
