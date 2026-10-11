import type { Transaction } from '../../../../infrastructure/database/transaction.js';

/** The invitation state shown with a guest (API Design §9: `guest.invitation`). */
export interface GuestInvitationSummary {
  deliveryStatus: string;
  isRevoked: boolean;
  lastSentAt: Date | null;
  firstOpenedAt: Date | null;
}

/**
 * What the guests module needs from invitations, implemented by the invitations module.
 * Invitations depend on guests (to read the guest and their events), so the dependency is
 * inverted here instead of the modules importing each other.
 */
export abstract class GuestInvitations {
  /** The invitation summaries of these guests, by guest ID; guests without one are absent. */
  abstract summariesFor(
    weddingId: string,
    guestIds: string[],
  ): Promise<Map<string, GuestInvitationSummary>>;

  /** Revokes a deleted guest's token in the deletion's transaction (0018 #9). */
  abstract revokeForDeletedGuest(
    weddingId: string,
    guestId: string,
    actorUserId: string,
    transaction: Transaction,
  ): Promise<void>;
}
