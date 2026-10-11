# 0022 — Dashboard API contract (Phase 4)

**Status:** Accepted (approved by the product owner on 2026-10-11).

Defines `GET /api/v1/weddings/{weddingId}/dashboard`, listed as "Planned" in API Design
v1.1 §6, for the four Phase 4 dashboard summaries (0019 #5, Phase 4 PRD §10.2) and the O10
display rule (0021). It adds no data, fields or storage.

## Decisions

1. **The five-event cap is applied in the API.** The dashboard endpoint returns at most five
   upcoming events, sorted by event date, then start time, with events without a start time
   first on their date.
   - This limits the dashboard response only, not the system.
   - The events list endpoint (API Design §8) still returns every applicable event under its
     own contract.
   - The response carries no total, "more" flag or pagination.
2. **Expected attendees are calculated only for the events returned.** The upcoming events
   and the expected-attendee figures are always the same set of up to five events.
   - For each returned event, expected attendees are the sum of `attendeeCount` over its
     active, counted Attending assignments.
   - No figure is returned for upcoming events beyond the cap.
   - There is no wedding-wide expected-attendee total.
3. **Upcoming is date-only.** An event is upcoming when its date is today or later in the
   wedding's timezone (`Asia/Kolkata` in V1). An event dated today stays upcoming after its
   start or end time has passed. There is no time-of-day filtering.

## Contract

The full contract is in API Design v1.1 §6.

- The response contains `upcomingEvents` (each with `expectedAttendees`), `guestTotals` and
  `rsvpBreakdown`.
- Values are computed from current data on every request; no totals are stored.
- Authorization and errors are the same as the other wedding routes: an active member
  (`OWNER` until Phase 10); `401 UNAUTHENTICATED`; `404 WEDDING_NOT_FOUND`.
- The countdown and wedding details still come from `GET /weddings/{weddingId}` (0016).
- Event fields come from the approved O10 design: name, date, times and venue name. `type`
  is included for the per-type icon, and `id` as the resource identifier.
- No database changes: the Phase 4 indexes on `events` and `guest_events` cover the queries.

## Superseded statements

| Source                 | Statement                                                  | Resolution                                 |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------ |
| API Design v1.1 §6     | `GET /weddings/{weddingId}/dashboard`: Permission, Planned | Phase 4, active member; contract defined.  |
| 0021, O10 display rule | Cap described as a display rule                            | Applied by the dashboard API (decision 1). |
| Phase 4 PRD v1.2 §10.2 | Expected attendees "for each upcoming event"               | Only for the returned events (decision 2). |
