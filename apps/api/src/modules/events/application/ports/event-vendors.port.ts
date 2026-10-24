import type { Transaction } from '../../../../infrastructure/database/transaction.js';

/** What the events module needs from vendors when an event is deleted. */
export abstract class EventVendors {
  abstract unlinkDeletedEvent(
    weddingId: string,
    eventId: string,
    actorUserId: string,
    transaction: Transaction,
  ): Promise<void>;
}
