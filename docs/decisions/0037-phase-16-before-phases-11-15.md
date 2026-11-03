# 0037 — Phase 16 before Phases 11–15

**Status:** Accepted (approved by the product owner on 2026-11-03, decision D2 of the Phase 16
discovery).

## Context

The roadmap in `docs/PROJECT_STATUS.md` builds the phases in order: 11 Wedding website, 12
Gallery and QR memories, 13 Live stream, 14 Notifications, 15 Reports, 16 Partner connection
and sharing. Phase 10 (organizers and permissions) is done. The product owner wants partner
connection to work with the ownership, membership and permission model before the remaining
modules are built.

The Phase 16 discovery found no dependency of Phase 16 on Phases 11–15: their modules are not
built, and the sharing rule for them is decided now and applied when each is built (0038 D1).
Partner invitation emails use the existing email sending, not the Phase 14 notification engine.

## Decision

1. **Phase 16 (Partner connection and sharing) is built next**, before Phases 11–15.
2. **Phases 11–15 are deferred, not cancelled.** Their scope, numbering and the decisions that
   point to them (for example reminders in Phase 14 and reports in Phase 15) are unchanged.
   Each still starts only after explicit approval.
3. **Nothing from Phases 11–15 is built as part of Phase 16.** Phase 16 only states how their
   resources will be shared once they exist (0038 D1).
4. The working rules are unchanged: one phase at a time, each after explicit approval, and new
   screens designed and approved in Stitch first.

## Changed statements

| Source                   | Statement                                       | Resolution                                |
| ------------------------ | ----------------------------------------------- | ----------------------------------------- |
| `docs/PROJECT_STATUS.md` | Next phase: Phase 11                            | Phase 16; 11–15 deferred (1, 2)           |
| API Design v1.1 §36      | Order: partner and sharing first, then the rest | Unchanged in substance; phase 16 now      |
| System Design v1.3 §29   | Implementation sequence (out of date)           | Points to the status page and this record |
