# 0016 — Wedding setup and dashboard shell (Phase 3)

**Status:** Accepted (scope and Stitch designs approved 2026-10-04).

Implements wedding creation, the wedding dashboard and wedding details for the signed-in
workspace: PRD v1.1 §8 and §18 (countdown and wedding details only), API Design v1.0 §6,
Database Design v1.0 §7.1–7.2, and decisions 0010 (#9, #17, #18) and 0012.

## Scope

In Phase 3: create a wedding, see it on the dashboard, and edit its details. Signing up
still creates only the user (0012); a user without a wedding sees "No wedding yet" and is
never forced into the form.

Not in Phase 3: cover image, theme, website (the Website phase creates it and backfills
existing weddings), ownerType (bride/groom) UI, timezone UI, deleting or archiving a
wedding, other dashboard summaries (they arrive with their modules), and the
`/dashboard` and `/settings` endpoints.

## Wedding fields

| Field        | Rule                                               | Stored as (Database Design §7.1) |
| ------------ | -------------------------------------------------- | -------------------------------- |
| Bride's name | Required, 1–100 characters after trimming          | `brideName` (0010 #9)            |
| Groom's name | Required, 1–100 characters after trimming          | `groomName` (0010 #9)            |
| Wedding date | Optional single calendar date; past dates allowed  | `startDate`                      |
| Venue name   | Optional, at most 120 characters                   | `venueName` (new field)          |
| City         | Optional, at most 120 characters                   | `primaryCity`                    |
| Description  | Optional, at most 1,000 characters                 | `description`                    |
| Display name | Always "{Bride} & {Groom}", generated, never typed | `displayName`                    |
| Timezone     | `Asia/Kolkata`, no UI                              | `timezone`                       |

`endDate` is not used. Optional fields can be cleared; an empty value is stored as absent.
`displayName` has no length limit of its own and is regenerated whenever a name changes.

## API

| Endpoint                      | Purpose                                                 |
| ----------------------------- | ------------------------------------------------------- |
| `POST /api/v1/weddings`       | Create the user's wedding; the user becomes its `OWNER` |
| `GET /api/v1/weddings`        | Weddings in which the user has an `ACTIVE` membership   |
| `GET /api/v1/weddings/{id}`   | One wedding                                             |
| `PATCH /api/v1/weddings/{id}` | Update the wedding's details                            |

- `GET /weddings` (a list, so it stays correct once users join other weddings) is approved
  in addition to the API Design §6 routes. There is no `DELETE` in Phase 3.
- Request and response fields use the stored names above. The date is a `YYYY-MM-DD`
  calendar date. Responses also carry `id`, `displayName` and `timezone`.
- A user who already owns a wedding gets 409 `WEDDING_ALREADY_OWNED`.
- A wedding the user is not an active member of, or an invalid id, gets 404
  `WEDDING_NOT_FOUND`, so the API never reveals whether a wedding exists.
- Only `OWNER` members exist in Phase 3; they may edit. Permissions for other roles arrive
  with Organizers and permissions (Phase 10).

## Data and modules

- `weddings` module: the `weddings` collection, the endpoints and the use-cases.
- `workspace` module: the `wedding_memberships` collection (Database Design §7.2) and the
  membership check every wedding route uses.
- Creating a wedding writes the wedding and its `OWNER` membership (`memberType: OWNER`,
  `role: OWNER`, `status: ACTIVE`) in one MongoDB transaction.
- At most one `OWNER` membership per user (0010 #18, 0012): checked before creating, and
  guaranteed by a partial unique index on `userId` for owner memberships. Which statuses
  count after a partner disconnects is part of A5 (0011) and may change this index.
- Memberships are also unique per `(userId, weddingId)` (Database Design §7.2).

## UI

Source of truth: the Stitch screens titled "P3 · …" in project `11709379677369700007`,
corrected as listed below.

| Route          | Screens                                                                     |
| -------------- | --------------------------------------------------------------------------- |
| (all)          | S1 Loading, Desktop sidebar and user menu, Mobile drawer (before/after)     |
| `/dashboard`   | S2 No wedding yet, or S4 Dashboard (normal, just created, countdown states) |
| `/wedding/new` | S3 Create wedding (default, example, validation, submission states)         |
| `/wedding`     | S5 Wedding details (edit, saving and error states)                          |
| (wedding gone) | S6 Not available                                                            |

- The workspace navigation has only Dashboard and Wedding details; before a wedding exists
  it shows only the logo and the user.
- The logo in the workspace (sidebar and mobile header) opens the home page, as on the
  sign-in pages; Dashboard in the navigation leads back. The home page header stays the
  same for signed-in users. (Approved 2026-10-07 after manual testing.)
- After creating, the user lands on the dashboard with the toast "Your wedding has been
  created."
- Saving wedding details stays on the page and shows "Your changes have been saved.";
  Cancel restores the saved values, with no confirmation dialog.
- The display-name preview ("Your wedding will appear as: …") shows only when both names
  are filled in.
- The countdown counts calendar days in the wedding's timezone: "1 day to go", "N days to
  go", "Today is your wedding day", "Celebrated on {date}", or "Wedding date not set" with
  "Add a date".
- The sidebar shows the wedding name on at most two lines, then an ellipsis; the dashboard
  heading wraps.
- Loading the workspace fails gracefully with "We couldn't load your wedding details" and
  Try again (the S5 state), and a signed-out session goes to `/login` as in 0015.

### Spec overrides (the written scope wins over Stitch)

- S2 desktop sidebar: logo and user block only — no "Workspace Inactive" card.
- S5 mobile: "(optional)" in labels and the approved placeholders, as on desktop.
- S3 validation: the sample description length is irrelevant; mobile has no asterisks.
- S6 mobile: no "Need help? Contact your wedding host".

### Stitch inconsistencies corrected in code

- The real Logo component everywhere: no "M", gem, lotus or dot marks, and no sidebar
  eyebrows ("Active Celebration", "Celebration", "Wedding").
- Icons: Wedding details `edit_note`, date `calendar_month`, an info icon on the "already
  have a wedding" banner.
- Primary buttons are midnight navy (0015), not Stitch's black `primary`.
- Placeholders are "e.g. Meera Sharma", "e.g. Arjun Patel", "e.g. Lakeside Garden",
  "e.g. Jaipur", "DD / MM / YYYY" and "A short message about your wedding"; field icons sit
  inside the inputs; detail labels use sentence case as on S4 Normal.
- S4 Just created is S4 Normal plus the toast.
- Touch targets at least 44px on mobile, muted text at 4.5:1 contrast, and fonts from
  `next/font`.

## Messages

| Situation                    | Message                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| Bride's name missing         | Enter the bride's name.                                                                |
| Groom's name missing         | Enter the groom's name.                                                                |
| Name too long                | Use 100 characters or fewer.                                                           |
| Venue or city too long       | Use 120 characters or fewer.                                                           |
| Description too long         | Use 1,000 characters or fewer.                                                         |
| Invalid date                 | Enter a valid date.                                                                    |
| Creating                     | Creating your wedding…                                                                 |
| Create failed (server)       | We couldn't create your wedding. Please try again.                                     |
| Network failure              | We couldn't reach MakeMyMarriage. Check your connection and try again.                 |
| Already owns a wedding (409) | You already have a wedding. Each account can own one wedding. [Go to your dashboard]   |
| Saving                       | Saving…                                                                                |
| Save failed (server)         | We couldn't save your changes. Please try again.                                       |
| Not available                | This page isn't available. It may have been removed, or you may not have access to it. |
