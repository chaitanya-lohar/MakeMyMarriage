import { describe, expect, it } from 'vitest';
import { todayIn } from './dashboard-rules.js';

describe('todayIn', () => {
  it('uses the wedding timezone, not UTC', () => {
    // 20:00 UTC on 16 Feb is already 17 Feb (01:30) in India.
    const now = new Date('2027-02-16T20:00:00.000Z');
    expect(todayIn('Asia/Kolkata', now)).toBe('2027-02-17');
    expect(todayIn('UTC', now)).toBe('2027-02-16');
  });
});
