# MakeMyMarriage — Product Requirements Document v1.2

Production-ready wedding planning and management platform for Indian weddings.

| Item         | Value                                                                                                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product      | MakeMyMarriage                                                                                                                                                                                     |
| Version      | 1.2 (consolidated master)                                                                                                                                                                          |
| Status       | **Canonical** product baseline                                                                                                                                                                     |
| Date         | 2026-10-10                                                                                                                                                                                         |
| Users        | Bride, Groom, Organizers, Guests                                                                                                                                                                   |
| Deployment   | Public online product                                                                                                                                                                              |
| Supersedes   | PRD v1.1 and PRD v1.0 (archived in `docs/archive/specs/`)                                                                                                                                          |
| Feature PRDs | [Phase 4 — Events, guests, RSVP and invitations](PHASE_4_PRD_v1.2.md); [Phase 7 — Tasks](PHASE_7_PRD_v1.0.md); [Phase 8 — Expenses](PHASE_8_PRD_v1.0.md); [Phase 9 — Vendors](PHASE_9_PRD_v1.0.md) |

## Document control

- This document carries forward every still-valid requirement of PRD v1.1 and applies the
  approved decision records 0001–0019. Where a requirement changed, the section names the
  decision that changed it.
- Decision records remain the history of _why_ something changed. If this document and a
  later approved decision record disagree, the decision record wins for the scope it covers
  (decision 0004), and this document is corrected.
- Items marked **Deferred** or **Open** are not decided. They are not implemented until an
  approved decision converts them into requirements.

| Version | Date       | Change                                                                                                                                       |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-09    | Original PRD.                                                                                                                                |
| 1.1     | 2026-09    | Product scope baseline.                                                                                                                      |
| 1.2     | 2026-10-10 | Consolidated master: PRD v1.1 plus decisions 0008–0018 and the product-owner answers of 2026-10-10 (Q1–Q8, invitation token, smaller rules). |
| 1.2     | 2026-10-20 | Decision 0028: §15 and §18 updated for Phase 8 (expenses).                                                                                   |
| 1.2     | 2026-10-24 | Decision 0032: §15, §17, §18 and §30 updated for Phase 9 (vendors and bookings; discovery and attachments deferred).                         |
| 1.2     | 2026-10-27 | Phase 10 requirements and decisions P10-1–P10-8 (product owner): §24 default role matrix approved; §30 updated.                              |
| 1.2     | 2026-11-03 | Decision 0038 (Phase 16): §7, §9, §23, §30, §31 updated — one shared wedding (A4) and leaving (A5).                                          |

## 1. Executive summary

MakeMyMarriage is a web-based wedding management platform that centralizes the planning and
execution of Indian weddings. The bride and groom each keep their own access to the wedding
and may connect as partners. The platform covers wedding setup, events, guests, event-level
RSVP, digital invitations, reminders, expenses, tasks, vendors, a wedding website, photo
memories, QR-based uploads, live-stream integration, reporting and permission-driven
administration.

The product is intended to be a real public service, so V1 includes production
requirements: authentication, authorization, secure media handling, validation,
auditability, monitoring, backups, testing and deployment automation.

## 2. Problem statement

Indian weddings involve multiple events, large guest lists, invitations, RSVPs, vendors,
expenses, tasks, venues and photos. Information is scattered across WhatsApp, spreadsheets,
calls and paper notes, which causes missed tasks, unclear attendance, duplicated
communication and poor visibility of the wedding as a whole.

MakeMyMarriage provides one organized system of record without merging the bride's and
groom's accounts.

## 3. Product vision

Make wedding planning easier to organize, share, track and experience by bringing the
important operational and guest-facing parts of an Indian wedding into one secure platform.

## 4. Product goals

- Independent bride and groom accounts, each able to run the wedding.
- Optional partner connection without merging accounts.
- Simple event, guest, RSVP, task, expense and vendor management.
- A digital invitation and a publishable wedding website.
- Account-free guest photo contribution through QR codes.
- Dashboard, reporting and permission-driven administration.
- Architecture suitable for public production deployment.

## 5. Non-goals for V1

- Accommodation management.
- Transportation management.
- AI wedding assistant.
- Advanced catering management.
- Highly customizable website builder.
- Multiple event-specific invitation designs as a core V1 capability.
- In-house live-streaming infrastructure.
- Mandatory paid WhatsApp or SMS API integrations.
- Owning more than one wedding per account (participating in other weddings as a non-owner
  member is allowed — section 7).
- Video upload (photos only — section 20).
- PDF report export (Excel only — section 26).

## 6. User types

| User      | Purpose                                                                                     |
| --------- | ------------------------------------------------------------------------------------------- |
| Bride     | Owns and manages the wedding.                                                               |
| Groom     | Owns and manages the wedding.                                                               |
| Organizer | Helps manage the wedding according to permissions.                                          |
| Guest     | Receives an invitation, responds to event RSVPs and may upload photos — without an account. |

## 7. Account, wedding and workspace model

Decisions 0012 (C1, C2, N1) and 0009.

- **Signup creates the user account only.** A newly registered user may have no wedding.
  Wedding creation is a separate step (`POST /api/v1/weddings`) and is never forced into
  signup.
- **A user owns at most one wedding.** The creator becomes its `OWNER` member. A user may
  participate in other weddings through non-owner memberships, subject to the membership
  and sharing rules.
- **Partner connection never merges accounts.** When partner A connects with partner B,
  both become `OWNER` members of the same wedding; B does not get a second wedding.
- **A partner connection cannot be accepted while the invitee owns a wedding** (N1). The
  system never merges weddings, archives or deletes the invitee's wedding, or silently
  transfers ownership; the invitee first transfers their wedding's ownership (0038 D6).
- **"Independent workspaces"** means each partner keeps their own account and their own
  access; it does not mean separate weddings. **The wedding is shared by both partners**:
  every wedding resource, expenses included (0009), is shared; only personal account
  information stays private (0038 D1).
- Server-side authorization is mandatory for every protected operation.

## 8. Wedding setup

Decision 0016.

Either the bride or the groom can create the wedding.

| Field        | Rule                                                                |
| ------------ | ------------------------------------------------------------------- |
| Bride's name | Required, 1–100 characters after trimming.                          |
| Groom's name | Required, 1–100 characters after trimming.                          |
| Wedding date | Optional single calendar date; past dates are allowed.              |
| Venue name   | Optional, at most 120 characters.                                   |
| City         | Optional, at most 120 characters.                                   |
| Description  | Optional, at most 1,000 characters.                                 |
| Display name | Always "{Bride} & {Groom}", generated and never typed.              |
| Timezone     | `Asia/Kolkata`, stored on the wedding; no timezone selection in V1. |

- Owner type (bride or groom) is not collected in V1.
- **Cover image** and a **wedding theme selector** are part of V1 scope but **deferred to a
  later phase**. "Regal Modernity" is the application's design system, not a wedding theme.
- Creating a wedding does **not** create the wedding website or any public identifier
  (section 19).
- A signed-in user with no wedding sees a dedicated "No wedding yet" screen offering
  "Create your wedding" and "Sign out".
- Only implemented navigation is shown; the workspace never advertises modules that are not
  built yet.

## 9. Event management

Decisions 0010 (#10) and 0017; product-owner answer Q7 (2026-10-10).

- Create predefined and custom events: Engagement, Mehendi, Haldi, Sangeet, Wedding,
  Reception, or a custom event.
- Each event may have its own venue.
- Event dates and times are in the wedding's timezone. Past dates are valid.
- Deleting an event removes it from active lists and counts but preserves its RSVP history
  and invitation delivery history (section 12).

| Field                                                                                      | V1       | Delivered in                              |
| ------------------------------------------------------------------------------------------ | -------- | ----------------------------------------- |
| Name                                                                                       | Required | Phase 4                                   |
| Event type (`ENGAGEMENT`, `MEHENDI`, `HALDI`, `SANGEET`, `WEDDING`, `RECEPTION`, `CUSTOM`) | Required | Phase 4                                   |
| Date                                                                                       | Required | Phase 4                                   |
| Start time, end time                                                                       | Optional | Phase 4                                   |
| Description                                                                                | Optional | Phase 4                                   |
| Venue name and address                                                                     | Optional | Phase 4                                   |
| Dress code                                                                                 | Optional | Phase 4                                   |
| Notes                                                                                      | Optional | Phase 4                                   |
| Map location (latitude/longitude)                                                          | Optional | Later phase                               |
| Cover image                                                                                | Optional | Later phase                               |
| Public/website visibility (`isPublic`)                                                     | —        | Later phase (Wedding website)             |
| Public event identifier (`publicId`)                                                       | —        | Later phase                               |
| Instructions                                                                               | —        | Later phase, once its purpose is approved |

- Events are shared by both partners, like every wedding resource; there is no per-event
  sharing (0038 D1).

## 10. Guest management

Guest management is intentionally lightweight. Guests do not need MakeMyMarriage accounts.

| Field         | Required | Rule                                                                                                        |
| ------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| Guest name    | Yes      | Trimmed, 1–100 characters.                                                                                  |
| Mobile number | Yes      | 7–15 digits, an optional leading `+`, spaces and hyphens allowed as separators; no country-specific format. |
| Email         | No       | Must be a valid email address when given; used for email invitations.                                       |
| Relation      | No       | Family, friend, colleague, etc.                                                                             |
| Notes         | No       | Private organizer notes; never shown to guests.                                                             |

- One guest record per wedding; guest identity is separate from event participation.
- A guest can be invited to any number of events.
- The mobile check validates the input format only; it does not verify that the number is
  active or belongs to the guest.
- A likely duplicate mobile number within the same wedding shows a warning but does not
  block saving, and records are never merged automatically (0017). Mobile numbers are
  normalized before duplicate detection.
- There is no user-facing limit on the number of guests.
- Guest-facing links use secure tokens and never expose database IDs.

## 11. Event-level RSVP

Decision 0017; product-owner answer Q8a.

RSVP belongs to the guest–event relationship, not to the guest.

| Guest | Event     | RSVP      | Attendees |
| ----- | --------- | --------- | --------- |
| Raju  | Haldi     | Attending | 4         |
| Raju  | Sangeet   | Declined  | 0         |
| Raju  | Wedding   | Attending | 4         |
| Raju  | Reception | Pending   | —         |

| RSVP status | Meaning                  | Attendee count                |
| ----------- | ------------------------ | ----------------------------- |
| Pending     | No response yet.         | Empty (`null`).               |
| Attending   | Accepts the invitation.  | A whole number of at least 1. |
| Declined    | Declines the invitation. | 0.                            |
| Maybe       | Not yet confirming.      | Empty (`null`).               |

- The attendee count is the total number of people covered by the RSVP, including the
  named guest. Companions are represented by the count only.
- There is no user-facing upper limit on the attendee count.
- Changing one event's RSVP never changes another event's RSVP or the invitation's
  delivery history.
- A guest cannot change an RSVP back to Pending after responding; they may change it to any
  other response.
- RSVPs do not lock automatically when an event starts.
- Organizers can update RSVPs on behalf of guests, including resetting one to Pending;
  every reset is recorded in the audit history (0018).

## 12. Guest invitation lifecycle

Decisions 0008, 0017 and 0018; product-owner answers Q2 and Q8d.

One invitation per guest covers all of that guest's applicable events; RSVP stays per
event. Delivery state, activity history and RSVP state are three separate things.

| Delivery status | Meaning                                                                   |
| --------------- | ------------------------------------------------------------------------- |
| Draft           | Prepared but not sent.                                                    |
| Sent            | The email provider accepted the send request.                             |
| Delivered       | The provider confirmed delivery.                                          |
| Failed          | The provider rejected the send request, or reported that delivery failed. |

- **Opens are activity history, not a delivery status.** Opening an invitation never
  overwrites Delivered or Failed. The first-open time is always kept.
- **Delivered depends on provider delivery events (webhooks).** Until those are implemented
  and approved, **Sent is the highest status the product shows**, and the product never
  claims a delivery the provider has not confirmed.
- An **immediate rejection** of a send request by the provider marks that send attempt
  Failed, and the invitation's current status follows its latest attempt (0018). A Failed
  status reported later by the provider also needs webhooks.
- Resending never creates duplicate guests or RSVPs; every send and resend attempt is kept
  in the invitation's history.
- Guest access uses a secure, random, non-guessable token. It is stored as a hash (to check
  guest requests) and as an encrypted copy (so the platform can send and resend the
  invitation email); the encryption key is kept outside the database (0018).
- The same token is reused for every resend and when the guest's contact details change.
- Regenerating or revoking a token invalidates the previous one. **Deleting a guest revokes
  their token**: the link stops working immediately (0018).
- **Tokens do not expire automatically in V1 (Phase 4).** The organizer can revoke or
  regenerate a token at any time. Trade-off accepted: a link that is not revoked remains
  usable indefinitely (0017).
- Organizers can retrieve the current link at any time; retrieving or sharing it never
  creates a new token, and each retrieval is recorded in the audit history (0019).

## 13. Digital wedding invitation

- V1 uses one invitation containing the wedding's applicable events for that guest.
- The invitation shows the couple, the date, the guest's event schedule and venues, and
  per-event RSVP. The website link, map and countdown are added when those features exist.
- Copy Link copies the guest's current invitation link; sharing reuses it, and only
  regenerating replaces it (0019).
- The WhatsApp button opens the user's own WhatsApp sharing flow with a prefilled message
  and link; no WhatsApp API is used.
- The platform sends email invitations itself.

## 14. Automatic reminders and notifications

- An automated reminder engine for guests and organizers is in V1 scope.
- The design is channel-agnostic so email, in-app, WhatsApp and SMS can be added
  independently.
- **Deferred:** exact cadence, schedules, channels and user customization. Configurable
  reminder schedules are not implemented until an approved decision defines them.

## 15. Expense tracker

Decisions 0009, 0010 (#5–#8), 0018 and 0028; specified in the
[Phase 8 PRD v1.0](PHASE_8_PRD_v1.0.md).

- Track actual expenses rather than a full budgeting product.
- Expense fields: title, amount (the full cost), category, date, optional event, optional
  vendor (chosen from the wedding's vendors from Phase 9 — 0032 #8) and notes. Receipts are deferred until a
  file-storage decision (0028 #3).
- Category is one fixed value: `VENUE`, `CATERING`, `DECORATION`, `PHOTOGRAPHY`, `CLOTHING`,
  `JEWELLERY`, `MAKEUP`, `ENTERTAINMENT`, `INVITATIONS`, `GIFTS`, `MISCELLANEOUS`.
- An expense can have several payments (advances, instalments, settlement). Each payment
  records its amount, date, who paid (a wedding member or a typed name, such as the bride's
  father), payment method and reference (0028 #12, #13).
- Payment status — Paid, Pending or Partially paid — is calculated from the payments, never
  entered (0028 #7). Payments never exceed the amount (0028 #9, #10). There is no Cancelled
  status in V1 (0018); adding one needs a decision, because it changes totals, the
  pending-payments summary, reports and payment validation.
- **Expenses are automatically shared with the connected partner.** There is no per-expense
  visibility setting. Authorization still applies to every read and write.
- Dashboard summaries: total spending, pending payments, category-wise and event-wise
  spending.

## 16. Task planner

Decisions 0010 (#3, #4), 0013 and 0026; specified in the
[Phase 7 PRD v1.0](PHASE_7_PRD_v1.0.md).

- Wedding-level or event-level tasks.
- Fields: title, description, due date, priority, status, assignee(s), event and notes.
  **Attachments are deferred** to the first phase that adds file storage (0026 #3).
- Statuses: To do, In progress, Blocked, Completed, Cancelled.
- Overdue and upcoming tasks appear on the dashboard.
- Reporting: To do and In progress count as Pending; Blocked as Blocked; Completed as
  Completed; Cancelled is excluded from all counts. Overdue is an additional dimension:
  due date before today in the wedding's timezone and status neither Completed nor
  Cancelled (0026 #8).

## 17. Vendor management and vendor discovery

Decision 0032; specified in the [Phase 9 PRD v1.0](PHASE_9_PRD_v1.0.md).

- Vendor management is in scope: each wedding keeps its own vendors — name, fixed category,
  contact person, phone, email, address, website and notes.
- A vendor can have several **bookings**, one per service. Each booking has its own status,
  event or whole wedding, booking date, service date, optional agreed price and notes
  (0032 #4, #5).
- Booking status: Not contacted, Contacted, Quotation received, Negotiating, Booked,
  Cancelled. Any status may change to any other; bookings are cancelled, never deleted
  (0032 #12–#14).
- Categories: Venue (including marriage gardens), Catering, Photography & Videography,
  Decoration & Flowers, Makeup & Beauty, Clothing & Jewellery, Entertainment & DJ,
  Invitations & Printing, Transportation, Wedding Planner, Mehendi, Other (0032 #9).
- Vendor money is recorded as expenses linked to the vendor, never in a separate ledger
  (0032 #8). Deleting a vendor is soft, is refused while it has bookings that are not
  cancelled, and never changes its expenses (0032 #15).
- **Deferred (0032 #3, #6, #7):** vendor discovery through Google Maps Platform Places API
  (New), behind a provider abstraction, with "Add to My Vendors" and the exact Google fields
  that may be stored under the provider's terms; vendor attachments; copying vendors between
  weddings. Quotation tracking is not planned. There is no public vendor marketplace.

## 18. Wedding dashboard

- Wedding countdown; upcoming events; guest totals; RSVP status; expected attendees;
  expense totals; pending payments; task completion; overdue tasks; alerts and reminders;
  relevant shared information.
- Each summary appears when its module is built. Phase 3 shows the countdown (days to go,
  wedding day, celebrated, or no date set) and the wedding details (0016). Phase 4 adds
  upcoming events, guest totals, RSVP breakdown and expected attendees, with the rules in
  the Phase 4 PRD §10.2 (0019). Phase 7 adds task counts (Pending, Blocked, Completed,
  Overdue) and up to five upcoming tasks (Phase 7 PRD §8, 0026 #20). Phase 8 adds the
  expense summary: Total, Paid and Pending, and spending by category and by event (Phase 8
  PRD §8, 0028 #23). Phase 9 adds the vendor summary: active vendors, booked vendors,
  bookings needing follow-up and up to five upcoming booked services (Phase 9 PRD §7,
  0032 #24).

## 19. Wedding website

Decision 0016; product-owner answer Q4.

- The wedding website is **created by the Wedding website phase**, not when the wedding is
  created; that phase also creates websites for weddings that already exist. A new website
  starts private (Draft); the owner or an authorized admin publishes it explicitly.
- States: Draft (created, private), Published (public), Unpublished (previously published,
  now private).
- Public URL: `https://makemymarriage.com/w/{public-identifier}`. The identifier is unique,
  non-sensitive and independent of internal IDs.
- Pages: Home (couple names, message, date and countdown, introduction, venue,
  call to action), Our Story, Events and event-detail pages, RSVP, Gallery, Live Stream,
  Share Your Memories.
- Event pages can show date and time, venue, address and map, description, dress code,
  instructions and image.
- The website can be unpublished later. Only public or shared data is exposed; unpublished
  websites expose no private wedding data.
- **Published websites are indexable by search engines in V1.** **To specify during the
  Wedding website phase:** sitemap generation, page metadata and crawler directives.

## 20. Photo gallery and guest memories

- Only photos are uploaded in V1; video upload is out of scope.
- No user-facing limit on the number of photos.
- Photos are organized in event albums, with an optional Uncategorized album.
- Guests upload without signing in. Guest uploads are published automatically, with no
  moderation or approval step.
- Guests can delete photos they uploaded themselves.
- Owners, admins and permitted organizers manage gallery content according to their
  permissions.

## 21. Wedding memory QR

- Wedding-level or event-level QR codes.
- An event QR associates uploads with that event's album; a wedding QR lets the guest
  choose an event.
- Guest flow: scan → upload page → select photos → upload → confirmation. No sign-in.
- Organizers can download the QR for printing or display.
- QR codes use secure non-guessable tokens, never database IDs. Owners and admins can
  revoke and regenerate them.
- **Deferred:** QR expiry policy.

## 22. Live streaming

- Use an external provider: YouTube Live. No in-house streaming infrastructure.
- Associate a stream with an event; an event may have several streams over time.
- Embed the stream on the public wedding website.

## 23. Partner connection and resource sharing

Decisions 0038 (answering A4 and A5 of 0011), 0009 and 0012; specification:
[Phase 16 PRD v1.0](PHASE_16_PRD_v1.0.md).

- Either partner may invite the other by email; the invitation is valid for seven days and
  is accepted with the invited email, without other verification. Either may later leave.
- Connection never merges accounts or private data; both partners become `OWNER` members
  of the same wedding (section 7). The partner is the second owner, however they became one.
- **One shared wedding (A4):** every wedding resource — settings, events, guests, invitations
  and RSVP, tasks, expenses, vendors, members, audit history and future modules — is shared
  by both partners. There are no private resources or sharing switches; personal account
  information is never shared. Organizers see what their permissions allow.
- An invitee who owns another wedding transfers its ownership before accepting; an existing
  organizer is promoted on their membership, with custom permissions cleared.
- **Disconnection (A5):** a partner disconnects by leaving the wedding and loses access at
  once; the other partner is the sole owner; every record stays. Neither partner can remove
  the other. A former partner can be invited again; history is kept and access returns only
  on acceptance.
- Bride/groom labels are not collected (section 8).

## 24. Organizer and permission management

Approved Phase 10 requirements and decisions P10-1–P10-8 (product owner, 2026-10-27; decision
0034); technical detail in Database Design §7–§8 and §32, System Design §7.2–§7.11 and API Design §7.1.

- Owners manage organizers; different organizers can have different permissions. Owners
  invite family, friends, planners and coordinators by email; invitations need acceptance and
  expire after seven days. No email verification is required to accept (P10-1, P10-2).
- Predefined roles: Owner, Admin, Organizer, Editor, Viewer, each with default permissions
  per module, customizable per member with allow/deny overrides (deny wins).
- **Default role matrix (approved):**

  | Module                         | Owner | Admin  | Organizer | Editor | Viewer |
  | ------------------------------ | ----- | ------ | --------- | ------ | ------ |
  | Wedding settings               | Full  | Custom | No        | No     | No     |
  | Events                         | Full  | Manage | Manage    | Edit   | View   |
  | Guests                         | Full  | Manage | Manage    | Edit   | View   |
  | Invitations and RSVP           | Full  | Manage | Manage    | Edit   | View   |
  | Tasks                          | Full  | Manage | Manage    | Edit   | View   |
  | Expenses                       | Full  | Manage | View      | Edit   | View   |
  | Vendors                        | Full  | Manage | Manage    | Edit   | View   |
  | Wedding website                | Full  | Custom | No        | No     | No     |
  | Gallery and memories           | Full  | Manage | Custom    | Custom | View   |
  | Memory QR codes                | Full  | Manage | No        | No     | No     |
  | Live streaming                 | Full  | Manage | Custom    | Custom | View   |
  | Reports and exports            | Full  | Custom | Custom    | No     | No     |
  | Organizer management           | Full  | Custom | No        | No     | No     |
  | Audit history                  | Full  | Custom | No        | No     | No     |
  | Partner connection and sharing | Full  | No     | No        | No     | No     |

  Custom means no access until explicitly granted.

- Sensitive actions are never implied by ordinary access: sending guest invitation links and
  regenerating memory QR codes are owner-only by default and can be granted per member
  (P10-6). Ownership transfer, wedding archive, partner actions and changes to owners are
  owner-only.
- An Admin cannot assign the Admin role or manage other Admins (P10-4).
- A wedding has at most two owners. An owner can transfer only their own ownership seat; the
  recipient must accept, and the transferring owner becomes an Admin (P10-5).
- A removed member loses access immediately; their wedding records stay. A removed member can
  be invited again; their access returns only when they accept, with earlier custom
  permissions cleared (P10-3).
- Dashboard sections show only to members who can view that module; any active member can be
  chosen as a task assignee or payer without gaining access (P10-8).
- Authorization is enforced server-side for every protected operation.

## 25. Settings and management dashboard

Account settings; wedding settings; event settings; organizer and permission management;
partner connection and sharing; guest and invitation settings; gallery and QR settings;
website settings; notifications; privacy and security; data and export; vendor settings.
Settings are permission-driven; not every organizer can change settings.

Account settings include the session features deferred from Phase 2 (0015): sign out of all
devices, the list of active sessions with per-session sign-out, and profile editing.

## 26. Reports and analytics

Decision 0013; product-owner answer Q8c.

- Guest report: totals, RSVP breakdown and event attendance.
- Expense report: total spending and category and event breakdown.
- Task report: completed, pending, blocked and overdue (section 16).
- **Export format: Excel only in V1.** PDF export is not part of V1.
- Larger exports run asynchronously.

## 27. Security, privacy and production requirements

- Secure authentication and authorization; server-side permission enforcement.
- Input validation, rate limiting and abuse protection.
- Secure invitation and QR tokens: never stored in plain form. QR tokens are stored as
  hashes; invitation tokens as a hash plus an encrypted copy, with the key outside the
  database (0018).
- Secure file validation, storage and access control.
- HTTPS and secrets management.
- Structured logging and audit logs.
- Database migrations and backups.
- Monitoring and health checks.
- Automated unit and integration tests.
- CI/CD and deployment automation.
- Privacy controls preventing leakage through websites, invitations, galleries, APIs or
  sharing; private organizer notes never reach guest-facing responses.
- Authentication specifics (cookies, token lifetimes, password rules, reset flow, rate
  limits, messages) are defined in decision 0015.

## 28. Core user journeys

**Bride or groom**

1. Create an account.
2. Create the wedding (a separate step after signup; the user may leave it for later).
3. Complete the wedding details.
4. Create and manage events.
5. Add organizers and set permissions.
6. Add guests and assign them to events.
7. Generate and send invitations.
8. Track event RSVPs.
9. Manage tasks, expenses and vendors.
10. Generate QR codes and manage memories.
11. Configure and publish the website.
12. Optionally connect with the partner and share resources.

**Guest**

1. Open the secure invitation without an account.
2. Review the wedding and events.
3. Respond to each invited event.
4. Enter the attendee count.
5. Use the public wedding website.
6. Optionally scan a QR code and upload photos.
7. Delete photos the guest uploaded.

## 29. High-level navigation

Private workspace (each item appears once its module is built): Dashboard, Wedding details,
Events, Guests & RSVP, Invitation (managed on each guest's detail screen in Phase 4, with no
separate navigation item — 0019), Tasks, Expenses, Vendors, Gallery & Memories, Wedding
Website, Live Stream, Reports, Settings.

Public website: Home, Our Story, Events, RSVP, Gallery, Live Stream, Share Your Memories.

## 30. Deferred and open product decisions

| Area                             | Status                                                                 |
| -------------------------------- | ---------------------------------------------------------------------- |
| A4 — partner sharing scope       | Decided (0038 D1): one shared wedding; no private resources.           |
| A5 — partner disconnection       | Decided (0038 D7): the leaver loses access; the other is sole owner.   |
| Guest fields beyond the core set | Deferred until a real need is established.                             |
| Vendor management depth          | Decided for Phase 9 (0032); discovery and attachments deferred.        |
| Reminder cadence and channels    | Engine included; schedules, channels and customization deferred.       |
| Roles and permission templates   | Default matrix approved for Phase 10 (§24, 2026-10-27).                |
| QR expiry                        | Deferred. Revoke and regenerate are approved.                          |
| Invitation token expiry          | No automatic expiry in V1 (0017); revisit only through a new decision. |

| Delivered status, and Failed reported after acceptance | Depend on provider webhooks, which are not yet approved; Sent is the highest status shown until then. Immediate rejections are Failed (0018). |
| Expense payment status Cancelled | Not in V1 (0018); needs a decision to add. |
| Audit, delivery-history and data retention periods; permanent deletion | Deferred; to be set before production launch. |
| Website sitemap, metadata and crawler directives | To specify in the Wedding website phase. |
| Provider webhook, retry and backoff details | To specify per integration. |
| Overnight events (end time after midnight) and locale-specific phone formatting | Deferred (Phase 4 PRD). |

## 31. Product principles

- Private by default: personal accounts and anything not explicitly public stay private;
  within a wedding, access follows membership and permissions.
- The bride and groom keep their own accounts; connection never merges them.
- Connected partners share the whole wedding (0038 D1); organizers see what their role
  allows.
- Guests do not need accounts for invitations, RSVP or memory uploads.
- Keep guest management simple.
- Prefer external integrations over rebuilding non-core infrastructure.
- Do not block V1 on optional advanced features.
- Design every feature for secure public deployment.

## 32. V1 success criteria

- A bride or groom can independently create and run a complete wedding workspace.
- A wedding can be planned through events, guests, RSVP, tasks, expenses and vendors.
- Guests can receive invitations and respond to individual events without accounts.
- Organizers can see reliable attendance and wedding progress.
- The website can be configured privately and deliberately published.
- Guests can upload photos through QR codes without signing in.
- Guest memories are published automatically and can be deleted by the uploader.
- Partners can connect without losing their own accounts.
- Granular permissions prevent unauthorized module access.
- The service can operate securely as a public online product.

## 33. Completion definition

This document is the current product-scope baseline. Deferred decisions are recorded
rather than guessed. Before a module is implemented, its deferred decisions are converted
into functional requirements and acceptance criteria — in a feature PRD (for example the
Phase 4 PRD) and, where they change approved behaviour, a decision record.
