import type { Transaction } from '../../../../infrastructure/database/transaction.js';

/**
 * What the events module needs from tasks, implemented by the tasks module. Tasks depend on
 * events (to check and name a task's event), so the dependency is inverted here instead of
 * the modules importing each other.
 */
export abstract class EventTasks {
  /**
   * Makes the deleted event's tasks whole-wedding tasks and records it in their history, in
   * the deletion's transaction (decision 0026 #12).
   */
  abstract unlinkDeletedEvent(
    weddingId: string,
    eventId: string,
    actorUserId: string,
    transaction: Transaction,
  ): Promise<void>;
}
