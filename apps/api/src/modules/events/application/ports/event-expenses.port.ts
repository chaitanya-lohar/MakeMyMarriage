import type { Transaction } from '../../../../infrastructure/database/transaction.js';

/**
 * What the events module needs from expenses, implemented by the expenses module. Expenses
 * depend on events (to check and name an expense's event), so the dependency is inverted here
 * instead of the modules importing each other — as for tasks (EventTasks).
 */
export abstract class EventExpenses {
  /**
   * Makes the deleted event's expenses whole-wedding expenses, keeping their payments, and
   * audits it, in the deletion's transaction (decision 0028 #17).
   */
  abstract unlinkDeletedEvent(
    weddingId: string,
    eventId: string,
    actorUserId: string,
    transaction: Transaction,
  ): Promise<void>;
}
