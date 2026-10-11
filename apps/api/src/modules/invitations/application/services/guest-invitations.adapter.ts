import { Injectable } from '@nestjs/common';
import type { Transaction } from '../../../../infrastructure/database/transaction.js';
import { AuditAction, AuditService } from '../../../audit/index.js';
import { GuestInvitations, type GuestInvitationSummary } from '../../../guests/index.js';
import { GuestInvitationsRepository } from '../../infrastructure/repositories/guest-invitations.repository.js';

/** The invitations module's side of the GuestInvitations port (see the guests module). */
@Injectable()
export class GuestInvitationsAdapter extends GuestInvitations {
  constructor(
    private readonly invitations: GuestInvitationsRepository,
    private readonly audit: AuditService,
  ) {
    super();
  }

  async summariesFor(
    weddingId: string,
    guestIds: string[],
  ): Promise<Map<string, GuestInvitationSummary>> {
    const invitations = await this.invitations.findForGuests(weddingId, guestIds);
    return new Map(
      [...invitations].map(([guestId, invitation]) => [
        guestId,
        {
          deliveryStatus: invitation.deliveryStatus,
          isRevoked: invitation.isRevoked,
          lastSentAt: invitation.lastSentAt,
          firstOpenedAt: invitation.firstOpenedAt,
        },
      ]),
    );
  }

  async revokeForDeletedGuest(
    weddingId: string,
    guestId: string,
    actorUserId: string,
    transaction: Transaction,
  ): Promise<void> {
    const result = await this.invitations.revoke(weddingId, guestId, transaction);
    if (result?.revoked) {
      await this.audit.record(
        {
          weddingId,
          actorUserId,
          action: AuditAction.InvitationTokenRevoked,
          resourceType: 'guest_invitation',
          resourceId: result.invitation.id,
          metadata: { reason: 'GUEST_DELETED' },
        },
        transaction,
      );
    }
  }
}
