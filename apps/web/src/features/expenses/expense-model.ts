import type { components } from '@makemymarriage/api-client';
import { isCalendarDate } from '@/features/weddings/dates';
import { expenseErrors } from './content';
import { parseRupees, toRupeeInput, type AmountProblem } from './money';

export type ApiExpense = components['schemas']['ExpenseDto'];
export type ApiPayment = components['schemas']['PaymentDto'];
export type ApiExpenseSummary = components['schemas']['ExpenseSummaryDto'];
export type ExpenseCategory = ApiExpense['category'];
export type PaymentStatus = ApiExpense['paymentStatus'];
export type PaymentMethod = NonNullable<ApiPayment['paymentMethod']>;

/** The categories in the approved order (0010 #7). */
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
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
];

export const PAYMENT_STATUSES: PaymentStatus[] = ['PENDING', 'PARTIALLY_PAID', 'PAID'];

export const PAYMENT_METHODS: PaymentMethod[] = [
  'CASH',
  'UPI',
  'BANK_TRANSFER',
  'CARD',
  'CHEQUE',
  'OTHER',
];

/** Limits from 0028 #6, #11, #13; the API enforces the same. */
export const ExpenseLimits = {
  title: 150,
  notes: 1000,
  payerName: 100,
  reference: 100,
  paymentNotes: 500,
} as const;

const amountMessages: Record<AmountProblem, string> = {
  required: expenseErrors.amount,
  invalid: expenseErrors.amount,
  zero: expenseErrors.amount,
  decimals: expenseErrors.decimals,
  tooLarge: expenseErrors.amountTooLarge,
};

const tooLong = (value: string, max: number) =>
  value.trim().length > max
    ? expenseErrors.tooLong.replace('{max}', max.toLocaleString('en-IN'))
    : undefined;

const withoutEmpty = <T extends Record<string, string | undefined>>(errors: T) =>
  Object.fromEntries(
    Object.entries(errors).filter(([, message]) => message !== undefined),
  ) as Partial<T>;

/** The status that follows from paid and amount (0028 #7), for previews such as D2 (0029). */
export function statusFor(paidMinor: number, amountMinor: number): PaymentStatus {
  if (paidMinor <= 0) return 'PENDING';
  return paidMinor < amountMinor ? 'PARTIALLY_PAID' : 'PAID';
}

// ─── Expense form ──────────────────────────────────────────────────────────────────────────

/** What the expense form holds; the amount is the typed rupee text. */
export interface ExpenseFormValues {
  title: string;
  amount: string;
  category: ExpenseCategory | '';
  /** YYYY-MM-DD from the date picker. */
  expenseDate: string;
  /** An event ID, or empty for a whole-wedding expense. */
  eventId: string;
  notes: string;
}

export type ExpenseFormField = keyof ExpenseFormValues;
export type ExpenseFormErrors = Partial<Record<ExpenseFormField, string>>;

/** A new expense: dated today, for the whole wedding unless an event is preset (0028 #11). */
export function emptyExpenseForm(today: string, eventId = ''): ExpenseFormValues {
  return { title: '', amount: '', category: '', expenseDate: today, eventId, notes: '' };
}

export function formFromExpense(expense: ApiExpense): ExpenseFormValues {
  return {
    title: expense.title,
    amount: toRupeeInput(expense.amountMinor),
    category: expense.category,
    expenseDate: expense.expenseDate,
    eventId: expense.eventId ?? '',
    notes: expense.notes ?? '',
  };
}

/** Checks the form the way the API will (Phase 8 PRD §3.1), so mistakes show before sending. */
export function validateExpenseForm(values: ExpenseFormValues): ExpenseFormErrors {
  const title = values.title.trim();
  const amount = parseRupees(values.amount);
  return withoutEmpty({
    title: !title
      ? expenseErrors.title
      : title.length > ExpenseLimits.title
        ? expenseErrors.titleTooLong
        : undefined,
    amount: 'problem' in amount ? amountMessages[amount.problem] : undefined,
    category: values.category ? undefined : expenseErrors.category,
    expenseDate: isCalendarDate(values.expenseDate) ? undefined : expenseErrors.date,
    notes: tooLong(values.notes, ExpenseLimits.notes),
  });
}

/** The request body for a new expense. Call only after the form validates. */
export function toNewExpensePayload(values: ExpenseFormValues) {
  const amount = parseRupees(values.amount);
  return {
    title: values.title.trim(),
    amountMinor: 'minor' in amount ? amount.minor : 0,
    category: values.category as ExpenseCategory,
    expenseDate: values.expenseDate,
    eventId: values.eventId || null,
    notes: values.notes.trim() || null,
  };
}

/**
 * The PATCH body for an edit: only the fields that differ from the expense as loaded, so a
 * change made meanwhile in another tab is not undone (as for tasks, review P7-M2).
 */
export function toExpenseChanges(values: ExpenseFormValues, expense: ApiExpense) {
  const full = toNewExpensePayload(values);
  const loaded = toNewExpensePayload(formFromExpense(expense));
  const changes: Partial<ReturnType<typeof toNewExpensePayload>> = {};
  for (const key of Object.keys(full) as (keyof typeof full)[]) {
    if (full[key] !== loaded[key]) Object.assign(changes, { [key]: full[key] });
  }
  return changes;
}

/** Field errors reported by the API, as form errors (first message per field). */
export function expenseErrorsFromApi(fields: Record<string, string[]>): ExpenseFormErrors {
  const map: Record<string, ExpenseFormField> = {
    title: 'title',
    amountMinor: 'amount',
    category: 'category',
    expenseDate: 'expenseDate',
    eventId: 'eventId',
    notes: 'notes',
  };
  const errors: ExpenseFormErrors = {};
  for (const [field, formField] of Object.entries(map)) {
    const message = fields[field]?.[0];
    if (message) errors[formField] = message;
  }
  return errors;
}

// ─── Payment form ──────────────────────────────────────────────────────────────────────────

/** What the payment form holds. `payer` is a member's user ID, or 'other' for a typed name. */
export interface PaymentFormValues {
  amount: string;
  paymentDate: string;
  payer: string;
  payerName: string;
  method: PaymentMethod | '';
  reference: string;
  notes: string;
}

export const OTHER_PAYER = 'other';

export type PaymentFormField = keyof PaymentFormValues;
export type PaymentFormErrors = Partial<Record<PaymentFormField, string>>;

/**
 * A new payment paid today by the signed-in member. "Mark as fully paid" fills in the pending
 * amount (0028 #14, P2 a); the member checks it and saves.
 */
export function emptyPaymentForm(
  today: string,
  userId: string,
  pendingMinor?: number,
): PaymentFormValues {
  return {
    amount: pendingMinor === undefined ? '' : toRupeeInput(pendingMinor),
    paymentDate: today,
    payer: userId,
    payerName: '',
    method: '',
    reference: '',
    notes: '',
  };
}

export function formFromPayment(payment: ApiPayment): PaymentFormValues {
  const member = payment.paidByType === 'WEDDING_MEMBER';
  return {
    amount: toRupeeInput(payment.amountMinor),
    paymentDate: payment.paymentDate,
    payer: member ? (payment.paidByUserId ?? '') : OTHER_PAYER,
    payerName: member ? '' : payment.paidByName,
    method: payment.paymentMethod ?? '',
    reference: payment.referenceNumber ?? '',
    notes: payment.notes ?? '',
  };
}

/**
 * Checks the payment as the API will (Phase 8 PRD §3.2, §4). `availableMinor` is what can still
 * be paid: the pending amount, plus the payment's own amount when it is being edited.
 */
export function validatePaymentForm(
  values: PaymentFormValues,
  today: string,
  availableMinor: number,
  format: (minor: number) => string,
): PaymentFormErrors {
  const amount = parseRupees(values.amount);
  const name = values.payerName.trim();
  return withoutEmpty({
    amount:
      'problem' in amount
        ? amountMessages[amount.problem]
        : amount.minor > availableMinor
          ? expenseErrors.exceedsPending.replace('{amount}', format(availableMinor))
          : undefined,
    paymentDate: !isCalendarDate(values.paymentDate)
      ? expenseErrors.date
      : values.paymentDate > today
        ? expenseErrors.paymentDateFuture
        : undefined,
    payerName:
      values.payer !== OTHER_PAYER
        ? undefined
        : !name
          ? expenseErrors.payer
          : name.length > ExpenseLimits.payerName
            ? expenseErrors.payerTooLong
            : undefined,
    reference: tooLong(values.reference, ExpenseLimits.reference),
    notes: tooLong(values.notes, ExpenseLimits.paymentNotes),
  });
}

/** The request body for a payment, new or edited. Call only after the form validates. */
export function toPaymentPayload(values: PaymentFormValues) {
  const amount = parseRupees(values.amount);
  const other = values.payer === OTHER_PAYER;
  return {
    amountMinor: 'minor' in amount ? amount.minor : 0,
    paymentDate: values.paymentDate,
    paidByType: other ? ('EXTERNAL_PERSON' as const) : ('WEDDING_MEMBER' as const),
    paidByUserId: other ? null : values.payer,
    paidByName: other ? values.payerName.trim() : null,
    paymentMethod: values.method || null,
    referenceNumber: values.reference.trim() || null,
    notes: values.notes.trim() || null,
  };
}

/** Field errors reported by the API for a payment (first message per field). */
export function paymentErrorsFromApi(fields: Record<string, string[]>): PaymentFormErrors {
  const map: Record<string, PaymentFormField> = {
    amountMinor: 'amount',
    paymentDate: 'paymentDate',
    paidByName: 'payerName',
    paymentMethod: 'method',
    referenceNumber: 'reference',
    notes: 'notes',
  };
  const errors: PaymentFormErrors = {};
  for (const [field, formField] of Object.entries(map)) {
    const message = fields[field]?.[0];
    if (message) errors[formField] = message;
  }
  return errors;
}

// ─── Display ───────────────────────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "5 Jan 2027" for a YYYY-MM-DD date, with no leading zero (0029 correction 2). */
export function formatShortDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  return `${day} ${MONTHS[month - 1]} ${year}`;
}
