# MakeMyMarriage — notes for Claude

Start every session by reading [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) (current
phase, branches, open decisions, working rules) and the documentation index
[`docs/README.md`](docs/README.md) (canonical documents and reading order).

Canonical documents: decision records in `docs/decisions/`, and in `docs/specs/` the
PRD v1.2, the current feature PRD (Phase 7 PRD v1.0; Phase 4 PRD v1.2 for the built
phase), System Design v1.3, Database Design
v1.1 and API Design v1.1. Never implement from `docs/archive/` or from superseded `.docx`
originals.

## Rules

- Never invent product behaviour, fields or relationships. If documents conflict, stop and
  raise it with the protocol in `docs/decisions/0004-specification-authority.md`. Items
  marked Open, Deferred or UNRESOLVED are not implemented until a decision approves them.
- Start a module or phase only after explicit approval. Never push, open a PR or start the
  next phase without being told to.
- UI follows the approved Google Stitch screens (project `11709379677369700007`); missing
  screens are designed and approved in Stitch first.
- Keep commits small and logical, and keep documentation changes separate from code. Run
  Prettier from the repository root.
- Update `docs/PROJECT_STATUS.md` in the same commit that finishes a phase or changes a
  branch's state. When a decision changes a canonical specification, update that
  specification in the same change (decision 0003).

## Commands

```sh
pnpm infra:up && pnpm dev    # local stack: web :3000, API :3001, Mailpit :8025
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm build
pnpm api:contract            # after changing API DTOs or controllers
```
