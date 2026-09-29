# 0004 — Specification authority and conflict resolution

**Status:** Accepted

## API routes

The latest API Design document is authoritative for **API routes**. Route examples in
other documents — for example the unversioned `/api/auth/*`, `/api/weddings/*` list in
System Design §18 — do not override it.

Route authority does not extend to fields, behaviour, permissions or business rules. A
stale field in an API example does not override a later product decision (see 0009).

## Precedence for everything else

1. Latest explicitly approved product decision / PRD
2. Latest approved System Design decision
3. Latest approved Database Design
4. Latest approved API Design
5. UI/UX design
6. Older documentation — only for missing context

## Conflict protocol

A conflict that cannot be resolved confidently with this precedence is never resolved in
code. It is raised for a decision with:

1. the conflicting statements,
2. where each comes from,
3. why the conflict matters,
4. a recommended resolution, and
5. what changes under each option.

The approved outcome is then recorded as a decision record.
