import { describe, expect, it } from 'vitest';
import { daysBetween, formatDate, formatLongDate, isCalendarDate, todayIn } from './dates';

describe('wedding dates', () => {
  it('formats dates as the designs show them', () => {
    expect(formatDate('2027-02-18')).toBe('18 February 2027');
    expect(formatLongDate('2027-02-18')).toBe('Thursday, 18 February 2027');
  });

  it("counts days from today's date in the wedding timezone", () => {
    // 20:00 UTC on 17 Feb is already 18 Feb in India.
    expect(todayIn('Asia/Kolkata', new Date('2027-02-17T20:00:00Z'))).toBe('2027-02-18');
    expect(daysBetween('2027-02-18', '2027-02-18')).toBe(0);
    expect(daysBetween('2027-02-17', '2027-02-18')).toBe(1);
    expect(daysBetween('2026-10-04', '2027-02-18')).toBe(137);
    expect(daysBetween('2027-02-19', '2027-02-18')).toBe(-1);
  });
});

describe('isCalendarDate', () => {
  it('accepts real YYYY-MM-DD dates, past or future, as a date picker returns them', () => {
    expect(isCalendarDate('2027-02-16')).toBe(true);
    expect(isCalendarDate('2020-01-05')).toBe(true);
    expect(isCalendarDate('2027-02-30')).toBe(false);
    expect(isCalendarDate('16 / 02 / 2027')).toBe(false);
    expect(isCalendarDate('')).toBe(false);
  });
});
