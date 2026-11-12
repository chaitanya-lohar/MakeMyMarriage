# 0041 — Brevo as an email provider, without a domain

**Status:** Accepted (approved by the product owner on 2026-11-12). Amends 0025 (decisions 1
and 3 and the consequence "Email to guests needs a domain").

At the first deployment the product owner found that Resend's test sender delivers only to
the Resend account owner's address (0025), so no other user can receive a password reset or
an invitation. The product owner does not want to buy a domain and asked for a zero-cost
way to email any address. The options (verify a domain in Resend, send through a Gmail
account, Brevo with a single verified sender) and the trade-offs below were presented before
approval.

## Decisions

1. **Brevo is added as an email provider.** `EMAIL_TRANSPORT` accepts `brevo` beside `smtp`
   and `resend`. The deployed site uses Brevo on its free plan. Resend stays supported and
   needs no code change if a domain is verified later.
2. **One verified sender address, no domain.** The sender is an address the product owner
   verifies in Brevo (a Gmail address). `EMAIL_FROM` keeps the form `Name <address>` and
   must be that verified sender.
3. **Configuration.** `BREVO_API_KEY` is required when `EMAIL_TRANSPORT` is `brevo`. The API
   calls Brevo's transactional email endpoint (`POST /v3/smtp/email`) with the HTML and the
   plain-text body of each message.
4. **Behaviour is unchanged.** Invitation emails are sent during the request and password
   reset emails after the response, with no automatic retry (0025 #3 and #4).
   - A 4xx answer other than 429 is a rejection (`FAILED`, 0018 #8); 429, 5xx and network
     errors are "could not be reached".
   - Only the provider's error code is kept, never its message text.
   - Send attempts record the provider as `BREVO` (`invitation_deliveries.provider`).
5. **Out of scope.** No Brevo templates, contacts, marketing features or delivery webhooks.
   Delivery statuses stay as in 0025: Sent is the highest status.

## Consequences

- **The sender shown to recipients is a Brevo address.** Brevo cannot authenticate a free
  address such as `gmail.com`, so it replaces the domain part of the sender with one of its
  own. The name stays "MakeMyMarriage".
- **More mail may land in Spam or Promotions** than with a verified domain. Organizers can
  still share invitations with Copy link or WhatsApp.
- **Daily limit.** Brevo's free plan allows about 300 emails a day (from third-party
  sources; to be confirmed in the account). Sends beyond it fail and are recorded `FAILED`.
- **A domain remains the lasting fix** for a public launch: verify it in Brevo or Resend and
  change `EMAIL_FROM`; no code change.

## To verify with the real account

- Brevo accepts a request that carries both the HTML and the plain-text body. If it does
  not, only the HTML body is sent.
- The API key works from Vercel, whose addresses change: if Brevo restricts API keys to
  authorised IP addresses, that restriction is switched off in the Brevo account.
- The account has passed Brevo's validation, so transactional sending is enabled.

## Superseded statements

| Source                         | Statement                                         | Resolution                                                 |
| ------------------------------ | ------------------------------------------------- | ---------------------------------------------------------- |
| 0025 #1                        | Email: Resend                                     | Brevo on the deployed site; Resend still supported (1).    |
| 0025 #3                        | Send and resend call Resend directly              | They call the configured provider (1, 4).                  |
| 0025, consequences             | Email to guests needs a domain                    | Any address is reachable through Brevo, with trade-offs.   |
| System Design v1.3             | Resend as the email provider                      | Brevo or Resend, chosen by configuration (1).              |
| Database Design v1.1 §3, §10.4 | Email provider Resend; `provider` value `RESEND`  | Brevo or Resend; `provider` is `BREVO`, `RESEND` or `SMTP` |
| API Design v1.1 §2, §32        | Resend among the external services                | Brevo or Resend (1).                                       |
| Phase 4 PRD v1.2 §2            | Invitation emails through the adapter (Resend)    | Through the adapter (Brevo or Resend).                     |
| DEPLOYMENT.md §3, §6, §9       | Resend account, `RESEND_API_KEY`, the test sender | Brevo account, `BREVO_API_KEY`, the verified sender.       |
