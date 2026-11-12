# MakeMyMarriage — Phase 16 PRD v1.0: partner connection and sharing

| Item         | Value                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status       | **Canonical** for Phase 16. Approved decisions D1–D10 (0038); screens approved (0039); built (PR #40); wording approved (0040).                                          |
| Date         | 2026-11-03                                                                                                                                                               |
| Parent       | [PRD v1.2](PRD_v1.2.md) (sections 7, 23 and 24)                                                                                                                          |
| Decisions    | [0038](../decisions/0038-phase-16-partner-connection.md), [0037](../decisions/0037-phase-16-before-phases-11-15.md), with 0009, 0012 and 0034                            |
| Contracts    | [Database Design v1.1](DB_DESIGN_v1.1.md) §7.2–§7.3, §22, §24, §27; [API Design v1.1](API_DESIGN_v1.1.md) §7.2, §21, §28; [System Design v1.3](SYSTEM_DESIGN_v1.3.md) §8 |
| Out of scope | Per-resource sharing or private resources, bride/groom labels, removing the other partner, deleting or merging weddings, email verification, Phases 11–15                |

| Version | Date       | Change                                                      |
| ------- | ---------- | ----------------------------------------------------------- |
| 1.0     | 2026-11-03 | First version, from the Phase 16 discovery (decision 0038). |
| 1.0     | 2026-11-03 | §9: screens approved with corrections (decision 0039).      |
| 1.0     | 2026-11-12 | §11: wording approved (decision 0040); status updated.      |

## 1. Purpose and outcomes

Let the couple plan one wedding together. One partner invites the other by email; on
acceptance both are owners of the same wedding with equal, full access, while each keeps their
own account. Either can later leave; the wedding and its records stay with the other.

## 2. Governing rules

- **One shared wedding (D1).** Everything in the wedding is shared by both partners: wedding
  settings, events, guests, invitations and RSVP, tasks, expenses, vendors, members, audit
  history and every future module. Nothing is private to one partner inside the wedding, and
  there are no sharing switches. Personal account information (profile, password, sessions,
  other weddings) is never shared.
- **Partner = second owner (D3).** A wedding has at most two owners (0034, P10-5); the partner
  is the other owner, however they became one. Owners hold every permission (0034).
- **Accounts never merge** and a user owns at most one wedding (0012). Weddings are never
  deleted or merged (D6).
- **Organizers are unaffected.** Partner connection is separate from organizer membership;
  organizers see what their role and overrides allow (0034).
- Partner actions are owner-only and checked on the server (`PARTNER_SHARING`, protected —
  0034). Non-owners never see them.

## 3. Partner invitation

- **Who and when:** an owner, while the wedding has one owner and no pending invitation or
  connection. Not to the owner's own email.
- **Fields:** the invitee's email (required, valid, at most 254 characters).
- **Validity (D4):** seven days from sending; a resend sends a new link, the old one stops
  working, and the seven days start again. At most 10 invitations per wedding per hour and 3
  resends per invitation per 24 hours.
- **Revoke:** an owner cancels a pending invitation; the link stops working.
- **Email:** sent at once; if sending fails the invitation stays pending and can be resent.

## 4. Accepting and declining

- **The invitation page** (`/partner-invite/{token}`) shows the wedding's name, the inviter's
  name, that accepting makes the invitee an owner with full access, the invited email (masked,
  as for member invitations) and the expiry. Nothing else about the wedding is shown before
  acceptance.
- **Signed out:** sign in or create an account, then return to the page.
- **Accept (D4):** the signed-in account's email must equal the invited email; no other
  verification. A different account sees how to switch account.
- **Invitee owns another wedding (D6):** acceptance is refused with an explanation: hand that
  wedding's ownership to someone else first (Members → Transfer my ownership), then accept.
  Nothing is deleted or merged.
- **Existing organizer (D5):** an active organizer of this wedding is promoted on their existing
  membership to owner; their custom permissions are cleared.
- **Former partner (D10):** accepting reuses their earlier membership; access returns only now.
- **Result:** both partners are owners; the invitee lands in the wedding.
- **Decline:** anyone with the link can decline; it grants nothing and the link stops working.
- **States:** pending, expired, revoked or already answered, invalid link, email mismatch, owns
  another wedding, no free owner seat, already connected.

## 5. Leaving the wedding (D7, D8)

- Either partner may leave while there are two owners. Only one's own membership: neither
  partner can remove the other, and owners cannot be removed through member management.
- Leaving needs a strong confirmation, then takes effect at once:
  - the leaver loses all access to the wedding, and is free to own a wedding of their own;
  - the remaining partner is the sole owner;
  - every record stays: events, guests, tasks and assignments, expenses and payments, vendors,
    organizer invitations, audit history. The leaver is shown as a former member where they
    appear (0030).
  - pending ownership offers involving the leaver are cancelled.
- A sole owner cannot leave (there is no partner to leave to).

## 6. Reconnecting (D10)

- The remaining owner can invite a partner again: the former partner or someone else, by the
  same invitation flow (§3).
- The former partner's earlier membership is reused on acceptance; earlier connections and the
  audit history are kept. No access returns before acceptance.

## 7. Audit

Invitation created, resent, revoked, accepted, declined and expired; partner connected; partner
disconnected; organizer promoted to owner; membership reactivated (Database Design §22).

## 8. API and data

Database Design §7.3 (`partner_connections`), §7.2 (memberships), §22, §24, §27; API Design
§7.2, §21, §28. Owner changes are serialized per wedding, so concurrent acceptances, leaving
and seat transfers can never produce three owners, no owner, or a user owning two weddings.

## 9. UI

Stitch M16-01 to M16-09, approved with the corrections in decision 0039: the partner section on the Members page
(empty, pending, connected), the invite dialog, the public invitation page and its states,
connection success, the leave confirmation, the remaining partner's view, the former
partner's view, reconnection, and the error states. Draft wording, as earlier phases.

## 10. Acceptance criteria

1. An owner of a one-owner wedding invites a partner by email; the email holds a working link.
2. The invitee signs up or in with the invited email and accepts; both are owners with full
   access to the same wedding resources.
3. A different account cannot accept; an expired, revoked or answered link cannot be used.
4. An invitee who owns a wedding cannot accept until they have transferred its ownership.
5. An existing organizer who accepts becomes an owner on the same membership, with custom
   permissions cleared.
6. A partner leaves: they lose access at once; the other is sole owner; records are unchanged.
7. Neither partner can remove the other; non-owners see no partner controls and the server
   refuses their requests.
8. The former partner can be invited again; history is kept; access returns only on acceptance.
9. Concurrent acceptances, leaving and seat transfers never leave three owners, no owner, or a
   user owning two weddings.
10. Every step is in the audit history.

## 11. Deferred or open

- Final wording: approved as built (decision 0040).
- Partner-related features of Phases 11–15 (deferred — 0037).

## 12. Definition of done

Approved screens implemented; the acceptance criteria covered by automated tests; lint,
type-check, unit, integration and web tests and the build pass; an end-to-end run of §10.
