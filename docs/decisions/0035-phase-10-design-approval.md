# 0035 — Phase 10 design approval

**Status:** Accepted (approved by the product owner on 2026-10-28). The screens and rules
below are approved; the **wording stays draft**, as for earlier phases before 0031.

The Phase 10 screens were generated in Google Stitch (project `11709379677369700007`) from
prompts written against decision 0034, PRD v1.2 §24 and API Design §6 and §7.1. The first
round was reviewed and a list of corrections was sent to Stitch in two rounds. Stitch
reported each edit as applied, but the stored screens returned by the Stitch API did not
change, so the stored versions cannot be confirmed to contain them. Following the 0021, 0027,
0029 and 0033 precedent, **the corrections below are binding and are applied in code**; where
a stored screen differs from them, the correction wins.

## Approved screens

| Screen                      | Stitch ID                          | Approved content                                                                       |
| --------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| P10 · M1 Members list       | `b920a731ab304081b240fd306f56b771` | Members tab, owners first, ownership card, removed members, empty/loading/error        |
| P10 · M2 Invite member      | `fcce5e9eb3594ba4bbf1d0b14e3fcabb` | Invite dialog and sheet, role cards, optional permissions, validation, limits, toasts  |
| P10 · M3 Invitations        | `506a3d5da6584b93ab0d22accb50a46f` | Invitations tab, status filters, resend and revoke dialogs, resend limit, admin view   |
| P10 · M4 Member detail      | `48a99940aae245f7b442996e393d613b` | Role, permissions table (accordion on mobile), the five access variants                |
| P10 · M5 Confirmations      | `f66b79a0d86c4351bf098b18e26c3f9c` | Remove-member and change-role dialogs and sheets, their toasts                         |
| P10 · M6 Ownership transfer | `04af2f6e9330437f8433e2843971b0dd` | Owner's two-step offer, pending banner and cancel, errors, recipient banner and dialog |
| P10 · M7 Member invitation  | `1af2a7b6c9d2448b964e22fc668e3abd` | Public invitation page: signed out, matching and other account, decline, results       |
| P10 · M8 Access states      | `d565ff95aa6d4a3e8b14e8d027e17932` | No access, locked controls, guest-link lock, removed member, dashboard, refused toast  |
| P10 · M9 Audit history      | `497706376a4c40bea4a7099729cbcdd6` | Read-only list, filters, "Load more", empty/loading/error                              |
| P10 · M10 Member pickers    | `958459cbe19c40d485fa94727be27753` | Task assignee picker and payment payer picker, **only** these fields                   |
| P10 · M11 Wedding selector  | `accb50c15403406ea72c2ce9c81e178e` | Selector, single-wedding block, mobile sheet, after switching, no access, states       |

Everything else on the M10 task and payment forms follows the approved P7 · T3 and P8 · E5
unchanged. Specification panels, technical annotations, design-token lines and footers on the
boards are not part of any approved screen.

## Product decisions made at design review

1. **Members navigation:** the Members item is shown to every active member, including
   Viewers. Every action and every detail field on the page still follows the user's
   permissions (API Design §7.1: the directory form for all members, details with
   `MEMBERS:VIEW`).
2. **Role changes keep overrides:** changing a member's role keeps their custom permission
   overrides (API Design §7.1). Effective permissions are recalculated from the new role's
   defaults and the existing overrides, subject to protected actions and the grant ceiling
   (Database Design §8.3–§8.4). Re-inviting a removed member stays a separate workflow and
   clears old overrides (P10-3).
3. **Ownership-offer banner:** the recipient's banner keeps a **Dismiss** button. Dismissing
   only hides the banner; the offer stays on the Members page ("Ownership offer for you")
   until it is accepted, declined or cancelled (0034 R3).
4. **Wedding selector:** a user in several weddings chooses the wedding from the wedding
   block at the top of the navigation, which lists each wedding's name, date, city and the
   user's role in it. Switching changes the whole workspace context. Every page, API call and
   query checks the membership and permissions of the selected wedding; permissions never
   carry across weddings. With one wedding the block is plain text. Rules: System Design
   §7.12, API Design §6.
5. **Remembered selection (technical choice):** the selected wedding is remembered on the
   device and checked against the user's current weddings on every load (System Design
   §7.12).

## Corrections applied in code

Shared:

- The user menu and pickers show "Owner", never "Owner (Bride)" or "Owner (Groom)"
  (bride/groom labels belong to Phase 16).
- No technical jargon in the product ("sovereign", "tenant", "ledger", "RBAC", HTTP codes,
  "immutable"); no Undo anywhere (no such feature).
- Organizer management (`MEMBERS`) actions are grantable by an owner; only making someone an
  Admin and managing Admins are owner-only (P10-4). They are never shown as locked for
  owners.

Per screen:

| Screen | Correction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1     | Ownership card: "A wedding can have up to two owners. Owners have full access and cannot be removed by other members." Empty state: "Invite family members, friends, planners or coordinators to help plan." (no partners). Error body: "Please try again."                                                                                                                                                                                                                                                           |
| M2     | The Organizer management row is editable, with "Owners can grant these. Only owners can make someone an Admin."; for an admin, actions they do not hold are disabled with "You can only allow actions you have yourself". The Expenses row reads "Expenses and payments".                                                                                                                                                                                                                                             |
| M3     | Owners see Resend and Revoke on every pending invitation, including Admin ones; only a non-owner sees "Owner only" on an Admin invitation. The tab badge counts pending invitations. The Pending filter shows only pending rows, on mobile too.                                                                                                                                                                                                                                                                       |
| M4     | Organizer management editable, note "Owners can grant these. Only owners can make someone an Admin or manage admins." A default-off action shows "Not allowed", never "Denied for this member". Under Save role: "Changing the role keeps the custom permissions set for this member." Owner's page: "Owners have full access. Their access cannot be changed."                                                                                                                                                       |
| M5     | Change role: "Custom permissions set for Rohan stay in place." and "Can still view events, guests, tasks, expenses and vendors"; never that overrides are cleared. The removal toast has no Undo.                                                                                                                                                                                                                                                                                                                     |
| M6     | No "Resend notification" and no email to the recipient (none is specified). Pending banner: "Until Priya accepts, you stay an owner." Recipient banner keeps Dismiss with "Dismissing hides this banner. The offer stays on the Members page."; the recipient's Members page shows "Ownership offer for you" with Review. Recipient dialog: "You will have full access to this wedding, including managing members and admins. Diya will become an Admin." Errors in plain words.                                     |
| M7     | Signed-in state: "Signed in as me***@gmail.com" (no "verified": P10-1). Declining does not notify anyone (no notification is specified). Expired, revoked and declined results end with "Go to home". Accepted: "You've joined Aarav & Diya as an Organizer."                                                                                                                                                                                                                                                         |
| M8     | The no-access example is Audit history (viewers can see expenses). The Members item is in every member's navigation. A member without `INVITATIONS:SEND` never sees a guest link or token: the panel shows "Link active" and "Only owners can send or copy guest links." with an "Owner only" chip (unless an override allows it). The viewer's dashboard keeps every card they can view and omits only the ones they cannot. Removed member: "An owner removed your access. Everything you added stays in the plan." |
| M9     | Only recorded actions appear (Database Design §22); no "System Automation" person. Subtitle: "Changes made in this wedding, newest first." No extra navigation item: Audit history is reached from the Members page by people with `AUDIT:VIEW`. Error: "We couldn't load the audit history. Please try again."                                                                                                                                                                                                       |
| M10    | Picker rows show only initials, name and an "Owner" tag (the member directory has no role or email). Order: you first, then owners, then by name. Helper text: "Choosing someone does not give them access." Former payer: "Sunita Rao (former member)" (0030).                                                                                                                                                                                                                                                       |
| M11    | No-access page body: "An owner removed your access to this wedding." (no archiving: not in Phase 10). Load error body: "Please try again." No "Scoped access" tag and no "Switch workspace" subtitle.                                                                                                                                                                                                                                                                                                                 |

## Wording

All Phase 10 wording is draft and is reviewed with the screens built, as in 0031.

## Superseded and clarified statements

| Source                        | Statement                                              | Resolution                                         |
| ----------------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| Web app as built (Phases 3–9) | The workspace shows the user's first wedding           | A wedding selector and remembered selection (4, 5) |
| API Design v1.1 §6            | `GET /weddings` lists weddings without the user's role | Each item carries the caller's membership (4)      |
| Stitch P10 screens as stored  | Text that differs from the corrections above           | The corrections win                                |
