# Deploying MakeMyMarriage (decision 0025)

Everything runs on free plans: the web app and the API as two Vercel projects, MongoDB
Atlas, Upstash Redis and Resend. All of it is in the Mumbai region. There is no worker and
no container. Do the steps in order; each one needs values from the one before.

```text
Browser → Vercel "web" (apps/web) → /api/v1 → Vercel "api" (apps/api)
                                                 ├─ MongoDB Atlas (data)
                                                 ├─ Upstash Redis (rate limits)
                                                 └─ Resend (email)
```

Keep every secret below in a password manager. Never commit one or paste it into a chat.

## 1. MongoDB Atlas

1. Create a free account at <https://cloud.mongodb.com> and a project `MakeMyMarriage`.
2. Create a cluster: **M0 (free)**, provider **AWS**, region **Mumbai (ap-south-1)**.
3. **Database Access** → add a user (password authentication) with the role
   "Read and write to any database". Generate a long password.
4. **Network Access** → add `0.0.0.0/0`. Vercel's free plan has no fixed IP addresses, so
   Atlas must accept any address; the long password is what protects the database.
5. **Connect → Drivers** → copy the `mongodb+srv://…` string. Put the user and password in
   it and add the database name before the `?`:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/makemymarriage?retryWrites=true&w=majority`
   This is `MONGODB_URI`.

## 2. Upstash Redis

1. Create a free account at <https://upstash.com> → **Create database** → type Redis,
   region **ap-south-1 (Mumbai)**, TLS on.
2. Copy the **Redis URL** that starts with `rediss://` (two s's). This is `REDIS_URL`.

## 3. Resend

1. In <https://resend.com> create an API key with "Sending access". This is
   `RESEND_API_KEY`.
2. Without a domain, use `EMAIL_FROM=MakeMyMarriage <onboarding@resend.dev>`. Resend then
   delivers **only to the address you signed up with**: invitations to guests and password
   resets for other accounts will fail. Organizers share invitations with Copy link or
   WhatsApp until a domain is verified (0025).

## 4. Secrets

Generate two new values (Git Bash or WSL). Don't reuse the local ones.

```sh
openssl rand -base64 48   # JWT_ACCESS_SECRET
openssl rand -base64 32   # the key in INVITATION_TOKEN_KEYS, written as v1:<key>
```

Losing `INVITATION_TOKEN_KEYS` makes every existing invitation link unsendable (the links
still open, but emails can't be built), so store it safely.

## 5. Create the database indexes (once)

From the repository on your machine (Docker is not needed; this talks to Atlas):

```sh
pnpm install
pnpm --filter @makemymarriage/api build
MONGODB_URI="<Atlas URI from step 1>" pnpm --filter @makemymarriage/api db:indexes
```

It prints `indexes ready` for each collection. Run it again after any change to the
indexes in the code. It never drops anything.

## 6. Vercel project "api"

1. Sign in to <https://vercel.com> with GitHub and import the `MakeMyMarriage` repository.
2. Project name `makemymarriage-api`, **Root Directory `apps/api`**. Vercel detects NestJS;
   leave the build settings as they are.
3. Environment variables (Production):

   | Name                    | Value                                             |
   | ----------------------- | ------------------------------------------------- |
   | `NODE_ENV`              | `production`                                      |
   | `APP_ENV`               | `staging`                                         |
   | `MONGODB_URI`           | from step 1                                       |
   | `REDIS_URL`             | from step 2                                       |
   | `JWT_ACCESS_SECRET`     | from step 4                                       |
   | `INVITATION_TOKEN_KEYS` | `v1:<key from step 4>`                            |
   | `EMAIL_TRANSPORT`       | `resend`                                          |
   | `RESEND_API_KEY`        | from step 3                                       |
   | `EMAIL_FROM`            | `MakeMyMarriage <onboarding@resend.dev>`          |
   | `WEB_APP_URL`           | `https://placeholder.vercel.app` for now (step 8) |
   | `LOG_LEVEL`             | `info`                                            |

4. Deploy. Open `https://<api project>.vercel.app/health/ready`; it should show MongoDB and
   Redis as `up`. Note this address: it is `API_INTERNAL_URL`.

## 7. Vercel project "web"

1. Import the same repository again: project name `makemymarriage`, **Root Directory
   `apps/web`**, framework Next.js.
2. Environment variable: `API_INTERNAL_URL` = the api address from step 6, origin only
   (for example `https://makemymarriage-api.vercel.app`, no path or trailing slash). It is
   read at build time.
3. Deploy. The site address (for example `https://makemymarriage.vercel.app`) is the one
   everyone uses.

## 8. Connect them

1. In the **api** project set `WEB_APP_URL` to the web address from step 7 (https), then
   **Redeploy**. Email links (invitations, password reset) use this address.
2. Both projects deploy automatically whenever `main` changes.

## 9. Check the deployment

- [ ] `https://<api>/health/ready` shows `mongodb: up, redis: up`.
- [ ] Sign up, sign out and sign in on the web address.
- [ ] Create a wedding, an event and a guest whose email is your Resend sign-up address.
- [ ] Send the invitation: the panel says "Email sent." and the email arrives.
- [ ] Open the invitation link on a phone and RSVP; refresh the guest page to see it.
- [ ] Forgot password for your own address: the email arrives.
- [ ] **Visitor IP (0025):** in Atlas, open the newest `auth_sessions` record and check that
      `ipAddress` is your own public IP, not a Vercel address. If it isn't, the per-IP rate
      limits count every visitor together; report it before inviting real guests.
- [ ] If the api project shows errors about dependency injection or "Nest can't resolve
      dependencies", Vercel's NestJS compile lost decorator metadata; report it.

## Notes

- **Cost:** all four services stay free at test scale. Vercel's free plan is for
  non-commercial use only; a public launch needs Vercel Pro or containers (0025).
- **Cold starts:** the first request after a quiet period takes about a second longer.
- **Local development is unchanged:** `pnpm infra:up && pnpm dev`, with Mailpit as the
  inbox.
