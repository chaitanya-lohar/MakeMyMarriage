# 0021 — Phase 4 design approval

**Status:** Accepted (Stitch screens and wording approved by the product owner on
2026-10-11).

This record approves the Phase 4 screens in Google Stitch project `11709379677369700007`,
and the wording that decision 0019 #7 left to design review. Where an approved screen
differs from the specifications or from the corrections below, the specifications win
(0004).

## Approved screens

Titles start "P4 ·". Several titles appear more than once in Stitch; only these IDs are
approved.

| Screen                                  | Desktop                            | Mobile                             |
| --------------------------------------- | ---------------------------------- | ---------------------------------- |
| O2 Events list                          | `edadd965f64848b28b69567aa1f5bd10` | `c6c4ed5f7a7e4752b3ce6c6d27a6bd35` |
| O3 Event form                           | `dbec8474bbee4367a12f4d6f6ae475e7` | `64dc4d243d8547129900a54b11c6f732` |
| O4/O9 Delete dialogs, event unavailable | `67752d6e3a574bf886d84ffc497aa319` | `2f8a0c4e5b3b4497845dd17546693179` |
| O5 Guests list                          | `b80e54ed33dd4a34a9c33fb4dd2edd06` | `148a8f2c42cf4060b212541c02d5e0f9` |
| O6 Guest form                           | `b39150ad69244150a0a30d82300a72cc` | `45205a244acc4e1e919a5671ea005d78` |
| O7 Guest detail, events and RSVP        | `482b86c7e1544629902fdeec0e17b990` | `667f78b049154fa3a65496f4e8cf0e8b` |
| O8 Invitation panel                     | `6c575fb7bb4f4367872bc01676a4bd53` | `427c1ec2140a40278b1a4dcf835483fa` |
| O10 Dashboard                           | `9cadff3546d746e98b22c724ce23c487` | `4a1a6ba8923a40b58acf415f96743dcb` |
| G1/G2 Invitation and RSVP               | `e10c2e9ccc2f431195e0779efaeaf786` | `f76aaa236f6845c1a54f78bc2eba569a` |
| G3/G4/G5 Guest states                   | `023d57195ff64481be4edcfb2b957ac6` | `21d10f071b904a4b9b9e05c8d2ad9d5a` |
| Navigation drawer                       | —                                  | `8aeb40b8d07a4febbf805ef4eb72e986` |
| States and long content                 | `e5afdb1a24944ac18d1f221a71233434` | —                                  |
| Copy drafts                             | `0459f8d731ca4266ab2779b2079664c3` | —                                  |

For O8, the mobile screen is the reference for content. The desktop screen is used only
for layout.

Every other Phase 4 screen in the project is stale. It is not used, edited or deleted.

## Corrections applied in code

These Stitch inconsistencies are fixed during implementation; they need no new designs.

1. **Shell.** Use the existing workspace sidebar, mobile drawer and Logo component (0016).
   - Navigation is exactly Dashboard, Wedding details, Events, Guests & RSVP.
   - Ignore extra navigation, role titles ("Organizer Suite", "Lead Host & Organizer"),
     date or city lines under the wedding name, "Active" chips and "M" marks.
2. **Primary buttons** are midnight navy (0015), not Stitch's black.
3. **Design-review annotations** are not product text: "Spec", "Suite", "Canonical",
   "Regal Modernity…", "Admin Workspace", "High-level logistical status…" and the
   "DRAFT copy" tags.
4. **O8 desktop** shows the same six states, actions and history as O8 mobile.
   - The actions are the ones in Phase 4 PRD §10.1.
   - A revoked link keeps its email status (0020).
   - Leave out the rules box, the multi-event access card ("+1 Guest", "Table 04"),
     "Delivery Log Audit" and "Created by Organizer".
5. **Link state.**
   - The only link-state label is "Revoked — this link no longer works"; never "Active".
   - The link URL is never shown as text (Copy link and Share on WhatsApp only).
6. **O5 Guests list.**
   - Filters: RSVP is All, Pending, Attending, Declined, Maybe. The event filter lists the
     wedding's events.
   - The failure reason is "The email address was rejected".
   - Show both the empty state and the no-results state.
7. **O2 Events list.**
   - Event types are only the seven in 0017; a past event uses its own type, e.g. Custom.
   - Every event offers "Edit event".
   - The empty state is "No events yet" with "Add event".
8. **O10 Dashboard.**
   - Show real data, with 24-hour times.
   - Guest totals carry "Includes guests not yet invited to an event".
   - Upcoming events lists at most five events, as in the approved design.
9. **Sample data in the screens is illustrative only.** This covers names, numbers,
   venues, dress codes and descriptions; the real data comes from the API.

## Approved wording

The copy-drafts screen is approved as the Phase 4 wording, with the corrections above. It
satisfies decision 0019 #7.

| Situation                       | Wording                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invitation email subject        | You're invited: {Bride} & {Groom}                                                                                                                                                                                                                                                                                                                                   |
| Invitation email body           | Dear {Guest name}, You're warmly invited to celebrate the wedding of {Bride} & {Groom} on {date} in {city}. This invitation covers your personalized ceremony schedule and RSVP details for all events you are invited to. [View invitation and RSVP] With love, {Bride first name} & {Groom first name}. The date and city are left out when the wedding has none. |
| WhatsApp message                | Dear {Guest first name}, you're warmly invited to the wedding celebrations of {Bride} & {Groom}. Please view your invitation and RSVP here: {link}                                                                                                                                                                                                                  |
| Duplicate mobile (after saving) | Saved. Another guest in your list has the same mobile number: {name}. Please check this isn't a duplicate.                                                                                                                                                                                                                                                          |
| Delete event                    | Delete this event? {Event} will be removed from your events and guest lists. Its RSVP and invitation history is kept.                                                                                                                                                                                                                                               |
| Delete guest                    | Delete {Guest}? {First name} will be removed from your guest list and their invitation link will stop working. Their RSVP and invitation history is kept.                                                                                                                                                                                                           |
| Remove from event               | Remove {First name} from {Event}? {First name} will no longer be invited to {Event}. Their RSVP history is kept.                                                                                                                                                                                                                                                    |
| Regenerate link                 | Create a new link? The current link will stop working, and the email status goes back to Draft until you send the new link to {First name}.                                                                                                                                                                                                                         |
| Regenerate a revoked link       | Create a new link for {First name}? The revoked link stays invalid. The email status goes back to Draft until you send the new link.                                                                                                                                                                                                                                |
| Revoke link                     | Revoke this link? The current link will stop working, and no new link is created.                                                                                                                                                                                                                                                                                   |
| Guest RSVP saved                | Thank you, {First name}. Your RSVP has been saved. (with the saved answers; unanswered events show "Awaiting your reply") You can change your answers later.                                                                                                                                                                                                        |
| Guest headcount missing         | Please tell us how many people are coming (at least 1).                                                                                                                                                                                                                                                                                                             |
| Link not working                | This invitation link isn't working. It may have been replaced or withdrawn. Please contact the couple for a new link.                                                                                                                                                                                                                                               |
| No events on the invitation     | No events on your invitation. There are no events on your invitation right now. Please check back later or contact the couple.                                                                                                                                                                                                                                      |

The remaining messages come from the approved screens: empty states, validation, loading,
server and network errors, and rate limiting.

## Superseded statements

| Source                 | Statement                                                  | Resolution                                |
| ---------------------- | ---------------------------------------------------------- | ----------------------------------------- |
| Phase 4 PRD v1.2 §10.1 | "None exist yet for Phase 4" (Stitch screens)              | Approved screens listed above.            |
| Phase 4 PRD v1.2 §10.1 | Copy "to draft in Stitch and approve at design review"     | Approved wording above.                   |
| Phase 4 PRD v1.2 §10.2 | Number of upcoming events listed "is set at design review" | At most five (correction 8).              |
| Phase 4 PRD v1.2 §12   | Wording listed as deferred                                 | Approved; removed from the deferred list. |
| 0019 #7                | No Phase 4 wording approved yet                            | Approved here.                            |
