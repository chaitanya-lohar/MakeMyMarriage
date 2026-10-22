import type {
  ExpenseCategory,
  PayerType,
  PaymentMethod,
  PaymentStatus,
} from '../rules/expense-rules.js';

/** A wedding expense (Database Design §12.1, decision 0028). Money is integer paise. */
export interface Expense {
  id: string;
  weddingId: string;
  title: string;
  /** The full cost (0028 #5). */
  amountMinor: number;
  /** The sum of the payments (0028 #8). */
  paidMinor: number;
  currency: string;
  category: ExpenseCategory;
  /** Calendar date, YYYY-MM-DD, in the wedding's timezone. */
  expenseDate: string;
  /** Null for a whole-wedding expense. */
  eventId: string | null;
  paymentStatus: PaymentStatus;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** The fields an organizer enters; null clears an optional field. */
export interface ExpenseDetails {
  title: string;
  amountMinor: number;
  category: ExpenseCategory;
  expenseDate: string;
  eventId: string | null;
  notes: string | null;
}

export interface NewExpense extends ExpenseDetails {
  weddingId: string;
  createdBy: string;
}

/** A change to an expense: only the given fields change. */
export type ExpenseChanges = Partial<ExpenseDetails>;

/** An expense with what organizers see next to it. */
export interface ExpenseView {
  expense: Expense;
  eventName: string | null;
}

/** Who made a payment (0028 #12). */
export interface Payer {
  type: PayerType;
  /** Set for a wedding member. */
  userId: string | null;
  /** Set for someone outside the wedding, e.g. "Bride's father". */
  name: string | null;
}

/** One payment toward an expense (Database Design §12.2). */
export interface ExpensePayment {
  id: string;
  weddingId: string;
  expenseId: string;
  amountMinor: number;
  payer: Payer;
  /** Calendar date, YYYY-MM-DD; today or earlier in the wedding's timezone. */
  paymentDate: string;
  method: PaymentMethod | null;
  referenceNumber: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** The fields an organizer enters for a payment. */
export interface PaymentDetails {
  amountMinor: number;
  payer: Payer;
  paymentDate: string;
  method: PaymentMethod | null;
  referenceNumber: string | null;
  notes: string | null;
}

export interface NewPayment extends PaymentDetails {
  weddingId: string;
  expenseId: string;
  createdBy: string;
}

/** A payment with the payer's name to show. */
export interface PaymentView {
  payment: ExpensePayment;
  payerName: string;
}

/** List filters (API Design §12); `eventId: 'none'` means whole-wedding expenses. */
export interface ExpenseListQuery {
  category?: ExpenseCategory;
  eventId?: string;
  paymentStatus?: PaymentStatus;
  search?: string;
  limit: number;
  cursor?: string;
}

/** Sums over a set of expenses, in paise. */
export interface ExpenseTotals {
  totalMinor: number;
  paidMinor: number;
  pendingMinor: number;
}

export interface ExpensePage {
  expenses: Expense[];
  nextCursor: string | null;
  /** Over every expense matching the filters, not only this page (0028 #20). */
  totals: ExpenseTotals;
}

/** The dashboard's expense summary (Phase 8 PRD §8, decision 0028 #23). */
export interface ExpenseSummary extends ExpenseTotals {
  byCategory: { category: ExpenseCategory; totalMinor: number }[];
  byEvent: { eventId: string | null; eventName: string | null; totalMinor: number }[];
}
