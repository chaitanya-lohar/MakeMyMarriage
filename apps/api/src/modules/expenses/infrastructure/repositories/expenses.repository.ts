import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, trusted, Types, type PipelineStage } from 'mongoose';
import { sessionOf, type Transaction } from '../../../../infrastructure/database/transaction.js';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CURRENCY,
  PaymentStatus,
  type ExpenseCategory,
} from '../../domain/rules/expense-rules.js';
import type {
  Expense,
  ExpenseChanges,
  ExpenseListQuery,
  ExpensePage,
  ExpenseSummary,
  ExpenseTotals,
  NewExpense,
} from '../../domain/types/expense.js';
import { ExpenseRecord, type ExpenseDocument } from '../schemas/expense.schema.js';

/** Filters on ObjectId fields need ObjectIds: strings are not cast under sanitizeFilter. */
const oid = (id: string) => new Types.ObjectId(id);

// Server-built operators; `trusted` exempts them from the global sanitizeFilter.
const notDeleted = () => ({ deletedAt: trusted({ $exists: false }) });

function toStoredDate(calendarDate: string): Date {
  return new Date(`${calendarDate}T00:00:00.000Z`);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The status that follows from `paidMinor` and `amountMinor` (0028 #7), as an update-pipeline
 * expression, so the status is always written in the same update as the totals it depends on.
 */
const STATUS_FROM_TOTALS = {
  $switch: {
    branches: [
      { case: { $lte: ['$paidMinor', 0] }, then: PaymentStatus.Pending },
      { case: { $lt: ['$paidMinor', '$amountMinor'] }, then: PaymentStatus.PartiallyPaid },
    ],
    default: PaymentStatus.Paid,
  },
};

interface ExpenseShape {
  _id: Types.ObjectId;
  weddingId: Types.ObjectId;
  title: string;
  amountMinor: number;
  paidMinor: number;
  currency: string;
  category: ExpenseCategory;
  eventId?: Types.ObjectId;
  expenseDate: Date;
  paymentStatus: Expense['paymentStatus'];
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

function toExpense(document: ExpenseShape | ExpenseDocument): Expense {
  return {
    id: document._id.toString(),
    weddingId: document.weddingId.toString(),
    title: document.title,
    amountMinor: document.amountMinor,
    paidMinor: document.paidMinor,
    currency: document.currency,
    category: document.category,
    expenseDate: document.expenseDate.toISOString().slice(0, 10),
    eventId: document.eventId ? document.eventId.toString() : null,
    paymentStatus: document.paymentStatus,
    notes: document.notes ?? null,
    createdBy: document.createdBy.toString(),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

/** List order (0028 #20): expense date, newest first; then newest created; then ID. */
const ORDER = { expenseDate: -1, createdAt: -1, _id: -1 } as const;

interface Cursor {
  expenseDate: Date;
  createdAt: Date;
  id: string;
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(
    JSON.stringify([cursor.expenseDate.toISOString(), cursor.createdAt.toISOString(), cursor.id]),
  ).toString('base64url');
}

/** The cursor's position, or null when it is not one this API issued. */
export function decodeExpenseCursor(value: string): Cursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      Array.isArray(parsed) &&
      parsed.length === 3 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string' &&
      typeof parsed[2] === 'string' &&
      isValidObjectId(parsed[2])
    ) {
      const expenseDate = new Date(parsed[0]);
      const createdAt = new Date(parsed[1]);
      if (!Number.isNaN(expenseDate.getTime()) && !Number.isNaN(createdAt.getTime())) {
        return { expenseDate, createdAt, id: parsed[2] };
      }
    }
  } catch {
    // Falls through: malformed cursor.
  }
  return null;
}

export interface ExpenseListFilter extends Omit<ExpenseListQuery, 'cursor'> {
  cursor?: Cursor;
}

/** Why a conditional update of an expense changed nothing. */
export type ExpenseUpdateResult =
  | { expense: Expense }
  | { refused: 'NOT_FOUND' }
  | { refused: 'BELOW_PAID' | 'EXCEEDS_AMOUNT'; current: Expense };

/**
 * Data access for `expenses`, always scoped to one wedding. Deleted expenses are never
 * returned. `paidMinor` and `paymentStatus` are only ever changed by conditional updates that
 * keep 0 ≤ paid ≤ amount (0028 #8–#10).
 */
@Injectable()
export class ExpensesRepository {
  constructor(@InjectModel(ExpenseRecord.name) private readonly expenses: Model<ExpenseRecord>) {}

  async create(expense: NewExpense, transaction?: Transaction): Promise<Expense> {
    const [document] = await this.expenses.create(
      [
        {
          weddingId: oid(expense.weddingId),
          title: expense.title,
          amountMinor: expense.amountMinor,
          paidMinor: 0,
          currency: EXPENSE_CURRENCY,
          category: expense.category,
          expenseDate: toStoredDate(expense.expenseDate),
          paymentStatus: PaymentStatus.Pending,
          createdBy: oid(expense.createdBy),
          ...(expense.notes ? { notes: expense.notes } : {}),
          ...(expense.eventId ? { eventId: oid(expense.eventId) } : {}),
        },
      ],
      { session: sessionOf(transaction) },
    );
    return toExpense(document as ExpenseDocument);
  }

  /** The active expense; with a transaction, as that transaction sees it. */
  async findActive(
    weddingId: string,
    expenseId: string,
    transaction?: Transaction,
  ): Promise<Expense | null> {
    if (!isValidObjectId(expenseId)) return null;
    const document = await this.expenses
      .findOne({ _id: oid(expenseId), weddingId: oid(weddingId), ...notDeleted() })
      .session(sessionOf(transaction) ?? null);
    return document ? toExpense(document) : null;
  }

  /**
   * Applies the changes; a null optional field is removed. A new amount is written only if it
   * is not below the paid total, and the status is recalculated in the same update (0028 #10).
   */
  async update(
    weddingId: string,
    expenseId: string,
    changes: ExpenseChanges,
    transaction?: Transaction,
  ): Promise<ExpenseUpdateResult> {
    if (!isValidObjectId(expenseId)) return { refused: 'NOT_FOUND' };
    // Every value is a literal: user text such as "$title" must never be read as a field path.
    const set: Record<string, unknown> = {};
    const unset: string[] = [];
    if (changes.title !== undefined) set.title = { $literal: changes.title };
    if (changes.amountMinor !== undefined) set.amountMinor = { $literal: changes.amountMinor };
    if (changes.category !== undefined) set.category = { $literal: changes.category };
    if (changes.expenseDate !== undefined) {
      set.expenseDate = { $literal: toStoredDate(changes.expenseDate) };
    }
    if (changes.notes !== undefined) {
      if (changes.notes === null || changes.notes === '') unset.push('notes');
      else set.notes = { $literal: changes.notes };
    }
    if (changes.eventId !== undefined) {
      if (changes.eventId === null) unset.push('eventId');
      else set.eventId = { $literal: oid(changes.eventId) };
    }

    const filter: Record<string, unknown> = {
      _id: oid(expenseId),
      weddingId: oid(weddingId),
      ...notDeleted(),
    };
    if (changes.amountMinor !== undefined) {
      filter.$expr = trusted({ $gte: [changes.amountMinor, '$paidMinor'] });
    }
    const pipeline: PipelineStage[] = [
      { $set: { ...set, updatedAt: '$$NOW' } },
      ...(unset.length > 0 ? [{ $unset: unset } as PipelineStage] : []),
      { $set: { paymentStatus: STATUS_FROM_TOTALS } },
    ];
    const document = await this.expenses.findOneAndUpdate(filter, pipeline, {
      returnDocument: 'after',
      session: sessionOf(transaction),
      updatePipeline: true,
      timestamps: false,
    });
    if (document) return { expense: toExpense(document) };
    const current = await this.findActive(weddingId, expenseId, transaction);
    return current && changes.amountMinor !== undefined
      ? { refused: 'BELOW_PAID', current }
      : { refused: 'NOT_FOUND' };
  }

  /**
   * Adds `deltaMinor` (negative to take away) to the paid total and recalculates the status,
   * only if the result stays within the amount (0028 #8, #9). Run in the payment's transaction:
   * two payments saved at once both write this expense, so MongoDB retries one of them, which
   * then sees the other's total and is refused if it would overpay.
   */
  async addToPaid(
    weddingId: string,
    expenseId: string,
    deltaMinor: number,
    transaction: Transaction,
  ): Promise<ExpenseUpdateResult> {
    if (!isValidObjectId(expenseId)) return { refused: 'NOT_FOUND' };
    const document = await this.expenses.findOneAndUpdate(
      {
        _id: oid(expenseId),
        weddingId: oid(weddingId),
        ...notDeleted(),
        $expr: trusted({
          $and: [
            { $lte: [{ $add: ['$paidMinor', deltaMinor] }, '$amountMinor'] },
            { $gte: [{ $add: ['$paidMinor', deltaMinor] }, 0] },
          ],
        }),
      },
      [
        { $set: { paidMinor: { $add: ['$paidMinor', deltaMinor] }, updatedAt: '$$NOW' } },
        { $set: { paymentStatus: STATUS_FROM_TOTALS } },
      ],
      {
        returnDocument: 'after',
        session: sessionOf(transaction),
        updatePipeline: true,
        timestamps: false,
      },
    );
    if (document) return { expense: toExpense(document) };
    const current = await this.findActive(weddingId, expenseId, transaction);
    return current ? { refused: 'EXCEEDS_AMOUNT', current } : { refused: 'NOT_FOUND' };
  }

  /** Soft-deletes the expense; its payments are kept (0028 #16). */
  async softDelete(
    weddingId: string,
    expenseId: string,
    deletedBy: string,
    transaction?: Transaction,
  ): Promise<Expense | null> {
    if (!isValidObjectId(expenseId)) return null;
    const document = await this.expenses.findOneAndUpdate(
      { _id: oid(expenseId), weddingId: oid(weddingId), ...notDeleted() },
      { $set: { deletedAt: new Date(), deletedBy: oid(deletedBy) } },
      { session: sessionOf(transaction) },
    );
    return document ? toExpense(document) : null;
  }

  /** The match for the list filters (API Design §12). */
  private listMatch(weddingId: string, filter: ExpenseListFilter): Record<string, unknown> {
    const match: Record<string, unknown> = {
      weddingId: oid(weddingId),
      deletedAt: { $exists: false },
    };
    if (filter.category) match.category = filter.category;
    if (filter.paymentStatus) match.paymentStatus = filter.paymentStatus;
    if (filter.eventId === 'none') match.eventId = { $exists: false };
    else if (filter.eventId) match.eventId = oid(filter.eventId);
    const search = filter.search?.trim();
    if (search) match.title = { $regex: escapeRegex(search), $options: 'i' };
    return match;
  }

  /** A page of the list, newest first, after the cursor, with totals for the whole filter. */
  async list(weddingId: string, filter: ExpenseListFilter): Promise<ExpensePage> {
    const match = this.listMatch(weddingId, filter);
    const pipeline: PipelineStage[] = [{ $match: match }];
    const { cursor } = filter;
    if (cursor) {
      const after = oid(cursor.id);
      pipeline.push({
        $match: {
          $or: [
            { expenseDate: { $lt: cursor.expenseDate } },
            { expenseDate: cursor.expenseDate, createdAt: { $lt: cursor.createdAt } },
            { expenseDate: cursor.expenseDate, createdAt: cursor.createdAt, _id: { $lt: after } },
          ],
        },
      });
    }
    pipeline.push({ $sort: ORDER }, { $limit: filter.limit + 1 });

    const [rows, totals] = await Promise.all([
      this.expenses.aggregate<ExpenseShape>(pipeline),
      this.totals(match),
    ]);
    const page = rows.slice(0, filter.limit);
    const last = page.at(-1);
    return {
      expenses: page.map(toExpense),
      nextCursor:
        rows.length > filter.limit && last
          ? encodeCursor({
              expenseDate: last.expenseDate,
              createdAt: last.createdAt,
              id: last._id.toString(),
            })
          : null,
      totals,
    };
  }

  private async totals(match: Record<string, unknown>): Promise<ExpenseTotals> {
    const [row] = await this.expenses.aggregate<{ total: number; paid: number }>([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$amountMinor' }, paid: { $sum: '$paidMinor' } } },
    ]);
    const totalMinor = row?.total ?? 0;
    const paidMinor = row?.paid ?? 0;
    return { totalMinor, paidMinor, pendingMinor: totalMinor - paidMinor };
  }

  /**
   * The dashboard summary over expenses that are not deleted (0028 #23). Event names are
   * added by the caller; the breakdowns each add up to the total.
   */
  async summary(weddingId: string): Promise<
    Omit<ExpenseSummary, 'byEvent'> & {
      byEvent: { eventId: string | null; totalMinor: number }[];
    }
  > {
    const match = { weddingId: oid(weddingId), deletedAt: { $exists: false } };
    const [totals, byCategory, byEvent] = await Promise.all([
      this.totals(match),
      this.expenses.aggregate<{ _id: ExpenseCategory; total: number }>([
        { $match: match },
        { $group: { _id: '$category', total: { $sum: '$amountMinor' } } },
      ]),
      this.expenses.aggregate<{ _id: Types.ObjectId | null; total: number }>([
        { $match: match },
        { $group: { _id: { $ifNull: ['$eventId', null] }, total: { $sum: '$amountMinor' } } },
      ]),
    ]);
    const categoryOrder = (category: ExpenseCategory) => EXPENSE_CATEGORIES.indexOf(category);
    return {
      ...totals,
      // Largest first; equal totals keep the category list's order.
      byCategory: byCategory
        .sort((a, b) => b.total - a.total || categoryOrder(a._id) - categoryOrder(b._id))
        .map((row) => ({ category: row._id, totalMinor: row.total })),
      byEvent: byEvent.map((row) => ({
        eventId: row._id ? row._id.toString() : null,
        totalMinor: row.total,
      })),
    };
  }

  /**
   * Makes every expense linked to a deleted event a whole-wedding expense (0028 #17). Returns
   * the IDs of the expenses it changed.
   */
  async unlinkEvent(
    weddingId: string,
    eventId: string,
    transaction: Transaction,
  ): Promise<string[]> {
    const filter = { weddingId: oid(weddingId), eventId: oid(eventId), ...notDeleted() };
    const session = sessionOf(transaction);
    const documents = await this.expenses.find(filter, { _id: 1 }, { session });
    if (documents.length === 0) return [];
    await this.expenses.updateMany(filter, { $unset: { eventId: '' } }, { session });
    return documents.map((document) => (document._id as Types.ObjectId).toString());
  }
}
