# 0025 — Vercel-only hosting: no worker, email sent directly

**Status:** Accepted (approved by the product owner on 2026-10-14). Amends 0002 and 0005;
supersedes 0023 #1 and the worker statements listed below.

The product owner chose to deploy without containers or a background worker, to keep
hosting free while the product is tested with a small group. The trade-offs below were
presented and accepted before approval.

## Decisions

1. **Hosting.** Everything runs on free plans:

   | Component     | Hosting                                                         |
   | ------------- | --------------------------------------------------------------- |
   | Web (Next.js) | Vercel project `web` (`apps/web`)                               |
   | NestJS API    | Vercel project `api` (`apps/api`), run as a Vercel function     |
   | Database      | MongoDB Atlas (M0, AWS Mumbai)                                  |
   | Redis         | Managed Redis with a free plan (Upstash, Mumbai) — rate limits  |
   | Email         | Resend                                                          |
   | CI/CD         | GitHub Actions checks; Vercel deploys both projects from `main` |
   - The browser path of 0001 is unchanged: the `web` project forwards `/api/v1/*` to the
     `api` project (`API_INTERNAL_URL`), so cookies stay first-party and the API enables no
     CORS.
   - Both Vercel projects run in the Mumbai region, next to Atlas and Redis.
   - The API keeps one application instance, with its MongoDB and Redis connections, for
     as long as Vercel keeps the function warm.

2. **No worker and no job queue.** The worker runtime, BullMQ and its queues are removed.
   Redis is kept only for rate limiting.
3. **Invitation emails are sent during the request.** Send and resend call Resend directly
   and record the attempt before responding.
   - The response contract is unchanged (`202` with the same body); the attempt is already
     recorded when the response arrives, so the organizer sees `SENT` or `FAILED` at once.
   - There is no automatic retry. If the provider cannot be reached, the attempt is recorded
     `FAILED` with "The email service could not be reached.", and the organizer uses Resend
     to try again. A provider rejection stays `FAILED` (0018 #8).
   - The `Idempotency-Key` still sends an email at most once per key.
   - The 0020 rules still apply: an email is sent only for the current link.
4. **Password reset emails are sent after the response.** The request is answered first and
   the email is sent in the same function invocation (Vercel `waitUntil`), so the response
   time does not reveal whether an account exists (0015). A failed reset email is logged and
   not retried; the user can request another.
5. **Database indexes** are created by a one-off command (`pnpm --filter @makemymarriage/api
db:indexes`), run against Atlas before the first deployment and after any index change.
   The API never builds indexes at start-up outside local and test environments (unchanged).
6. **No Docker image.** The API Docker image and the CI job that builds it are removed.
   Docker Compose stays for local MongoDB, Redis and Mailpit.
7. **Address.** The app runs on its free `*.vercel.app` address; no domain is owned yet.

## Consequences

- **Email to guests needs a domain.** Without a verified sending domain, Resend's test
  sender delivers only to the Resend account owner's address. Until a domain is verified,
  invitation emails and password resets reach only that address; organizers share
  invitations with Copy link or WhatsApp. Verifying a domain needs no code change
  (`EMAIL_FROM`).
- **No automatic email retries.** A short provider outage produces `FAILED` attempts that
  the organizer resends by hand.
- **Slower first request.** A cold function start adds about a second to the first request
  after a quiet period.
- **Non-commercial use only.** Vercel's free (Hobby) plan does not allow commercial use. A
  public launch needs the Pro plan or a return to containers (0005).
- **Future background work is not decided.** Guest reminders, report exports, media cleanup
  and delivery webhooks were planned as worker jobs. Each needs its own decision (for
  example Vercel Cron, whose free plan runs at most daily, or a hosted queue) before it is
  built.
- **To verify at the first deployment:** that the API sees the visitor's IP address through
  both Vercel projects (rate limits per IP, 0023 #2; session records), and that function
  time limits suit every route.

## Superseded statements

| Source                                | Statement                                                                  | Resolution                                                      |
| ------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 0002                                  | Two runtimes (API and worker) in one Docker image                          | One runtime (the API); no image (decisions 2 and 6).            |
| 0005                                  | API and worker as containers (ECS/Fargate); the API does not run on Vercel | API on Vercel; no worker (decisions 1 and 2).                   |
| 0015                                  | The reset email is sent by the worker (BullMQ `email` queue)               | Sent after the response by the API (decision 4).                |
| 0023 #1                               | `FAILED` after every automatic retry fails                                 | No retries; `FAILED` when the provider cannot be reached (3).   |
| System Design v1.3 §2, §4, §5         | Containers, BullMQ worker, Docker as the production runtime                | Vercel-only hosting (decisions 1, 2 and 6).                     |
| System Design v1.3 §11, §22           | Domain actions produce jobs for the worker; BullMQ retries                 | Email sent directly; future jobs undecided (Consequences).      |
| System Design v1.3 §23                | CI builds the image; API and worker deploy as containers                   | No image; Vercel deploys both projects (decisions 1 and 6).     |
| API Design v1.1 §2, §10, §27, §32     | Send "queues" the email; the worker sends it; jobs table                   | Sent during the request (decision 3); reset email (decision 4). |
| Database Design v1.1 §3, §10.3, §10.4 | A queued email is tied to its link; the key makes the job safe to retry    | Same rule applied during the request; the key prevents repeats. |
| Phase 4 PRD v1.2 §7.2, §7.3           | Email is sent through the worker (BullMQ); retries                         | Sent during the request, no automatic retry (decision 3).       |
