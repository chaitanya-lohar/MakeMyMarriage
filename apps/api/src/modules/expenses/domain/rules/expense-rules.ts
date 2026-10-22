/** Expense rules: Phase 8 PRD v1.0 §3–§4 and §8, decisions 0010 #5–#8, 0018 and 0028. */

/** The fixed categories (0010 #7), in the order the screens list them. */
export const ExpenseCategory = {
  Venue: 'VENUE',
  Catering: 'CATERING',
  Decoration: 'DECORATION',
  Photography: 'PHOTOGRAPHY',
  Clothing: 'CLOTHING',
  Jewellery: 'JEWELLERY',
  Makeup: 'MAKEUP',
  Entertainment: 'ENTERTAINMENT',
  Invitations: 'INVITATIONS',
  Gifts: 'GIFTS',
  Miscellaneous: 'MISCELLANEOUS',
} as const;

export type ExpenseCategory = (typeof ExpenseCategory)[keyof typeof ExpenseCategory];

export const EXPENSE_CATEGORIES = Object.values(ExpenseCategory);

/** Calculated from the payments, never entered; no CANCELLED in V1 (0018, 0028 #7). */
export const PaymentStatus = {
  Pending: 'PENDING',
  PartiallyPaid: 'PARTIALLY_PAID',
  Paid: 'PAID',
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PAYMENT_STATUSES = Object.values(PaymentStatus);

export const PaymentMethod = {
  Cash: 'CASH',
  Upi: 'UPI',
  BankTransfer: 'BANK_TRANSFER',
  Card: 'CARD',
  Cheque: 'CHEQUE',
  Other: 'OTHER',
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PAYMENT_METHODS = Object.values(PaymentMethod);

/** Who made a payment: a wedding member, or someone typed by name (0028 #12). */
export const PayerType = {
  WeddingMember: 'WEDDING_MEMBER',
  ExternalPerson: 'EXTERNAL_PERSON',
} as const;

export type PayerType = (typeof PayerType)[keyof typeof PayerType];

export const PAYER_TYPES = Object.values(PayerType);

/** Rupees only (0028 #6). */
export const EXPENSE_CURRENCY = 'INR';

/** Field limits (0028 #6, #11, #13), enforced in the UI and the API. */
export const ExpenseLimits = {
  titleMaxLength: 150,
  notesMaxLength: 1000,
  /** ₹10 crore in paise. */
  amountMaxMinor: 10_000_000_000,
  payerNameMaxLength: 100,
  referenceMaxLength: 100,
  paymentNotesMaxLength: 500,
} as const;

/** Field messages (DRAFT wording — 0029). */
export const ExpenseMessages = {
  title: 'Enter a title.',
  titleTooLong: 'Use 150 characters or fewer.',
  amount: 'Enter an amount more than ₹0.',
  amountTooLarge: 'Enter at most ₹10,00,00,000.',
  category: 'Choose a category.',
  expenseDate: 'Enter a valid date.',
  paymentDate: 'Enter a valid date.',
  paymentDateFuture: "The payment date can't be in the future.",
  payer: 'Enter who paid.',
  payerTooLong: 'Use 100 characters or fewer.',
  method: 'Choose a payment method.',
  tooLong: (max: number) => `Keep it under ${max.toLocaleString('en-IN')} characters.`,
} as const;

/** The status that follows from the paid total and the amount (0028 #7). */
export function paymentStatusFor(paidMinor: number, amountMinor: number): PaymentStatus {
  if (paidMinor <= 0) return PaymentStatus.Pending;
  return paidMinor < amountMinor ? PaymentStatus.PartiallyPaid : PaymentStatus.Paid;
}
