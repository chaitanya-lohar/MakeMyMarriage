/** Wedding field rules approved in decision 0016. */

export const WeddingLimits = {
  nameMaxLength: 100,
  venueNameMaxLength: 120,
  primaryCityMaxLength: 120,
  descriptionMaxLength: 1000,
} as const;

/** Every wedding is stored in India's timezone; there is no timezone UI in V1 (0016). */
export const WEDDING_TIMEZONE = 'Asia/Kolkata';

/** The display name is always generated from the couple's names, never typed (0016). */
export function displayNameFor(brideName: string, groomName: string): string {
  return `${brideName} & ${groomName}`;
}

/** True for a real calendar date written as YYYY-MM-DD (rejects 2027-02-30). */
export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/**
 * Today's calendar date (YYYY-MM-DD) in the wedding's timezone. Date rules such as upcoming
 * events (0022 #3) and overdue tasks (0026 #8) compare against it.
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
