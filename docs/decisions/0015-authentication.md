# 0015 — Authentication (Phase 2)

**Status:** Accepted (approved 2026-10-02).

Implements API Design v1.0 §5, System Design v1.2 §7.1 and Database Design v1.0 §6 for
email/password accounts. Google login and mandatory email verification are out of V1.

## Scope

In Phase 2: sign up, sign in (with "Remember me"), sign out, forgot password, reset
password, and the current-user endpoint.

| Endpoint                            | Purpose                                         |
| ----------------------------------- | ----------------------------------------------- |
| `POST /api/v1/auth/register`        | Create the user (no wedding — 0012) and sign in |
| `POST /api/v1/auth/login`           | Sign in                                         |
| `POST /api/v1/auth/refresh`         | Rotate the session                              |
| `POST /api/v1/auth/logout`          | Revoke the current session                      |
| `POST /api/v1/auth/forgot-password` | Request a reset email                           |
| `POST /api/v1/auth/reset-password`  | Set a new password with a reset token           |
| `GET /api/v1/me`                    | Current user                                    |

Deferred to the Settings phase (PRD §25): `POST /auth/logout-all`, `GET /me/sessions`,
`DELETE /me/sessions/{id}`, `PATCH /me`.

## UI

Source of truth: Stitch project `11709379677369700007`.

| Route                     | Stitch screen                                |
| ------------------------- | -------------------------------------------- |
| `/login`                  | "Sign In (V1)" (corrected copy of "Sign In") |
| `/forgot-password`        | Forgot Password view of "Sign In (V1)"       |
| `/signup`                 | "Sign Up"                                    |
| `/reset-password?token=…` | "Reset Password" and "Reset Link Expired"    |
| `/dashboard`              | "Signed In (Phase 2 placeholder)"            |

- The original "Sign In" screen stays untouched; its out-of-scope wording (concierge,
  "verified", end-to-end encryption, guest suites, "Inc.", "Security Architecture", a
  delivery-time promise) is replaced as in "Sign In (V1)".
- Primary buttons use midnight navy, as on the home page.
- Sign-up fields: full name, email, password, confirm password.
- After a successful reset the user goes to `/login`, which shows "Your password has been
  updated. Please sign in with your new password."
- After sign-in or sign-up the user lands on `/dashboard`, a minimal signed-in page with
  Sign Out, until the Weddings phase replaces it.
- A session that can no longer be refreshed sends the user to `/login` with "Your session
  has ended. Please sign in again."
- A signed-in user who opens `/login`, `/signup` or `/forgot-password` is sent to
  `/dashboard`. `/reset-password` stays reachable because it opens from an email link.
  (Approved 2026-10-05 after manual testing.)

## Sessions and tokens

- **Cookies only** (never `localStorage`): `HttpOnly`, `SameSite=Lax`, and `Secure` outside
  local development and tests. Browsers reach the API same-origin (0001), so cookies are
  first-party; with `SameSite=Lax` and JSON-only request bodies, cross-site form posts
  cannot carry them.
- **Access token:** signed JWT, 15 minutes, claims `sub` (user) and `sid` (session). Checked
  without a database lookup, so a revoked session's access token stays valid for at most
  15 minutes.
- **Refresh token:** random 256-bit secret, only its SHA-256 hash stored in
  `auth_sessions`; rotated on every refresh. The cookie is scoped to `/api/v1/auth`.
- **Remember me** ticked: the session lasts 30 days. Unticked: browser-session cookies and
  a 24-hour server-side limit. Lifetimes are absolute from sign-in and are not extended by
  refreshing. Sign-up starts an unticked session.
- Sign-out revokes the session and clears both cookies.
- A password reset revokes every session of that user.

## Passwords

- At least 8 characters, at most 128, no other composition rules.
- Hashed with Argon2id; never stored or logged in plain text.

## Password reset

- Reset links are single-use and expire after 60 minutes; only the token hash is stored.
- `forgot-password` always returns the same response, whether or not the email exists.
- The email is sent by the worker (BullMQ `email` queue). Because the job carries the raw
  link, completed jobs are deleted immediately and failed ones after one hour.
- An expired, used or unknown link shows the "Reset Link Expired" state when the new
  password is submitted (API Design defines no token-check endpoint).

### Reset email

- **From:** `MakeMyMarriage <no-reply@makemymarriage.com>`
- **Subject:** "Reset your MakeMyMarriage password"
- **Body:** "Hi {name}, We received a request to reset the password for your MakeMyMarriage
  account. [Reset your password] This link can be used once and expires in 60 minutes. For
  your security, resetting your password signs you out on all your devices. If you didn't
  ask to reset your password, you can ignore this email — your password won't change.
  © 2026 MakeMyMarriage. All rights reserved." HTML in the design system plus a plain-text
  version.

### Email delivery

- Local development and tests: a local Mailpit inbox (docker-compose); nothing is sent.
- Staging/production: Resend, once an account and DNS records for `makemymarriage.com`
  exist. Selected by configuration (`EMAIL_TRANSPORT`).

## Abuse protection

| Action         | Limit                                      |
| -------------- | ------------------------------------------ |
| Sign-in        | 5 failed attempts per email per 15 minutes |
| Reset requests | 3 per email per hour                       |

Message: "Too many attempts. Please wait a few minutes and try again." (HTTP 429)

## Messages and errors

| Situation                     | Code                       | HTTP | Message                                                                    |
| ----------------------------- | -------------------------- | ---- | -------------------------------------------------------------------------- |
| Wrong email or password       | `INVALID_CREDENTIALS`      | 401  | Invalid credentials. Please verify your email and try again.               |
| Email already registered      | `EMAIL_ALREADY_REGISTERED` | 409  | An account with this email already exists. Sign in or reset your password. |
| Reset link invalid            | `RESET_TOKEN_INVALID`      | 400  | This link has expired or has already been used.                            |
| Too many attempts             | `RATE_LIMITED`             | 429  | Too many attempts. Please wait a few minutes and try again.                |
| Not signed in / session ended | `UNAUTHENTICATED`          | 401  | Authentication is required.                                                |

An email that is not an email address (for example `priya@`) shows "Please enter a valid
email address." under the email field on sign-up, sign-in and forgot password, instead of
the generic `VALIDATION_FAILED` message. The browser checks the shape before sending, and
the API's own check remains the authority. (Approved 2026-10-05 after manual testing.)

Revealing that an email is already registered (sign-up only) was accepted for usability;
sign-in and reset messages never reveal whether an account exists.

## Data

Collections follow Database Design §6 exactly; no fields are added.

- `users`: `status` is `ACTIVE` (the only status V1 uses; the document lists no values).
  Emails are trimmed and lower-cased before storage.
- `auth_sessions`: `userAgent` and `ipAddress` are recorded for the future session list.
- `password_reset_tokens`: unchanged.

## Secure by default

Every API route requires a signed-in user unless it is explicitly marked public (health
checks and the public auth endpoints above).
