import { describe, expect, it } from 'vitest';
import {
  emptyExpenseForm,
  emptyPaymentForm,
  expenseErrorsFromApi,
  formatShortDate,
  formFromExpense,
  formFromPayment,
  OTHER_PAYER,
  paymentErrorsFromApi,
  statusFor,
  toExpenseChanges,
  toNewExpensePayload,
  toPaymentPayload,
  validateExpenseForm,
  validatePaymentForm,
  type ApiExpense,
  type ApiPayment,
} from './expense-model';
import { formatRupees } from './money';

const expense: ApiExpense = {
  id: 'x1',
  title: 'Decorator',
  amountMinor: 15_000_000,
  paidMinor: 5_000_000,
  pendingMinor: 10_000_000,
  currency: 'INR',
  category: 'DECORATION',
  expenseDate: '2027-01-20',
  eventId: 'e1',
  eventName: 'Sangeet',
  vendorId: null,
  vendorName: null,
  vendorDeleted: false,
  paymentStatus: 'PARTIALLY_PAID',
  notes: null,
  createdAt: '2027-01-20T05:00:00.000Z',
  updatedAt: '2027-01-20T05:00:00.000Z',
};

const payment: ApiPayment = {
  id: 'p1',
  expenseId: 'x1',
  amountMinor: 3_000_000,
  paymentDate: '2027-01-20',
  paidByType: 'EXTERNAL_PERSON',
  paidByUserId: null,
  paidByName: "Bride's father",
  paymentMethod: 'UPI',
  referenceNumber: '4521',
  notes: null,
  createdAt: '2027-01-20T05:00:00.000Z',
  updatedAt: '2027-01-20T05:00:00.000Z',
};

describe('expense form (Phase 8 PRD §3.1)', () => {
  it('starts dated today, for the whole wedding unless an event is preset', () => {
    expect(emptyExpenseForm('2027-01-05')).toMatchObject({
      expenseDate: '2027-01-05',
      eventId: '',
      category: '',
    });
    expect(emptyExpenseForm('2027-01-05', 'e1').eventId).toBe('e1');
  });

  it('validates like the API: title, amount, category, date and notes', () => {
    expect(
      validateExpenseForm({ ...emptyExpenseForm('2027-01-05'), notes: 'x'.repeat(1001) }),
    ).toEqual({
      title: 'Enter a title.',
      amount: 'Enter an amount more than ₹0.',
      category: 'Choose a category.',
      notes: 'Keep it under 1,000 characters.',
    });
    const valid = { ...formFromExpense(expense) };
    expect(validateExpenseForm(valid)).toEqual({});
    expect(validateExpenseForm({ ...valid, amount: '10.555' }).amount).toBe(
      'Use up to 2 decimal places.',
    );
    expect(validateExpenseForm({ ...valid, amount: '100000001' }).amount).toBe(
      'Enter at most ₹10,00,00,000.',
    );
    expect(validateExpenseForm({ ...valid, title: 'x'.repeat(151) }).title).toBe(
      'Use 150 characters or fewer.',
    );
    expect(validateExpenseForm({ ...valid, expenseDate: '2027-02-30' }).expenseDate).toBe(
      'Enter a valid date.',
    );
  });

  it('sends paise, and nulls for empty optional fields', () => {
    expect(
      toNewExpensePayload({
        title: ' Banquet hall ',
        amount: '4,00,000.50',
        category: 'VENUE',
        expenseDate: '2027-01-05',
        eventId: '',
        vendorId: '',
        notes: '  ',
      }),
    ).toEqual({
      title: 'Banquet hall',
      amountMinor: 40_000_050,
      category: 'VENUE',
      expenseDate: '2027-01-05',
      eventId: null,
      vendorId: null,
      notes: null,
    });
  });

  it('sends only the changed fields of an edit', () => {
    const loaded = formFromExpense(expense);
    expect(loaded.amount).toBe('150000');
    expect(toExpenseChanges(loaded, expense)).toEqual({});
    expect(toExpenseChanges({ ...loaded, amount: '1,60,000', eventId: '' }, expense)).toEqual({
      amountMinor: 16_000_000,
      eventId: null,
    });
  });

  it('maps API field errors to form fields', () => {
    expect(
      expenseErrorsFromApi({ amountMinor: ['Enter at most ₹10,00,00,000.'], other: ['x'] }),
    ).toEqual({ amount: 'Enter at most ₹10,00,00,000.' });
  });
});

describe('payment form (Phase 8 PRD §3.2, §4)', () => {
  const today = '2027-01-25';

  it('starts as paid today by me; "Mark as fully paid" fills the pending amount (0028 #14)', () => {
    expect(emptyPaymentForm(today, 'me')).toMatchObject({
      amount: '',
      paymentDate: today,
      payer: 'me',
    });
    expect(emptyPaymentForm(today, 'me', 10_000_050).amount).toBe('100000.50');
  });

  it('refuses more than can still be paid, future dates and a missing payer', () => {
    const values = { ...emptyPaymentForm(today, 'me'), amount: '1,00,001' };
    expect(validatePaymentForm(values, today, 10_000_000, formatRupees)).toEqual({
      amount: 'This is more than the pending ₹1,00,000.',
    });
    expect(
      validatePaymentForm(
        { ...values, amount: '100', paymentDate: '2027-01-26', payer: OTHER_PAYER },
        today,
        10_000_000,
        formatRupees,
      ),
    ).toEqual({
      paymentDate: "The payment date can't be in the future.",
      payerName: 'Enter who paid.',
    });
    expect(
      validatePaymentForm(
        { ...values, amount: '100000', paymentDate: today },
        today,
        10_000_000,
        formatRupees,
      ),
    ).toEqual({});
  });

  it('sends a member or a typed name as the payer (0028 #12)', () => {
    expect(
      toPaymentPayload({ ...emptyPaymentForm(today, 'me'), amount: '500', method: 'CASH' }),
    ).toEqual({
      amountMinor: 50_000,
      paymentDate: today,
      paidByType: 'WEDDING_MEMBER',
      paidByUserId: 'me',
      paidByName: null,
      paymentMethod: 'CASH',
      referenceNumber: null,
      notes: null,
    });
    const edited = formFromPayment(payment);
    expect(edited).toMatchObject({ payer: OTHER_PAYER, payerName: "Bride's father" });
    expect(toPaymentPayload(edited)).toMatchObject({
      paidByType: 'EXTERNAL_PERSON',
      paidByUserId: null,
      paidByName: "Bride's father",
      amountMinor: 3_000_000,
      referenceNumber: '4521',
    });
  });

  it('maps API field errors to form fields', () => {
    expect(
      paymentErrorsFromApi({ paymentDate: ["The payment date can't be in the future."] }),
    ).toEqual({ paymentDate: "The payment date can't be in the future." });
  });
});

describe('display', () => {
  it('works out the status a change leads to (0029 D2)', () => {
    expect(statusFor(0, 100)).toBe('PENDING');
    expect(statusFor(50, 100)).toBe('PARTIALLY_PAID');
    expect(statusFor(100, 100)).toBe('PAID');
  });

  it('shows dates without a leading zero (0029 correction 2)', () => {
    expect(formatShortDate('2027-01-05')).toBe('5 Jan 2027');
  });
});
