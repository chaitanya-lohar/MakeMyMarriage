import { describe, expect, it } from 'vitest';
import { formatVendorDate, rupeesFromMinor } from './vendor-model';

describe('vendor formatting', () => {
  it('uses Indian calendar dates without shifting the date', () => {
    expect(formatVendorDate('2027-02-16')).toBe('16 Feb 2027');
    expect(formatVendorDate(null)).toBe('—');
  });

  it('formats integer paise as Indian rupees', () => {
    expect(rupeesFromMinor(123456789)).toBe('₹12,34,567.89');
    expect(rupeesFromMinor(null)).toBe('—');
  });
});
