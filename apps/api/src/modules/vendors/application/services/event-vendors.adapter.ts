import { Injectable } from '@nestjs/common';
import { AuditAction, AuditService } from '../../../audit/index.js';
import type { Transaction } from '../../../../infrastructure/database/transaction.js';
import { VendorsRepository } from '../../infrastructure/repositories/vendors.repository.js';
import { EventVendors } from '../ports/event-vendors.port.js';
@Injectable()
export class EventVendorsAdapter extends EventVendors {
  constructor(
    private readonly vendors: VendorsRepository,
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
    const bookings = await this.vendors.unlinkEvent(weddingId, eventId, transaction);
    for (const b of bookings)
      await this.audit.record(
        {
          weddingId,
          actorUserId,
          action: AuditAction.VendorBookingEventUnlinked,
          resourceType: 'vendor_booking',
          resourceId: b._id.toString(),
          metadata: { oldValue: { eventId }, newValue: { eventId: null } },
        },
        transaction,
      );
  }
}
