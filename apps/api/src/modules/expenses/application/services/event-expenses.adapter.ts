import { Injectable } from '@nestjs/common';
import type { Transaction } from '../../../../infrastructure/database/transaction.js';
import { AuditAction, AuditService } from '../../../audit/index.js';
import { EventExpenses } from '../../../events/index.js';
import { ExpensesRepository } from '../../infrastructure/repositories/expenses.repository.js';

/** The expenses module's side of the events module's EventExpenses port (decision 0028 #17). */
@Injectable()
export class EventExpensesAdapter extends EventExpenses {
  constructor(
    private readonly expenses: ExpensesRepository,
    private readonly audit: AuditService,
  ) {
    super();
  }

  async unlinkDeletedEvent(
    weddingId: string,
    eventId: string,
    actorUserId: string,
    transaction: Transaction,
  ): Promise<void> {
    const expenseIds = await this.expenses.unlinkEvent(weddingId, eventId, transaction);
    for (const expenseId of expenseIds) {
      await this.audit.record(
        {
          weddingId,
          actorUserId,
          action: AuditAction.ExpenseEventUnlinked,
          resourceType: 'expense',
          resourceId: expenseId,
          metadata: { eventId },
        },
        transaction,
      );
    }
  }
}
