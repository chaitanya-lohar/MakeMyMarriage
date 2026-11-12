# Deploying MakeMyMarriage (decision 0025)

Everything runs on free plans: the web app and the API as two Vercel projects, MongoDB
Atlas, Upstash Redis and Brevo. All of it is in the Mumbai region. There is no worker and
no container. Do the steps in order; each one needs values from the one before.

```text
Browser → Vercel "web" (apps/web) → /api/v1 → Vercel "api" (apps/api)
                                                 ├─ MongoDB Atlas (data)
                                                 ├─ Upstash Redis (rate limits)
                                                 └─ Brevo (email)
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

## 3. Brevo (decision 0041)

1. Create a free account at <https://www.brevo.com> and finish its sign-up checks. A new
   account may stay "under validation" for a while; sending fails until Brevo approves it.
2. **Senders, domains, IPs → Senders** → add a sender: name `MakeMyMarriage`, your own email
   address (a Gmail address works). Confirm it with the message Brevo sends to that address.
   No domain is needed.
3. **Settings → SMTP & API → API keys** → generate a key. This is `BREVO_API_KEY`.
4. **Security → Authorised IPs**: if API calls are limited to listed IP addresses, switch
   that off. Vercel has no fixed addresses, so a restricted key is refused.
5. `EMAIL_FROM` is `MakeMyMarriage <the sender address from step 2>`.

What to expect without a domain: any address can receive the emails, but Brevo replaces the
domain of a free sender address with one of its own, so the sender shown is a Brevo address
named "MakeMyMarriage", and more mail may land in Spam or Promotions. The free plan allows
about 300 emails a day. A domain verified in Brevo (or in Resend, with
`EMAIL_TRANSPORT=resend` and `RESEND_API_KEY`) removes both limits without a code change.
The menu names above are Brevo's at the time of writing and may differ.

## 4. Secrets

Generate two new values (Git Bash or WSL). Don't reuse the local ones.

```sh
openssl rand -base64 48   # JWT_ACCESS_SECRET
openssl rand -base64 32   # the key in INVITATION_TOKEN_KEYS, written as v1:<key>
```

Losing `INVITATION_TOKEN_KEYS` makes every existing invitation link unsendable (the links
still open, but emails can't be built), so store it safely.

## 5. Migrate the database and create the indexes

From the repository on your machine (Docker is not needed; this talks to Atlas). Run the
migrations first, then the indexes, in that order (Database Design §30):

```sh
pnpm install
pnpm --filter @makemymarriage/api build
MONGODB_URI="<Atlas URI from step 1>" pnpm --filter @makemymarriage/api db:migrate
MONGODB_URI="<Atlas URI from step 1>" pnpm --filter @makemymarriage/api db:indexes
```

The second command prints `indexes ready` for each collection. Run both again, before
deploying, after any change to the migrations or the indexes in the code. Neither drops
anything.

If either fails with `bad auth : authentication failed`, the user or password in the URI is
wrong: reset the database user's password in Atlas (letters and digits only, or URL-encode
symbols) and rebuild the URI. The api project fails the same way on every request until
`MONGODB_URI` is corrected there and the project is redeployed.

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
   | `EMAIL_TRANSPORT`       | `brevo`                                           |
   | `BREVO_API_KEY`         | from step 3                                       |
   | `EMAIL_FROM`            | `MakeMyMarriage <your sender address>` (step 3)   |
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
- [ ] Create a wedding, an event and a guest with an email address you can read (not the
      sender address).
- [ ] Send the invitation: the panel says "Email sent." and the email arrives.
- [ ] Open the invitation link on a phone and RSVP; refresh the guest page to see it.
- [ ] Forgot password for your own address: the email arrives (check Spam too).
- [ ] In Brevo, the transactional email logs list both emails as delivered.
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
