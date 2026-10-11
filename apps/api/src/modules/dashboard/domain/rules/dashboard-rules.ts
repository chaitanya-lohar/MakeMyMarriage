/** Dashboard rules: Phase 4 PRD §10.2, decisions 0019 #5, 0021 and 0022. */

/** The dashboard returns at most five upcoming events — a response limit only (0022 #1). */
export const UPCOMING_EVENTS_LIMIT = 5;

/**
 * Today's calendar date (YYYY-MM-DD) in the wedding's timezone. "Upcoming" is date-only: an
 * event dated today stays upcoming after its times have passed (0022 #3).
 */
export function todayIn(timezone: string, now: Date = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
