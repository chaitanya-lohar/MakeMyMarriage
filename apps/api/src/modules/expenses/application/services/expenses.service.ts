import { Injectable } from '@nestjs/common';
import { TransactionRunner } from '../../../../infrastructure/database/transaction.js';
import { AuditAction, AuditService } from '../../../audit/index.js';
import { EventsService } from '../../../events/index.js';
import { UsersService } from '../../../users/index.js';
import { todayIn, WeddingsService } from '../../../weddings/index.js';
import { weddingNotFound } from '../../../workspace/index.js';
import type {
  Expense,
  ExpensePayment,
  ExpenseSummary,
  ExpenseView,
  PaymentView,
} from '../../domain/types/expense.js';
import { ExpensesRepository } from '../../infrastructure/repositories/expenses.repository.js';
import { ExpensesErrors } from '../expenses-errors.js';

/**
 * Expense reads and deletion for the expenses controller, and the dashboard summary for the
 * dashboard module. Every method is scoped to one wedding; deleted expenses are never
 * returned.
 */
@Injectable()
export class ExpensesService {
  constructor(
    private readonly expenses: ExpensesRepository,
    private readonly events: EventsService,
    private readonly users: UsersService,
    private readonly weddings: WeddingsService,
    private readonly audit: AuditService,
    private readonly transactions: TransactionRunner,
  ) {}

  /** Today in the wedding's timezone; payments are never dated after it (0028 #13). */
  async today(weddingId: string, now: Date = new Date()): Promise<string> {
    const wedding = await this.weddings.findById(weddingId);
    if (!wedding) throw weddingNotFound();
    return todayIn(wedding.timezone, now);
  }

  /** The active expense, or EXPENSE_NOT_FOUND. */
  async getActive(weddingId: string, expenseId: string): Promise<Expense> {
    const expense = await this.expenses.findActive(weddingId, expenseId);
    if (!expense) throw ExpensesErrors.notFound();
    return expense;
  }

  /** Expenses with their event names, in the given order. */
  async views(weddingId: string, expenses: Expense[]): Promise<ExpenseView[]> {
    const events = await this.events.listActive(weddingId);
    const names = new Map(events.map((event) => [event.id, event.name]));
    return expenses.map((expense) => ({
      expense,
      eventName: expense.eventId ? (names.get(expense.eventId) ?? null) : null,
    }));
  }

  async view(weddingId: string, expense: Expense): Promise<ExpenseView> {
    const [view] = await this.views(weddingId, [expense]);
    return view as ExpenseView;
  }

  /** Payments with the name to show for each payer: the member's name, or the typed one. */
  async paymentViews(payments: ExpensePayment[]): Promise<PaymentView[]> {
    const memberIds = payments.flatMap((payment) => payment.payer.userId ?? []);
    const users = await this.users.findManyByIds(memberIds);
    const names = new Map(users.map((user) => [user.id, user.displayName]));
    return payments.map((payment) => ({
      payment,
      payerName: payment.payer.userId
        ? (names.get(payment.payer.userId) ?? '')
        : (payment.payer.name ?? ''),
    }));
  }

  /**
   * Soft-deletes the expense after the client's confirmation. It and its payments stay in the
   * database; the deletion is audited (0028 #16, #18).
   */
  async delete(weddingId: string, expenseId: string, userId: string): Promise<void> {
    const deleted = await this.transactions.run(async (transaction) => {
      const expense = await this.expenses.softDelete(weddingId, expenseId, userId, transaction);
      if (!expense) return false;
      await this.audit.record(
        {
          weddingId,
          actorUserId: userId,
          action: AuditAction.ExpenseDeleted,
          resourceType: 'expense',
          resourceId: expenseId,
          metadata: {
            title: expense.title,
            amountMinor: expense.amountMinor,
            paidMinor: expense.paidMinor,
          },
        },
        transaction,
      );
      return true;
    });
    if (!deleted) throw ExpensesErrors.notFound();
  }

  /**
   * The dashboard summary, computed on every request (0028 #23): Total, Paid and Pending; by
   * category and by event (whole-wedding included), largest first.
   */
  async dashboard(weddingId: string): Promise<ExpenseSummary> {
    const [summary, events] = await Promise.all([
      this.expenses.summary(weddingId),
      this.events.listActive(weddingId),
    ]);
    const names = new Map(events.map((event) => [event.id, event.name]));
    const order = new Map(events.map((event, index) => [event.id, index]));
    // Equal totals keep event order, with the whole wedding last.
    const rank = (eventId: string | null) =>
      eventId === null
        ? Number.MAX_SAFE_INTEGER
        : (order.get(eventId) ?? Number.MAX_SAFE_INTEGER - 1);
    return {
      ...summary,
      byEvent: summary.byEvent
        .sort((a, b) => b.totalMinor - a.totalMinor || rank(a.eventId) - rank(b.eventId))
        .map((row) => ({
          eventId: row.eventId,
          eventName: row.eventId ? (names.get(row.eventId) ?? null) : null,
          totalMinor: row.totalMinor,
        })),
    };
  }
}
