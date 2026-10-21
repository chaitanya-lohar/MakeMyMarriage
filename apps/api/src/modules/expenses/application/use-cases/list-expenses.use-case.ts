import { Injectable } from '@nestjs/common';
import { EventsService } from '../../../events/index.js';
import type { ExpenseListQuery, ExpensePage } from '../../domain/types/expense.js';
import {
  decodeExpenseCursor,
  ExpensesRepository,
} from '../../infrastructure/repositories/expenses.repository.js';
import { ExpensesErrors } from '../expenses-errors.js';

/**
 * Lists, filters and searches expenses, with totals for the filters (Phase 8 PRD §6, API
 * Design §12). The event filter takes an active event of the wedding, or `none` for
 * whole-wedding expenses.
 */
@Injectable()
export class ListExpensesUseCase {
  constructor(
    private readonly expenses: ExpensesRepository,
    private readonly events: EventsService,
  ) {}

  async execute(weddingId: string, query: ExpenseListQuery): Promise<ExpensePage> {
    const cursor = query.cursor === undefined ? undefined : decodeExpenseCursor(query.cursor);
    if (cursor === null) throw ExpensesErrors.invalidCursor();

    if (query.eventId !== undefined && query.eventId !== 'none') {
      await this.events.getActive(weddingId, query.eventId);
    }

    return this.expenses.list(weddingId, {
      category: query.category,
      eventId: query.eventId,
      paymentStatus: query.paymentStatus,
      search: query.search,
      limit: query.limit,
      cursor,
    });
  }
}
