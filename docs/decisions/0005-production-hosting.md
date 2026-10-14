# 0005 — Production hosting

**Status:** Accepted. Supersedes the hosting wording in System Design v1.2 (see below).
Amended by 0025: the API runs on Vercel as its own project, and there is no worker; the
container hosting below applies again only if 0025 is reversed.

## Decision

| Component      | Hosting                                          |
| -------------- | ------------------------------------------------ |
| Web (Next.js)  | Vercel                                           |
| NestJS API     | Container — recommended AWS ECS/Fargate          |
| BullMQ worker  | Separate container — recommended AWS ECS/Fargate |
| Database       | MongoDB Atlas                                    |
| Redis          | Managed Redis service                            |
| Object storage | Amazon S3                                        |
| CI/CD          | GitHub Actions                                   |

```text
Browser → Vercel / Next.js → /api/v1 proxy → NestJS API container (ECS/Fargate)
BullMQ  → worker container (ECS/Fargate)
```

Both containers use the single image from 0002. The browser path is described in 0001.

## Superseded statements (System Design v1.2)

| Section | Statement                                                                   | Resolution                                                                                        |
| ------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| §5      | "Vercel hosts the Next.js application and V1 API-facing application layer." | Vercel hosts the web app and its `/api/v1` proxy only. The NestJS API does **not** run on Vercel. |
| §5      | "ECS/Fargate is not required for V1."                                       | The API and worker run as containers; ECS/Fargate is the recommended platform.                    |
| §2      | Docker: "not primary V1 runtime."                                           | The Docker image is the production runtime for the API and worker.                                |
| §23     | Pipeline ending "→ Vercel".                                                 | Vercel deploys the web app; the API and worker deploy as containers.                              |

## Not yet implemented

ECS/Fargate infrastructure and deployment workflows are out of scope for the scaffold
and will be added with the deployment work. CI already builds the production image.
