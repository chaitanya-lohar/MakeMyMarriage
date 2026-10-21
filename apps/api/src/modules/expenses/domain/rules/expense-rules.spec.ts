import { describe, expect, it } from 'vitest';
import { EXPENSE_CATEGORIES, paymentStatusFor, PaymentStatus } from './expense-rules.js';

describe('expense rules (decision 0028)', () => {
  it('derives the status from the paid total and the amount (0028 #7)', () => {
    expect(paymentStatusFor(0, 15_000_000)).toBe(PaymentStatus.Pending);
    expect(paymentStatusFor(1, 15_000_000)).toBe(PaymentStatus.PartiallyPaid);
    expect(paymentStatusFor(14_999_999, 15_000_000)).toBe(PaymentStatus.PartiallyPaid);
    expect(paymentStatusFor(15_000_000, 15_000_000)).toBe(PaymentStatus.Paid);
  });

  it('keeps the fixed category list (0010 #7)', () => {
    expect(EXPENSE_CATEGORIES).toEqual([
      'VENUE',
      'CATERING',
      'DECORATION',
      'PHOTOGRAPHY',
      'CLOTHING',
      'JEWELLERY',
      'MAKEUP',
      'ENTERTAINMENT',
      'INVITATIONS',
      'GIFTS',
      'MISCELLANEOUS',
    ]);
  });
});
