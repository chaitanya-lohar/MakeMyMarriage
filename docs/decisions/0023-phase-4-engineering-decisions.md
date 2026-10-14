# 0023 — Phase 4 engineering decisions

**Status:** Accepted (approved by the product owner on 2026-10-11). Decision 1 is superseded
by 0025: there are no automatic retries.

Phase 4 (PR #12) implemented four behaviours that the specifications left open. The product
owner reviewed each against its alternatives and approved them as listed here. Decisions 1, 3
and 4 keep the behaviour as built; decision 2 changes the rate limits.

## Decisions

1. **An unreachable email service.** When every automatic retry of an invitation email fails
   before the provider accepts or rejects it, one `FAILED` send attempt is recorded with the
   reason "The email service could not be reached.", and the invitation's current email
   status becomes `FAILED`.
   - RSVPs, other guests and other sends are not affected; a later send works normally.
   - An immediate provider rejection remains `FAILED` under 0018 #8.
   - No new status is introduced, and the failed attempt is never left out.
2. **Guest-link rate limits.** The account-free invitation routes (`/guest/invitations/{token}`
   and `…/rsvp`) allow **120 requests a minute per IP address** and **60 a minute per
   invitation link**. Exceeding either returns `429 RATE_LIMITED`.
   - Every request counts, including requests with invalid links.
   - Both limits apply together: the per-IP limit allows for shared networks such as a
     venue's Wi-Fi, and the per-link limit protects each invitation.
3. **Guest list order.** `GET …/guests` sorts alphabetically by guest name, ignoring case, with
   the guest ID as a tie-breaker, so cursor pagination stays stable. The same order applies to
   every page. Newest-first and oldest-first were not chosen.
4. **Invitation link opens.** Every open is stored as activity (`invitation_activities`), and
   the first-open time is kept on the invitation.
   - An open never changes the email status.
   - The organizer screen keeps the note "Shows that the link was opened — not that the email
     was delivered."
   - Storing only the first open, or the first and latest, was not chosen.

## Superseded statements

| Source                | Statement                                                                                       | Resolution                                        |
| --------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Phase 4 PRD v1.2 §7.3 | `FAILED` only when the provider rejects the request immediately                                 | Also after every retry fails (decision 1).        |
| Phase 4 PRD v1.2 §7.3 | Storing or de-duplicating repeated opens is an implementation choice                            | Every open is stored (decision 4).                |
| Phase 4 PRD v1.2 §12  | De-duplication of repeated opens listed as deferred                                             | Decided (decision 4).                             |
| Database Design §10.3 | `FAILED` on an immediate provider rejection                                                     | Also after every retry fails (decision 1).        |
| Database Design §10.5 | Storing or de-duplicating repeated opens is an implementation choice                            | Every open is stored (decision 4).                |
| API Design v1.1 §9    | Guest list order not stated                                                                     | Alphabetical, ignoring case (decision 3).         |
| API Design v1.1 §10   | Guest routes rate-limited per token and IP, no thresholds; `FAILED` on immediate rejection only | 120 per IP, 60 per link (decision 2); decision 1. |
| API Design v1.1 §35   | Phase 4 guest-route limits as engineering defaults (60 per IP, 30 per link)                     | Approved limits (decision 2).                     |
