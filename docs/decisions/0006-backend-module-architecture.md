# 0006 — Backend module architecture

**Status:** Accepted

## Layout

Each domain module lives in `apps/api/src/modules/<feature>/` and is created only when
that feature is implemented — never as an empty placeholder.

```text
modules/<feature>/
├── <feature>.module.ts
├── index.ts              ← the only public entry point
├── api/
│   ├── controllers/
│   └── dto/
├── application/
│   ├── use-cases/
│   └── services/
├── domain/
│   ├── types/
│   ├── enums/
│   └── rules/
└── infrastructure/
    ├── schemas/
    └── repositories/
```

Shared code outside modules: `src/config/`, `src/common/`, `src/infrastructure/`,
`src/platform/` (health), `src/bootstrap/`, `src/openapi/` and `src/worker/`.

## Rules

1. **Public entry point.** Other modules and shared code import a module only through
   its `index.ts`. Importing another module's internals is forbidden.
2. **Persistence stays in infrastructure.** Mongoose schemas, models and documents are
   used only in `infrastructure/`. Repositories return domain types, never Mongoose
   documents. `api/`, `application/` and `domain/` do not import `mongoose`,
   `@nestjs/mongoose`, `mongodb` or `infrastructure/schemas/`. The `<feature>.module.ts`
   file may register schemas with `MongooseModule.forFeature()`.
3. **No cross-module persistence.** A module never reads or writes another module's
   collections (System Design §6).

## Enforcement

`packages/eslint-config/nest.js`, checked by `pnpm lint` in CI:

- rule 1 — `boundaries/dependencies`
- rule 2 — `no-restricted-imports` on module `api/`, `application/` and `domain/` files

That repositories return domain types (rule 2), and rule 3, are enforced by code review.
