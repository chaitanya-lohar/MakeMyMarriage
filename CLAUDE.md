# MakeMyMarriage — notes for Claude

Start every session by reading [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md): current
phase, branches, open decisions and working rules. Decisions are in `docs/decisions/`; the
approved specifications are in `docs/specs/`.

## Rules

- Never invent product behaviour, fields or relationships. If documents conflict, stop and
  raise it with the protocol in `docs/decisions/0004-specification-authority.md`.
- Start a module or phase only after explicit approval. Never push, open a PR or start the
  next phase without being told to.
- UI follows the approved Google Stitch screens (project `11709379677369700007`).
- Keep commits small and logical. Run Prettier from the repository root.
- Update `docs/PROJECT_STATUS.md` in the same commit that finishes a phase or changes a
  branch's state.

## Commands

```sh
pnpm infra:up && pnpm dev    # local stack: web :3000, API :3001, worker :3002, Mailpit :8025
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm build
pnpm api:contract            # after changing API DTOs or controllers
```
