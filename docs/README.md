# MakeMyMarriage documentation

The index of current documents. Updated 2026-10-10.

## Canonical documents

Use only these for implementation. Precedence is set by
[decision 0004](decisions/0004-specification-authority.md): an accepted decision record
overrides a specification only for the scope it covers.

| Document                                          | Defines                                                 |
| ------------------------------------------------- | ------------------------------------------------------- |
| [PROJECT_STATUS.md](PROJECT_STATUS.md)            | Current phase, branches, open decisions, working rules  |
| [Decision records 0001–0024](decisions/README.md) | Approved decisions and what they supersede              |
| [PRD v1.2](specs/PRD_v1.2.md)                     | Master product scope and behaviour                      |
| [Phase 4 PRD v1.2](specs/PHASE_4_PRD_v1.2.md)     | Phase 4 requirements and acceptance criteria (built)    |
| [System Design v1.3](specs/SYSTEM_DESIGN_v1.3.md) | Architecture, deployment, module boundaries             |
| [Database Design v1.1](specs/DB_DESIGN_v1.1.md)   | Collections, fields, indexes, lifecycle, transactions   |
| [API Design v1.1](specs/API_DESIGN_v1.1.md)       | Routes (authoritative), payloads, errors, authorization |
| Google Stitch project `11709379677369700007`      | Approved screens, as corrected in decisions 0014–0016   |

The exact contract of built endpoints is the generated
`packages/api-client/openapi.json`.

## Reading order before implementation

1. `PROJECT_STATUS.md` — where things stand and what is approved next.
2. Decision records, newest first, at least those named for the phase.
3. PRD v1.2, then the phase's feature PRD.
4. System Design v1.3.
5. Database Design v1.1 and API Design v1.1 for the collections and routes involved.
6. The approved Stitch screens for the phase.

## Unresolved decisions

Listed in `PROJECT_STATUS.md` under "Open decisions and blockers". Nothing marked Open,
Deferred or UNRESOLVED is implemented until a decision record approves it.

## Archive

`docs/archive/` holds superseded documents for history and recovery. They are not
implementation instructions and are never deleted (decision 0003).

Archived 2026-10-10 with the product owner's approval; see [`archive/README.md`](archive/README.md).

| Archived document                                                                                                                                                                                                                              | Replaced by                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `specs/PRD_v1.0.pdf`, `specs/PRD_v1.1.docx`                                                                                                                                                                                                    | PRD v1.2                                       |
| `specs/SYSTEM_DESIGN_v1.0.docx`, `v1.1`, `v1.2`                                                                                                                                                                                                | System Design v1.3                             |
| `specs/DB_DESIGN_v1.0.docx`                                                                                                                                                                                                                    | Database Design v1.1                           |
| `specs/API_DESIGN_v1.0.docx`                                                                                                                                                                                                                   | API Design v1.1                                |
| `specs/reconciled-2026-10-10/` — the reconciled `.docx` set (PRD v1.2 CONSOLIDATED, Phase 4 PRD v1.1 FINAL, System Design v1.3, Database Design v1.1, API Design v1.1 RECONCILED, Documentation Index v1.0), its README and the ADR-0017 draft | The Markdown documents above and decision 0017 |

Copies outside this repository (for example `PRD_v1.1(1).docx`,
`System_Design_Architecture_v1.x.docx` or the Phase 4 PRD v1.0 draft) are not tracked here
and must not be used.
