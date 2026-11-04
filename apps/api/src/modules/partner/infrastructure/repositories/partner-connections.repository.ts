import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, trusted, Types } from 'mongoose';
import { sessionOf, type Transaction } from '../../../../infrastructure/database/transaction.js';
import { PARTNER_RESENDS_PER_DAY } from '../../domain/rules/partner-rules.js';
import {
  PartnerConnectionOpenError,
  PartnerConnectionStatus,
  type NewPartnerConnection,
  type PartnerConnection,
} from '../../domain/types/partner-connection.js';
import {
  PartnerConnectionRecord,
  type PartnerConnectionDocument,
} from '../schemas/partner-connection.schema.js';

const DUPLICATE_KEY = 11000;
const DAY_MS = 24 * 60 * 60 * 1000;

function toConnection(document: PartnerConnectionDocument): PartnerConnection {
  return {
    id: document._id.toString(),
    weddingId: document.weddingId.toString(),
    status: document.status,
    inviteeEmail: document.inviteeEmail,
    expiresAt: document.expiresAt,
    lastSentAt: document.lastSentAt,
    emailSent: document.emailSent,
    resentAt: document.resentAt ?? [],
    inviterUserId: document.inviterUserId.toString(),
    ...(document.inviteeUserId && { inviteeUserId: document.inviteeUserId.toString() }),
    ...(document.membershipId && { membershipId: document.membershipId.toString() }),
    ...(document.acceptedAt && { acceptedAt: document.acceptedAt }),
    ...(document.respondedAt && { respondedAt: document.respondedAt }),
    createdAt: document.createdAt,
  };
}

/** A pending invitation whose current token is still valid at `now`. */
const live = (now: Date) => ({
  status: PartnerConnectionStatus.Pending,
  expiresAt: trusted({ $gt: now }),
});

/** Leaves the open set: the status changes and `open` is removed. */
const closing = (status: PartnerConnectionStatus, fields: Record<string, unknown>) => ({
  $set: { status, ...fields },
  $unset: { open: 1 },
});

/** Data access for `partner_connections` (Database Design §7.3). */
@Injectable()
export class PartnerConnectionsRepository {
  constructor(
    @InjectModel(PartnerConnectionRecord.name)
    private readonly connections: Model<PartnerConnectionRecord>,
  ) {}

  /** Throws PartnerConnectionOpenError while the wedding has a pending or active one. */
  async create(connection: NewPartnerConnection): Promise<PartnerConnection> {
    try {
      const document = await this.connections.create({
        weddingId: new Types.ObjectId(connection.weddingId),
        status: PartnerConnectionStatus.Pending,
        open: true,
        inviteeEmail: connection.inviteeEmail,
        tokenHash: connection.tokenHash,
        expiresAt: connection.expiresAt,
        lastSentAt: connection.now,
        emailSent: false,
        inviterUserId: new Types.ObjectId(connection.inviterUserId),
      });
      return toConnection(document);
    } catch (error) {
      if ((error as { code?: number }).code === DUPLICATE_KEY) {
        throw new PartnerConnectionOpenError();
      }
      throw error;
    }
  }

  /** The wedding's pending or active record, if any. */
  async findOpen(weddingId: string, transaction?: Transaction): Promise<PartnerConnection | null> {
    if (!isValidObjectId(weddingId)) return null;
    const document = await this.connections
      .findOne({ weddingId: new Types.ObjectId(weddingId), open: true })
      .session(sessionOf(transaction) ?? null);
    return document ? toConnection(document) : null;
  }

  /** The wedding's most recent record, whatever its status. */
  async findLatest(weddingId: string): Promise<PartnerConnection | null> {
    if (!isValidObjectId(weddingId)) return null;
    const document = await this.connections
      .findOne({ weddingId: new Types.ObjectId(weddingId) })
      .sort({ createdAt: -1, _id: -1 });
    return document ? toConnection(document) : null;
  }

  async findInWedding(weddingId: string, id: string): Promise<PartnerConnection | null> {
    if (!isValidObjectId(weddingId) || !isValidObjectId(id)) return null;
    const document = await this.connections.findOne({
      _id: new Types.ObjectId(id),
      weddingId: new Types.ObjectId(weddingId),
    });
    return document ? toConnection(document) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<PartnerConnection | null> {
    const document = await this.connections.findOne({ tokenHash });
    return document ? toConnection(document) : null;
  }

  async setEmailSent(id: string, emailSent: boolean): Promise<void> {
    await this.connections.updateOne({ _id: new Types.ObjectId(id) }, { $set: { emailSent } });
  }

  /** PENDING past `expiresAt` → EXPIRED; false when another request already wrote it. */
  async markExpired(id: string, now: Date): Promise<boolean> {
    const result = await this.connections.updateOne(
      {
        _id: new Types.ObjectId(id),
        status: PartnerConnectionStatus.Pending,
        expiresAt: trusted({ $lte: now }),
      },
      closing(PartnerConnectionStatus.Expired, { expiredAt: now }),
    );
    return result.modifiedCount === 1;
  }

  /**
   * A new token, the expiry reset and the resend recorded — only while live and fewer than
   * three resends fall in the last 24 hours. One conditional update.
   */
  async resend(
    id: string,
    tokenHash: string,
    expiresAt: Date,
    now: Date,
  ): Promise<PartnerConnection | null> {
    const document = await this.connections.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        ...live(now),
        $or: [
          { [`resentAt.${PARTNER_RESENDS_PER_DAY - 1}`]: trusted({ $exists: false }) },
          { 'resentAt.0': trusted({ $lte: new Date(now.getTime() - DAY_MS) }) },
        ],
      },
      {
        $set: { tokenHash, expiresAt, lastSentAt: now, emailSent: false },
        $push: { resentAt: { $each: [now], $slice: -PARTNER_RESENDS_PER_DAY } },
      },
      { returnDocument: 'after' },
    );
    return document ? toConnection(document) : null;
  }

  async revoke(id: string, revokedBy: string, now: Date): Promise<PartnerConnection | null> {
    const document = await this.connections.findOneAndUpdate(
      { _id: new Types.ObjectId(id), ...live(now) },
      closing(PartnerConnectionStatus.Revoked, {
        revokedAt: now,
        revokedBy: new Types.ObjectId(revokedBy),
      }),
      { returnDocument: 'after' },
    );
    return document ? toConnection(document) : null;
  }

  /** Acceptance, step 2: live → ACTIVE, still open; null when no longer live. */
  async accept(
    id: string,
    accepted: { userId: string; membershipId: string },
    now: Date,
    transaction: Transaction,
  ): Promise<PartnerConnection | null> {
    const document = await this.connections.findOneAndUpdate(
      { _id: new Types.ObjectId(id), ...live(now) },
      {
        $set: {
          status: PartnerConnectionStatus.Active,
          inviteeUserId: new Types.ObjectId(accepted.userId),
          membershipId: new Types.ObjectId(accepted.membershipId),
          acceptedAt: now,
          respondedAt: now,
        },
      },
      { returnDocument: 'after', session: sessionOf(transaction) },
    );
    return document ? toConnection(document) : null;
  }

  async decline(tokenHash: string, now: Date): Promise<PartnerConnection | null> {
    const document = await this.connections.findOneAndUpdate(
      { tokenHash, ...live(now) },
      closing(PartnerConnectionStatus.Declined, { respondedAt: now }),
      { returnDocument: 'after' },
    );
    return document ? toConnection(document) : null;
  }

  /**
   * Leaving (Database Design §7.3): the wedding's ACTIVE record → DISCONNECTED. Null when there
   * is none — a second owner from an ownership transfer has no record (D3). A PENDING record
   * cannot exist then: an invitation needs a one-owner wedding, leaving a two-owner one.
   */
  async disconnect(
    weddingId: string,
    userId: string,
    now: Date,
    transaction: Transaction,
  ): Promise<PartnerConnection | null> {
    const document = await this.connections.findOneAndUpdate(
      {
        weddingId: new Types.ObjectId(weddingId),
        open: true,
        status: PartnerConnectionStatus.Active,
      },
      closing(PartnerConnectionStatus.Disconnected, {
        disconnectedAt: now,
        disconnectedBy: new Types.ObjectId(userId),
      }),
      { returnDocument: 'after', session: sessionOf(transaction) },
    );
    return document ? toConnection(document) : null;
  }
}
