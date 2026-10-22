import { describe, expect, it } from 'vitest';
import { formatRupees, parseRupees, toRupeeInput } from './money';

describe('rupee amounts (0028 #6)', () => {
  it('turns typed rupees into exact paise, without floating point', () => {
    expect(parseRupees('150000')).toEqual({ minor: 15_000_000 });
    expect(parseRupees('1,50,000.50')).toEqual({ minor: 15_000_050 });
    expect(parseRupees(' ₹ 0.1 ')).toEqual({ minor: 10 });
    expect(parseRupees('0.29')).toEqual({ minor: 29 });
    expect(parseRupees('1.005')).toEqual({ problem: 'decimals' });
    expect(parseRupees('19.99')).toEqual({ minor: 1999 });
    expect(parseRupees('100000000')).toEqual({ minor: 10_000_000_000 });
    // Edge cases from review P8: a leading or trailing point, and ₹10 crore with commas.
    expect(parseRupees('.5')).toEqual({ minor: 50 });
    expect(parseRupees('.50')).toEqual({ minor: 50 });
    expect(parseRupees('100.')).toEqual({ minor: 10_000 });
    expect(parseRupees('10,00,00,000')).toEqual({ minor: 10_000_000_000 });
    expect(parseRupees('10,00,00,000.00')).toEqual({ minor: 10_000_000_000 });
    expect(parseRupees('.')).toEqual({ problem: 'invalid' });
    expect(parseRupees('1.2.3')).toEqual({ problem: 'invalid' });
  });

  it('reports why an amount is not valid', () => {
    expect(parseRupees('')).toEqual({ problem: 'required' });
    expect(parseRupees('abc')).toEqual({ problem: 'invalid' });
    expect(parseRupees('-5')).toEqual({ problem: 'invalid' });
    expect(parseRupees('1e5')).toEqual({ problem: 'invalid' });
    expect(parseRupees('0')).toEqual({ problem: 'zero' });
    expect(parseRupees('0.00')).toEqual({ problem: 'zero' });
    expect(parseRupees('100000000.01')).toEqual({ problem: 'tooLarge' });
    expect(parseRupees('99999999999999999999')).toEqual({ problem: 'tooLarge' });
  });

  it('formats with Indian grouping, paise only when present (0028 #24)', () => {
    expect(formatRupees(15_000_000)).toBe('₹1,50,000');
    expect(formatRupees(125_000_000)).toBe('₹12,50,000');
    expect(formatRupees(15_000_050)).toBe('₹1,50,000.50');
    expect(formatRupees(5)).toBe('₹0.05');
    expect(formatRupees(0)).toBe('₹0');
    expect(formatRupees(10_000_000_000)).toBe('₹10,00,00,000');
  });

  it('fills the edit form without grouping', () => {
    expect(toRupeeInput(15_000_000)).toBe('150000');
    expect(toRupeeInput(15_000_050)).toBe('150000.50');
    expect(toRupeeInput(15_000_005)).toBe('150000.05');
  });
});
