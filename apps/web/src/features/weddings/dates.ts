/**
 * Wedding dates are calendar dates (YYYY-MM-DD) in the wedding's timezone (decision 0016).
 * They are never converted through the browser's local time, so a date never shifts by a
 * day for someone outside India.
 */

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

function toCalendarDate(iso: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, year, month, day] = match.map(Number) as [number, number, number, number];
  return isRealDate(year, month, day) ? { year, month, day } : null;
}

function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

/**
 * Reads a typed date such as "18 / 02 / 2027" (also 18/02/2027, 18-02-2027 or 18.02.2027).
 * Returns YYYY-MM-DD, or null when it is not a real date.
 */
export function parseTypedDate(text: string): string | null {
  const match = /^\s*(\d{1,2})\s*[/.\- ]\s*(\d{1,2})\s*[/.\- ]\s*(\d{4})\s*$/.exec(text);
  if (!match) return null;
  const [, day, month, year] = match.map(Number) as [number, number, number, number];
  return isRealDate(year, month, day) ? `${pad(year, 4)}-${pad(month)}-${pad(day)}` : null;
}

/** YYYY-MM-DD as typed in the form: "18 / 02 / 2027". */
export function toTypedDate(iso: string | null): string {
  const date = iso ? toCalendarDate(iso) : null;
  return date ? `${pad(date.day)} / ${pad(date.month)} / ${pad(date.year, 4)}` : '';
}

function parts(iso: string, options: Intl.DateTimeFormatOptions) {
  const date = toCalendarDate(iso);
  if (!date) return null;
  const formatter = new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' });
  const values = formatter.formatToParts(new Date(Date.UTC(date.year, date.month - 1, date.day)));
  return (type: Intl.DateTimeFormatPartTypes) =>
    values.find((part) => part.type === type)?.value ?? '';
}

/** "18 February 2027". */
export function formatDate(iso: string): string {
  const part = parts(iso, { day: 'numeric', month: 'long', year: 'numeric' });
  return part ? `${part('day')} ${part('month')} ${part('year')}` : '';
}

/** "Thursday, 18 February 2027". */
export function formatLongDate(iso: string): string {
  const part = parts(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return part ? `${part('weekday')}, ${part('day')} ${part('month')} ${part('year')}` : '';
}

/** Today's calendar date in a timezone, as YYYY-MM-DD. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Whole calendar days from `today` to `date` (negative once the date has passed). */
export function daysBetween(today: string, date: string): number {
  const from = toCalendarDate(today);
  const to = toCalendarDate(date);
  if (!from || !to) return Number.NaN;
  const ms =
    Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day);
  return Math.round(ms / 86_400_000);
}
