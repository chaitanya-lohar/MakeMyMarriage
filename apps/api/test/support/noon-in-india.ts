import { vi } from 'vitest';

/**
 * Moves the clock to 12:00 today in India and lets it run on from there, so tests that compare
 * dates with "today in the wedding's timezone" (overdue tasks, upcoming events) cannot fail
 * when they happen to run around midnight IST. Only `Date` is faked; timers stay real, so the
 * database drivers and the HTTP server behave normally.
 */
export function startClockAtNoonInIndia(): void {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  // 12:00 in India is 06:30 UTC.
  vi.setSystemTime(new Date(`${today}T06:30:00.000Z`));
}

export function restoreClock(): void {
  vi.useRealTimers();
}
