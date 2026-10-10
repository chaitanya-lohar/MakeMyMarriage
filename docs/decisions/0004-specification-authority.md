# 0004 — Specification authority and conflict resolution

**Status:** Accepted

## API routes

The latest API Design document is authoritative for **API routes**. Route examples in
other documents — for example the unversioned `/api/auth/*`, `/api/weddings/*` list in
System Design v1.2 §18 — do not override it.

Route authority does not extend to fields, behaviour, permissions or business rules. A
stale field in an API example does not override a later product decision (see 0009).

## Precedence for everything else

1. Latest explicitly approved product decision / PRD
2. Latest approved System Design decision
3. Latest approved Database Design
4. Latest approved API Design
5. UI/UX design
6. Older documentation — only for missing context

A decision record overrides a specification only for the scope it explicitly covers.

## Current canonical documents (2026-10-10)

| Level | Document                                                                                                                                     |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Accepted decision records 0001–0017; [PRD v1.2](../specs/PRD_v1.2.md); feature PRDs such as [Phase 4 PRD v1.2](../specs/PHASE_4_PRD_v1.2.md) |
| 2     | [System Design v1.3](../specs/SYSTEM_DESIGN_v1.3.md)                                                                                         |
| 3     | [Database Design v1.1](../specs/DB_DESIGN_v1.1.md)                                                                                           |
| 4     | [API Design v1.1](../specs/API_DESIGN_v1.1.md) (authoritative for routes)                                                                    |
| 5     | Approved Google Stitch screens, as corrected in decisions 0014–0016                                                                          |
| 6     | `docs/archive/` — history only                                                                                                               |

A feature PRD details its parent PRD and may not contradict it; a conflict is raised with
the protocol below. The index of current documents is [`docs/README.md`](../README.md).

## Conflict protocol

A conflict that cannot be resolved confidently with this precedence is never resolved in
code. It is raised for a decision with:

1. the conflicting statements,
2. where each comes from,
3. why the conflict matters,
4. a recommended resolution, and
5. what changes under each option.

The approved outcome is then recorded as a decision record.
