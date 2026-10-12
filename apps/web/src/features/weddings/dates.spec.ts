import { describe, expect, it } from 'vitest';
import {
  daysBetween,
  formatDate,
  formatLongDate,
  isCalendarDate,
  parseTypedDate,
  toTypedDate,
  todayIn,
} from './dates';

describe('wedding dates', () => {
  it('reads typed dates in day / month / year order', () => {
    expect(parseTypedDate('18 / 02 / 2027')).toBe('2027-02-18');
    expect(parseTypedDate('18/02/2027')).toBe('2027-02-18');
    expect(parseTypedDate(' 1-2-2027 ')).toBe('2027-02-01');
    expect(parseTypedDate('29.02.2028')).toBe('2028-02-29');
  });

  it('rejects impossible or incomplete dates', () => {
    expect(parseTypedDate('32 / 13 / 2027')).toBeNull();
    expect(parseTypedDate('29 / 02 / 2027')).toBeNull();
    expect(parseTypedDate('18 / 02')).toBeNull();
    expect(parseTypedDate('2027-02-18')).toBeNull();
    expect(parseTypedDate('')).toBeNull();
  });

  it('writes stored dates back in the typed format', () => {
    expect(toTypedDate('2027-02-18')).toBe('18 / 02 / 2027');
    expect(toTypedDate(null)).toBe('');
  });

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
