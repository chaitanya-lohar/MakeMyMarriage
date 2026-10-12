# 0024 — Live updates on organizer screens

**Status:** Deferred — parked by the product owner on 2026-10-12 as a later enhancement. Not
approved and not implemented; nothing below applies until it is approved.

Organizer screens load their data once, when the page opens. When a guest responds through
an invitation link, an open Guests list, guest page or dashboard keeps showing the old
answer until the page is refreshed. The product owner asked for changes to appear without
a refresh, through a push from the server. System Design v1.3 has no real-time channel, so
this decision adds one.

## Decisions

1. **Transport: Server-Sent Events (SSE).** The browser opens one stream per wedding:
   `GET /api/v1/weddings/{weddingId}/live` (`text/event-stream`).
   - SSE is one-way (server to browser), which is all this needs. It is plain HTTP, so it
     goes through the existing same-origin `/api/v1` proxy (0001) and uses the existing
     authentication cookies. It needs no CORS and no new library in the browser.
   - WebSockets were not chosen: two-way messaging isn't needed, and they need extra
     proxy and load-balancer support.
2. **Messages say what changed, never the data.** Each message names the kind of change
   and the IDs involved, for example `{ "type": "rsvp.updated", "guestId": "…" }`. The
   screen then reloads through the normal API endpoints.
   - No guest names, contact details or answers travel on the stream, so access stays
     enforced by the existing endpoints and their authorization.
3. **What is pushed** (Phase 4 data):
   - A guest submits or changes an RSVP through the invitation link.
   - An organizer or partner changes a guest, an assignment, an RSVP or an event from
     another device or tab.
   - An invitation email status changes (sent, failed) or a link is opened.
4. **Delivery across servers: Redis pub/sub.** The API (or the worker, for email status)
   publishes each change to a Redis channel for the wedding; every API instance forwards it
   to the streams it holds. Redis is already part of the stack (BullMQ), so nothing new is
   hosted.
   - Pub/sub is fire-and-forget: a message sent while a screen is disconnected is lost.
     That is acceptable because of decision 6.
5. **Access.** Opening the stream requires a signed-in member of the wedding, checked the
   same way as other wedding routes.
   - The server closes the stream when the session's access token expires; the browser
     refreshes the session as usual and reconnects. Removing a member therefore stops their
     updates within one access-token lifetime.
   - Limits: at most 5 open streams per user; a heartbeat comment every 25 seconds keeps
     proxies from closing idle streams.
6. **Safety net.** Screens also reload when the stream reconnects, and when the user comes
   back to the tab, so a missed message never leaves stale data on screen.
7. **Screens that update:** Guests list, guest detail (assignments, RSVP, invitation
   panel), Events list, event detail and the dashboard summaries. A reload never discards
   what the user is typing: a form with unsaved changes is not overwritten.

## Risks to verify

- **Vercel proxy and long-lived streams.** The browser reaches the API through the Vercel
  `/api/v1` rewrite (0001, 0005). Whether Vercel's external rewrites keep an SSE stream
  open without buffering or timing out must be tested on the first deployment. If they
  don't, the stream reconnects often (still correct, because of decision 6), or the stream
  route needs its own path to the API, which would need a further decision.
- **Load.** Each open organizer screen holds one connection to an API instance. This is
  small at V1 scale; the container limits must allow it.

## Specifications to update on approval (decision 0003)

| Specification      | Change                                                                   |
| ------------------ | ------------------------------------------------------------------------ |
| System Design v1.3 | §4/§11: add the live-update channel (SSE, Redis pub/sub); §27 ADR entry. |
| API Design v1.1    | New route `GET /weddings/{weddingId}/live`, message types and limits.    |
| Phase 4 PRD v1.2   | Organizer screens update without a refresh (decisions 3, 6 and 7).       |

## Not decided here

- In-app notifications (PRD §14, System Design §11) and any email to the organizer when a
  guest responds remain deferred.
- Live updates for later modules (tasks, expenses, vendors) are added with those modules.
