import { Injectable } from '@nestjs/common';
import { ValidationFailedException } from '../../../../common/errors/validation-failed.exception.js';
import { TransactionRunner } from '../../../../infrastructure/database/transaction.js';
import { AuditAction, AuditService } from '../../../audit/index.js';
import { UsersService } from '../../../users/index.js';
import {
  MemberType,
  MembershipsService,
  MembershipStatus,
  OwnerMembershipExistsError,
  permissionDenied,
  type Membership,
} from '../../../workspace/index.js';
import type { MemberChangeCaller } from '../../domain/rules/member-authority.js';
import {
  OwnershipTransferPendingError,
  OwnershipTransferStatus,
  TransferCancelReason,
  type OwnershipTransfer,
} from '../../domain/types/ownership-transfer.js';
import { OwnershipTransfersRepository } from '../../infrastructure/repositories/ownership-transfers.repository.js';
import { InvitationsErrors } from '../invitations-errors.js';
import { MembersErrors } from '../members-errors.js';

const TRANSFER = 'ownership_transfer';
const OWNER_ONLY = 'OWNER_ONLY';

/** An offer with the giver's and recipient's names (API Design §7.1). */
export interface TransferView {
  transfer: OwnershipTransfer;
  fromName: string;
  toName: string;
}

/** A condition of the acceptance transaction no longer held. */
class TransferChangedError extends Error {}

/**
 * Ownership-seat transfer (Database Design §7.6, P10-5, 0034 R3): an owner offers their own
 * seat to an ACTIVE member, who accepts or declines; the giver may cancel. Offers never
 * expire. Acceptance is one transaction, so ownership is never half-moved.
 */
@Injectable()
export class OwnershipTransfersService {
  constructor(
    private readonly transfers: OwnershipTransfersRepository,
    private readonly memberships: MembershipsService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly transactions: TransactionRunner,
  ) {}

  /** Owners see every offer of the wedding; a member sees only offers made to them. */
  async list(weddingId: string, caller: MemberChangeCaller): Promise<TransferView[]> {
    const transfers = await this.transfers.list(
      weddingId,
      caller.permissions.isOwner ? undefined : caller.membership.id,
    );
    return this.views(weddingId, transfers);
  }

  async offer(
    weddingId: string,
    caller: MemberChangeCaller,
    toMembershipId: string,
  ): Promise<TransferView> {
    const giver = caller.membership;
    if (giver.memberType !== MemberType.Owner || giver.ownerSeat === undefined) {
      await this.denied(weddingId, caller, 'OFFER');
      throw permissionDenied(OWNER_ONLY);
    }
    const recipient = await this.memberships.findInWedding(weddingId, toMembershipId);
    if (!recipient || recipient.status !== MembershipStatus.Active) throw MembersErrors.notFound();
    if (recipient.memberType === MemberType.Owner) {
      throw new ValidationFailedException({ toMembershipId: ['This member is already an owner.'] });
    }
    if (await this.memberships.ownsAWedding(recipient.userId)) {
      throw InvitationsErrors.weddingAlreadyOwned();
    }
    let transfer: OwnershipTransfer;
    try {
      transfer = await this.transfers.create({
        weddingId,
        fromMembershipId: giver.id,
        toMembershipId: recipient.id,
        ownerSeat: giver.ownerSeat,
        requestedBy: giver.userId,
      });
    } catch (error) {
      if (error instanceof OwnershipTransferPendingError) {
        throw InvitationsErrors.transferAlreadyPending();
      }
      throw error;
    }
    await this.record(transfer, giver.userId, AuditAction.OwnershipTransferOffered);
    const [view] = await this.views(weddingId, [transfer]);
    return view!;
  }

  /**
   * The recipient accepts (Database Design §7.6), in order so the seat index never sees two
   * holders: the offer ACCEPTED, the giver an ADMIN member without seat or overrides, the
   * recipient OWNER on that seat, the audit entry. Any failed condition applies nothing.
   */
  async accept(
    weddingId: string,
    caller: MemberChangeCaller,
    transferId: string,
    now: Date = new Date(),
  ): Promise<{ giver: Membership; recipient: Membership }> {
    const transfer = await this.pendingFor(weddingId, transferId, caller, 'recipient');
    if (await this.memberships.ownsAWedding(caller.membership.userId)) {
      throw InvitationsErrors.weddingAlreadyOwned();
    }
    try {
      return await this.transactions.run(async (transaction) => {
        const accepted = await this.transfers.close(
          weddingId,
          transfer.id,
          OwnershipTransferStatus.Accepted,
          now,
          { transaction },
        );
        if (!accepted) throw new TransferChangedError();
        const giver = await this.memberships.demoteOwner(
          weddingId,
          transfer.fromMembershipId,
          transfer.ownerSeat,
          transaction,
        );
        if (!giver) throw new TransferChangedError();
        const recipient = await this.memberships.promoteToOwner(
          weddingId,
          transfer.toMembershipId,
          transfer.ownerSeat,
          transaction,
        );
        if (!recipient) throw new TransferChangedError();
        await this.audit.record(
          {
            weddingId,
            actorUserId: caller.membership.userId,
            action: AuditAction.OwnershipTransferred,
            resourceType: TRANSFER,
            resourceId: transfer.id,
            metadata: {
              fromMembershipId: giver.id,
              fromUserId: giver.userId,
              toMembershipId: recipient.id,
              toUserId: recipient.userId,
              ownerSeat: transfer.ownerSeat,
              outcome: 'SUCCEEDED',
            },
          },
          transaction,
        );
        return { giver, recipient };
      });
    } catch (error) {
      if (error instanceof OwnerMembershipExistsError) {
        throw InvitationsErrors.weddingAlreadyOwned();
      }
      if (error instanceof TransferChangedError) {
        await this.cancel(weddingId, transfer.id, TransferCancelReason.MembershipChanged, now);
        throw InvitationsErrors.transferNotPending();
      }
      throw error;
    }
  }

  async decline(
    weddingId: string,
    caller: MemberChangeCaller,
    transferId: string,
    now: Date = new Date(),
  ): Promise<void> {
    const transfer = await this.pendingFor(weddingId, transferId, caller, 'recipient');
    const declined = await this.transfers.close(
      weddingId,
      transfer.id,
      OwnershipTransferStatus.Declined,
      now,
    );
    if (!declined) throw InvitationsErrors.transferNotPending();
    await this.record(declined, caller.membership.userId, AuditAction.OwnershipTransferDeclined);
  }

  /** The giving owner withdraws the offer (BY_OWNER). */
  async cancelByOwner(
    weddingId: string,
    caller: MemberChangeCaller,
    transferId: string,
    now: Date = new Date(),
  ): Promise<void> {
    const transfer = await this.pendingFor(weddingId, transferId, caller, 'giver');
    const cancelled = await this.cancel(
      weddingId,
      transfer.id,
      TransferCancelReason.ByOwner,
      now,
      caller.membership.userId,
    );
    if (!cancelled) throw InvitationsErrors.transferNotPending();
  }

  /** Cancels the pending offer a membership takes part in, once it stops being eligible. */
  async cancelForMembership(
    weddingId: string,
    membershipId: string,
    actorUserId: string,
    now: Date = new Date(),
  ): Promise<void> {
    const pending = await this.transfers.findPendingFor(weddingId, membershipId);
    if (pending) {
      await this.cancel(
        weddingId,
        pending.id,
        TransferCancelReason.MembershipChanged,
        now,
        actorUserId,
      );
    }
  }

  private async cancel(
    weddingId: string,
    transferId: string,
    reason: TransferCancelReason,
    now: Date,
    actorUserId?: string,
  ): Promise<OwnershipTransfer | null> {
    const cancelled = await this.transfers.close(
      weddingId,
      transferId,
      OwnershipTransferStatus.Cancelled,
      now,
      { reason },
    );
    if (cancelled) {
      await this.record(cancelled, actorUserId, AuditAction.OwnershipTransferCancelled, {
        reason,
      });
    }
    return cancelled;
  }

  /** A pending offer of the wedding, answerable only by its recipient or its giver. */
  private async pendingFor(
    weddingId: string,
    transferId: string,
    caller: MemberChangeCaller,
    side: 'recipient' | 'giver',
  ): Promise<OwnershipTransfer> {
    const transfer = await this.transfers.findInWedding(weddingId, transferId);
    if (!transfer) throw InvitationsErrors.transferNotFound();
    const party = side === 'recipient' ? transfer.toMembershipId : transfer.fromMembershipId;
    if (party !== caller.membership.id) throw permissionDenied();
    if (transfer.status !== OwnershipTransferStatus.Pending) {
      throw InvitationsErrors.transferNotPending();
    }
    return transfer;
  }

  private async views(weddingId: string, transfers: OwnershipTransfer[]): Promise<TransferView[]> {
    const ids = [...new Set(transfers.flatMap((t) => [t.fromMembershipId, t.toMembershipId]))];
    const memberships = (
      await Promise.all(ids.map((id) => this.memberships.findInWedding(weddingId, id)))
    ).filter((membership): membership is Membership => membership !== null);
    const users = await this.users.findManyByIds(memberships.map((m) => m.userId));
    const userNames = new Map(users.map((user) => [user.id, user.displayName]));
    const names = new Map(memberships.map((m) => [m.id, userNames.get(m.userId) ?? '']));
    return transfers.map((transfer) => ({
      transfer,
      fromName: names.get(transfer.fromMembershipId) ?? '',
      toName: names.get(transfer.toMembershipId) ?? '',
    }));
  }

  private record(
    transfer: OwnershipTransfer,
    actorUserId: string | undefined,
    action: AuditAction,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    return this.audit.record({
      weddingId: transfer.weddingId,
      ...(actorUserId && { actorUserId }),
      action,
      resourceType: TRANSFER,
      resourceId: transfer.id,
      metadata: {
        fromMembershipId: transfer.fromMembershipId,
        toMembershipId: transfer.toMembershipId,
        ownerSeat: transfer.ownerSeat,
        ...metadata,
        outcome: 'SUCCEEDED',
      },
    });
  }

  private denied(weddingId: string, caller: MemberChangeCaller, operation: string) {
    return this.audit.record({
      weddingId,
      actorUserId: caller.membership.userId,
      action: AuditAction.PermissionDenied,
      resourceType: 'wedding_membership',
      resourceId: caller.membership.id,
      metadata: { operation: `OWNERSHIP_${operation}`, reason: OWNER_ONLY, outcome: 'DENIED' },
    });
  }
}
