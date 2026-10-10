# 0003 — Repository documentation structure

**Status:** Accepted (decision A3). Amended 2026-10-10 with the consolidated specifications
and the archive (product-owner answer Q5).

## Layout

- `docs/README.md` — the documentation index: canonical documents, reading order and the
  archive register.
- `docs/PROJECT_STATUS.md` — current phase, branches, open decisions and working rules.
- `docs/specs/` — the **canonical** specifications, in Markdown, with the version in the
  file name: PRD, feature PRDs (for example the Phase 4 PRD), System Design, Database Design
  and API Design.
- `docs/decisions/` — decision records such as this one.
- `docs/archive/` — superseded documents, kept for history and recovery. Archived files are
  never used as implementation instructions and are never deleted.

## Rules

- Decision records are the history of why something changed; they are never rewritten.
  When a later decision changes an earlier one, the earlier record gets a short "Amended by"
  note and the later record names the superseded statement.
- A specification version, once superseded, is archived unchanged. Changes are made by
  publishing a new version that carries forward every still-valid requirement and applies
  the approved decisions; the old version moves to `docs/archive/` only after its content
  has been carried forward and checked.
- The canonical specifications are kept consistent with the accepted decision records. If
  a later decision changes a canonical specification, that specification is updated (as a
  new version, or in place with a change-log entry) in the same change.

The GitHub repository is private.
