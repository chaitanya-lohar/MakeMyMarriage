import type { OwnerSeat } from '../../../workspace/index.js';

/** Ownership-offer statuses (Database Design §7.6). Offers never expire (0034 R3). */
export const OwnershipTransferStatus = {
  Pending: 'PENDING',
  Accepted: 'ACCEPTED',
  Declined: 'DECLINED',
  Cancelled: 'CANCELLED',
} as const;
export type OwnershipTransferStatus =
  (typeof OwnershipTransferStatus)[keyof typeof OwnershipTransferStatus];

/** Why an offer was cancelled. */
export const TransferCancelReason = {
  ByOwner: 'BY_OWNER',
  /** The giver is no longer an owner, or the recipient was removed or made owner. */
  MembershipChanged: 'MEMBERSHIP_CHANGED',
} as const;
export type TransferCancelReason = (typeof TransferCancelReason)[keyof typeof TransferCancelReason];

/** An owner's offer of their own seat to a member (Database Design §7.6, P10-5). */
export interface OwnershipTransfer {
  id: string;
  weddingId: string;
  fromMembershipId: string;
  toMembershipId: string;
  ownerSeat: OwnerSeat;
  status: OwnershipTransferStatus;
  requestedBy: string;
  respondedAt?: Date;
  cancelledReason?: TransferCancelReason;
  createdAt: Date;
}

/** The wedding already has a pending offer. */
export class OwnershipTransferPendingError extends Error {
  constructor() {
    super('An ownership offer is already pending');
    this.name = 'OwnershipTransferPendingError';
  }
}
