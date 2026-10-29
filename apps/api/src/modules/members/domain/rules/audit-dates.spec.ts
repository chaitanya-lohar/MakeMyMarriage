import { describe, expect, it } from 'vitest';
import { nextDay, startOfDayIn } from './audit-dates.js';

describe('audit date filters', () => {
  it('starts a day at midnight in the wedding timezone', () => {
    expect(startOfDayIn('2026-10-27', 'Asia/Kolkata').toISOString()).toBe(
      '2026-10-26T18:30:00.000Z',
    );
    expect(startOfDayIn('2026-10-27', 'UTC').toISOString()).toBe('2026-10-27T00:00:00.000Z');
  });

  it('uses the offset at local midnight on a daylight-saving day', () => {
    // Sydney moves to daylight time at 02:00 on 4 October 2026: midnight is still +10:00.
    expect(startOfDayIn('2026-10-04', 'Australia/Sydney').toISOString()).toBe(
      '2026-10-03T14:00:00.000Z',
    );
  });

  it('gives the next calendar date across month and year ends', () => {
    expect(nextDay('2026-10-31')).toBe('2026-11-01');
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
  });
});
