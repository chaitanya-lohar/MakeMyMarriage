import type { Transaction } from '../../../../infrastructure/database/transaction.js';
export abstract class EventVendors {
  abstract unlinkDeletedEvent(
    weddingId: string,
    eventId: string,
    actorUserId: string,
    transaction: Transaction,
  ): Promise<void>;
}
