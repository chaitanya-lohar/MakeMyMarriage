import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { sessionOf, type Transaction } from '../../../../infrastructure/database/transaction.js';
import {
  OwnershipTransferPendingError,
  OwnershipTransferStatus,
  type OwnershipTransfer,
  type TransferCancelReason,
} from '../../domain/types/ownership-transfer.js';
import {
  OwnershipTransferRecord,
  type OwnershipTransferDocument,
} from '../schemas/ownership-transfer.schema.js';

const DUPLICATE_KEY = 11000;

function toTransfer(document: OwnershipTransferDocument): OwnershipTransfer {
  return {
    id: document._id.toString(),
    weddingId: document.weddingId.toString(),
    fromMembershipId: document.fromMembershipId.toString(),
    toMembershipId: document.toMembershipId.toString(),
    ownerSeat: document.ownerSeat,
    status: document.status,
    requestedBy: document.requestedBy.toString(),
    ...(document.respondedAt && { respondedAt: document.respondedAt }),
    ...(document.cancelledReason && { cancelledReason: document.cancelledReason }),
    createdAt: document.createdAt,
  };
}

/** Data access for `ownership_transfers` (Database Design §7.6). */
@Injectable()
export class OwnershipTransfersRepository {
  constructor(
    @InjectModel(OwnershipTransferRecord.name)
    private readonly transfers: Model<OwnershipTransferRecord>,
  ) {}

  /** Throws OwnershipTransferPendingError while another offer is pending. */
  async create(
    offer: Pick<
      OwnershipTransfer,
      'weddingId' | 'fromMembershipId' | 'toMembershipId' | 'ownerSeat' | 'requestedBy'
    >,
  ): Promise<OwnershipTransfer> {
    try {
      const document = await this.transfers.create({
        weddingId: new Types.ObjectId(offer.weddingId),
        fromMembershipId: new Types.ObjectId(offer.fromMembershipId),
        toMembershipId: new Types.ObjectId(offer.toMembershipId),
        ownerSeat: offer.ownerSeat,
        status: OwnershipTransferStatus.Pending,
        requestedBy: new Types.ObjectId(offer.requestedBy),
      });
      return toTransfer(document);
    } catch (error) {
      if ((error as { code?: number }).code === DUPLICATE_KEY) {
        throw new OwnershipTransferPendingError();
      }
      throw error;
    }
  }

  async findInWedding(weddingId: string, id: string): Promise<OwnershipTransfer | null> {
    if (!isValidObjectId(weddingId) || !isValidObjectId(id)) return null;
    const document = await this.transfers.findOne({
      _id: new Types.ObjectId(id),
      weddingId: new Types.ObjectId(weddingId),
    });
    return document ? toTransfer(document) : null;
  }

  /** The wedding's offers, newest first — or only those made to `toMembershipId`. */
  async list(weddingId: string, toMembershipId?: string): Promise<OwnershipTransfer[]> {
    const documents = await this.transfers
      .find({
        weddingId: new Types.ObjectId(weddingId),
        ...(toMembershipId && { toMembershipId: new Types.ObjectId(toMembershipId) }),
      })
      .sort({ createdAt: -1, _id: -1 });
    return documents.map(toTransfer);
  }

  /** PENDING → `status`; null when the offer is no longer pending. */
  async close(
    weddingId: string,
    id: string,
    status: Exclude<OwnershipTransferStatus, 'PENDING'>,
    now: Date,
    options: { reason?: TransferCancelReason; transaction?: Transaction } = {},
  ): Promise<OwnershipTransfer | null> {
    const document = await this.transfers.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        weddingId: new Types.ObjectId(weddingId),
        status: OwnershipTransferStatus.Pending,
      },
      {
        $set: {
          status,
          respondedAt: now,
          ...(options.reason && { cancelledReason: options.reason }),
        },
      },
      { new: true, session: sessionOf(options.transaction) },
    );
    return document ? toTransfer(document) : null;
  }

  /** The pending offer that involves a membership, as giver or recipient, if any. */
  async findPendingFor(
    weddingId: string,
    membershipId: string,
    transaction?: Transaction,
  ): Promise<OwnershipTransfer | null> {
    const id = new Types.ObjectId(membershipId);
    const document = await this.transfers
      .findOne({
        weddingId: new Types.ObjectId(weddingId),
        status: OwnershipTransferStatus.Pending,
        $or: [{ fromMembershipId: id }, { toMembershipId: id }],
      })
      .session(sessionOf(transaction) ?? null);
    return document ? toTransfer(document) : null;
  }
}
