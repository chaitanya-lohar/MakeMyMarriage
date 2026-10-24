import { Injectable } from '@nestjs/common';
import { EventsService } from '../../../events/index.js';
import type { ExpenseListQuery, ExpensePage } from '../../domain/types/expense.js';
import {
  decodeExpenseCursor,
  ExpensesRepository,
} from '../../infrastructure/repositories/expenses.repository.js';
import { ExpensesErrors } from '../expenses-errors.js';
import { VendorsService } from '../../../vendors/index.js';

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
    private readonly vendors: VendorsService,
  ) {}

  async execute(weddingId: string, query: ExpenseListQuery): Promise<ExpensePage> {
    const cursor = query.cursor === undefined ? undefined : decodeExpenseCursor(query.cursor);
    if (cursor === null) throw ExpensesErrors.invalidCursor();

    if (query.eventId !== undefined && query.eventId !== 'none') {
      await this.events.getActive(weddingId, query.eventId);
    }
    if (query.vendorId !== undefined) {
      const vendor = await this.vendors.lookup(weddingId, query.vendorId);
      if (!vendor || vendor.deleted) throw ExpensesErrors.vendorNotFound();
    }

    return this.expenses.list(weddingId, {
      category: query.category,
      eventId: query.eventId,
      vendorId: query.vendorId,
      paymentStatus: query.paymentStatus,
      search: query.search,
      limit: query.limit,
      cursor,
    });
  }
}
