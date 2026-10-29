/**
 * The audit history's date filters are calendar dates in the wedding's timezone (API
 * Design §7.1); entries are stored with UTC instants.
 */

/** The calendar date after `date` (both `YYYY-MM-DD`). */
export function nextDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/** The instant `date` starts at midnight in `timezone`. */
export function startOfDayIn(date: string, timezone: string): Date {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const utcMidnight = Date.UTC(year, month - 1, day);
  // Midnight local = UTC midnight minus the zone's offset at local midnight. That offset is
  // read at a first guess and read again there, which is exact across a DST change.
  const guess = utcMidnight - offsetAt(utcMidnight, timezone);
  return new Date(utcMidnight - offsetAt(guess, timezone));
}

/** The zone's offset from UTC at `instant`, in milliseconds. */
function offsetAt(instant: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((candidate) => candidate.type === type)?.value);
  const wallClock = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return wallClock - instant;
}
