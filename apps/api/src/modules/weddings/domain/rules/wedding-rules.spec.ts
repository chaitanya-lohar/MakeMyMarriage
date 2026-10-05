import { describe, expect, it } from 'vitest';
import { displayNameFor, isCalendarDate } from './wedding-rules.js';

describe('wedding rules', () => {
  it('builds the display name from the couple, bride first', () => {
    expect(displayNameFor('Meera Sharma', 'Arjun Patel')).toBe('Meera Sharma & Arjun Patel');
  });

  it('accepts only real calendar dates written as YYYY-MM-DD', () => {
    expect(isCalendarDate('2027-02-18')).toBe(true);
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2027-02-29')).toBe(false);
    expect(isCalendarDate('2027-13-01')).toBe(false);
    expect(isCalendarDate('2027-2-18')).toBe(false);
    expect(isCalendarDate('18/02/2027')).toBe(false);
    expect(isCalendarDate('2027-02-18T00:00:00Z')).toBe(false);
  });
});
