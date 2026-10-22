import { Injectable } from '@nestjs/common';
import {
  TransactionRunner,
  type Transaction,
} from '../../../../infrastructure/database/transaction.js';
import type { WeddingEvent } from '../../domain/types/event.js';
import { EventsRepository } from '../../infrastructure/repositories/events.repository.js';
import { EventsErrors } from '../events-errors.js';
import { EventExpenses } from '../ports/event-expenses.port.js';
import { EventTasks } from '../ports/event-tasks.port.js';

/**
 * Event reads for the events controller and for other modules (guests, invitations,
 * dashboard). Every method is scoped to one wedding; deleted events are never returned.
 */
@Injectable()
export class EventsService {
  constructor(
    private readonly events: EventsRepository,
    private readonly tasks: EventTasks,
    private readonly expenses: EventExpenses,
    private readonly transactions: TransactionRunner,
  ) {}

  listActive(weddingId: string): Promise<WeddingEvent[]> {
    return this.events.listActive(weddingId);
  }

  /**
   * The active event, or EVENT_NOT_FOUND. Pass a transaction to check it as part of a change
   * in another module (e.g. linking a task — decision 0026 #11).
   */
  async getActive(
    weddingId: string,
    eventId: string,
    transaction?: Transaction,
  ): Promise<WeddingEvent> {
    const event = await this.events.findActive(weddingId, eventId, transaction);
    if (!event) throw EventsErrors.notFound();
    return event;
  }

  /**
   * The active event, or EVENT_NOT_FOUND, claimed for a link made in the given transaction: a
   * concurrent deletion of the event conflicts with it, so MongoDB retries one of the two and
   * nothing is ever linked to a deleted event (review P8-M1; decisions 0026 #12, 0028 #17).
   */
  async claimActive(
    weddingId: string,
    eventId: string,
    transaction: Transaction,
  ): Promise<WeddingEvent> {
    const event = await this.events.claimActive(weddingId, eventId, transaction);
    if (!event) throw EventsErrors.notFound();
    return event;
  }

  findActive(
    weddingId: string,
    eventId: string,
    transaction?: Transaction,
  ): Promise<WeddingEvent | null> {
    return this.events.findActive(weddingId, eventId, transaction);
  }

  /** The active events among these IDs, in event order. */
  findActiveMany(weddingId: string, eventIds: string[]): Promise<WeddingEvent[]> {
    return this.events.findActiveMany(weddingId, eventIds);
  }

  /** Up to `limit` active events dated `fromDate` (YYYY-MM-DD) or later, in event order. */
  listActiveFrom(weddingId: string, fromDate: string, limit: number): Promise<WeddingEvent[]> {
    return this.events.listActiveFrom(weddingId, fromDate, limit);
  }

  /**
   * Soft-deletes the event and, in the same transaction, makes its tasks and expenses
   * whole-wedding ones (decisions 0026 #12, 0028 #17).
   */
  async delete(weddingId: string, eventId: string, userId: string): Promise<void> {
    const deleted = await this.transactions.run(async (transaction) => {
      if (!(await this.events.softDelete(weddingId, eventId, userId, transaction))) return false;
      await this.tasks.unlinkDeletedEvent(weddingId, eventId, userId, transaction);
      await this.expenses.unlinkDeletedEvent(weddingId, eventId, userId, transaction);
      return true;
    });
    if (!deleted) throw EventsErrors.notFound();
  }
}
