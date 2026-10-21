import { Injectable } from '@nestjs/common';
import {
  TransactionRunner,
  type Transaction,
} from '../../../../infrastructure/database/transaction.js';
import { AuditAction, AuditService } from '../../../audit/index.js';
import { EventsService } from '../../../events/index.js';
import type { Expense, ExpenseChanges, ExpenseDetails } from '../../domain/types/expense.js';
import { ExpensesRepository } from '../../infrastructure/repositories/expenses.repository.js';
import { ExpensesErrors } from '../expenses-errors.js';

/** Fields whose old and new values are kept in the audit entry; notes only by name. */
const VALUE_FIELDS = ['title', 'amountMinor', 'category', 'expenseDate', 'eventId'] as const;

/**
 * Creates and edits expenses (Phase 8 PRD §5.1, decision 0028). The expense and its audit
 * entry are saved in one transaction. Lowering the amount below the paid total is refused by
 * the same conditional update that writes it, so a payment saved meanwhile cannot slip under
 * it (0028 #10).
 */
@Injectable()
export class SaveExpenseUseCase {
  constructor(
    private readonly expenses: ExpensesRepository,
    private readonly events: EventsService,
    private readonly audit: AuditService,
    private readonly transactions: TransactionRunner,
  ) {}

  async create(weddingId: string, userId: string, details: ExpenseDetails): Promise<Expense> {
    return this.transactions.run(async (transaction) => {
      // Checked in the transaction, so an event deleted meanwhile is refused.
      await this.checkEvent(weddingId, details.eventId, transaction);
      const expense = await this.expenses.create(
        { ...details, weddingId, createdBy: userId },
        transaction,
      );
      await this.audit.record(
        {
          weddingId,
          actorUserId: userId,
          action: AuditAction.ExpenseCreated,
          resourceType: 'expense',
          resourceId: expense.id,
          metadata: {
            title: expense.title,
            amountMinor: expense.amountMinor,
            category: expense.category,
            expenseDate: expense.expenseDate,
            eventId: expense.eventId,
          },
        },
        transaction,
      );
      return expense;
    });
  }

  /** Applies the changes; only real changes are audited. */
  async update(
    weddingId: string,
    expenseId: string,
    userId: string,
    changes: ExpenseChanges,
  ): Promise<Expense> {
    return this.transactions.run(async (transaction) => {
      const current = await this.expenses.findActive(weddingId, expenseId, transaction);
      if (!current) throw ExpensesErrors.notFound();
      if (changes.eventId !== undefined && changes.eventId !== current.eventId) {
        await this.checkEvent(weddingId, changes.eventId, transaction);
      }

      const result = await this.expenses.update(weddingId, expenseId, changes, transaction);
      if ('refused' in result) {
        if (result.refused === 'NOT_FOUND') throw ExpensesErrors.notFound();
        throw ExpensesErrors.amountBelowPaid(result.current.paidMinor);
      }
      const { expense } = result;

      const oldValues: Record<string, unknown> = {};
      const newValues: Record<string, unknown> = {};
      for (const field of VALUE_FIELDS) {
        if (current[field] !== expense[field]) {
          oldValues[field] = current[field];
          newValues[field] = expense[field];
        }
      }
      const fields = current.notes !== expense.notes ? ['notes'] : [];
      if (Object.keys(newValues).length > 0 || fields.length > 0) {
        await this.audit.record(
          {
            weddingId,
            actorUserId: userId,
            action: AuditAction.ExpenseUpdated,
            resourceType: 'expense',
            resourceId: expenseId,
            metadata: { oldValue: oldValues, newValue: { ...newValues, fields } },
          },
          transaction,
        );
      }
      return expense;
    });
  }

  /** An active event of the wedding, or EVENT_NOT_FOUND. */
  private async checkEvent(
    weddingId: string,
    eventId: string | null,
    transaction: Transaction,
  ): Promise<void> {
    if (eventId !== null) await this.events.getActive(weddingId, eventId, transaction);
  }
}
