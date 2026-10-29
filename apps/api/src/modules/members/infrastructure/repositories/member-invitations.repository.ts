import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, trusted, Types } from 'mongoose';
import { sessionOf, type Transaction } from '../../../../infrastructure/database/transaction.js';
import {
  afterTimeCursor,
  decodeTimeCursor,
  encodeTimeCursor,
} from '../../../../infrastructure/database/time-cursor.js';
import {
  MemberInvitationPendingError,
  MemberInvitationStatus,
  type MemberInvitation,
  type MemberInvitationPage,
  type NewMemberInvitation,
} from '../../domain/types/member-invitation.js';
import {
  MemberInvitationRecord,
  type MemberInvitationDocument,
} from '../schemas/member-invitation.schema.js';

const DUPLICATE_KEY = 11000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** At most three resends in any rolling 24 hours (0034 R2). */
export const RESENDS_PER_DAY = 3;

function toInvitation(document: MemberInvitationDocument): MemberInvitation {
  return {
    id: document._id.toString(),
    weddingId: document.weddingId.toString(),
    email: document.email,
    role: document.role,
    permissionOverrides: (document.permissionOverrides ?? []).map(({ module, action, effect }) => ({
      module,
      action,
      effect,
    })),
    message: document.message ?? null,
    status: document.status,
    expiresAt: document.expiresAt,
    invitedBy: document.invitedBy.toString(),
    ...(document.acceptedByUserId && { acceptedByUserId: document.acceptedByUserId.toString() }),
    ...(document.membershipId && { membershipId: document.membershipId.toString() }),
    ...(document.respondedAt && { respondedAt: document.respondedAt }),
    ...(document.revokedAt && { revokedAt: document.revokedAt }),
    ...(document.lastSentAt && { lastSentAt: document.lastSentAt }),
    resentAt: document.resentAt ?? [],
    createdAt: document.createdAt,
  };
}

/** A pending invitation whose current token is still valid at `now`. */
const live = (now: Date) => ({
  status: MemberInvitationStatus.Pending,
  expiresAt: trusted({ $gt: now }),
});

/** Data access for `member_invitations` (Database Design §7.5). */
@Injectable()
export class MemberInvitationsRepository {
  constructor(
    @InjectModel(MemberInvitationRecord.name)
    private readonly invitations: Model<MemberInvitationRecord>,
  ) {}

  /** Throws MemberInvitationPendingError while a PENDING one exists for the email. */
  async create(invitation: NewMemberInvitation): Promise<MemberInvitation> {
    try {
      const document = await this.invitations.create({
        weddingId: new Types.ObjectId(invitation.weddingId),
        email: invitation.email,
        role: invitation.role,
        ...(invitation.permissionOverrides.length > 0 && {
          permissionOverrides: invitation.permissionOverrides,
        }),
        ...(invitation.message && { message: invitation.message }),
        status: MemberInvitationStatus.Pending,
        tokenHash: invitation.tokenHash,
        expiresAt: invitation.expiresAt,
        invitedBy: new Types.ObjectId(invitation.invitedBy),
        lastSentAt: invitation.now,
      });
      return toInvitation(document);
    } catch (error) {
      if ((error as { code?: number }).code === DUPLICATE_KEY) {
        throw new MemberInvitationPendingError();
      }
      throw error;
    }
  }

  async findInWedding(weddingId: string, id: string): Promise<MemberInvitation | null> {
    if (!isValidObjectId(weddingId) || !isValidObjectId(id)) return null;
    const document = await this.invitations.findOne({
      _id: new Types.ObjectId(id),
      weddingId: new Types.ObjectId(weddingId),
    });
    return document ? toInvitation(document) : null;
  }

  async findPendingByEmail(weddingId: string, email: string): Promise<MemberInvitation | null> {
    const document = await this.invitations.findOne({
      weddingId: new Types.ObjectId(weddingId),
      email,
      status: MemberInvitationStatus.Pending,
    });
    return document ? toInvitation(document) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<MemberInvitation | null> {
    const document = await this.invitations.findOne({ tokenHash });
    return document ? toInvitation(document) : null;
  }

  /** Pending invitations of the wedding past `expiresAt` (to be written EXPIRED). */
  async listStale(weddingId: string, now: Date): Promise<MemberInvitation[]> {
    const documents = await this.invitations.find({
      weddingId: new Types.ObjectId(weddingId),
      status: MemberInvitationStatus.Pending,
      expiresAt: trusted({ $lte: now }),
    });
    return documents.map(toInvitation);
  }

  /** PENDING past `expiresAt` → EXPIRED; false when another request already wrote it. */
  async markExpired(id: string, now: Date): Promise<boolean> {
    const result = await this.invitations.updateOne(
      {
        _id: new Types.ObjectId(id),
        status: MemberInvitationStatus.Pending,
        expiresAt: trusted({ $lte: now }),
      },
      { $set: { status: MemberInvitationStatus.Expired, expiredAt: now } },
    );
    return result.modifiedCount === 1;
  }

  /** The wedding's invitations with `status`, newest first, a page at a time. */
  async list(
    weddingId: string,
    query: { status: MemberInvitationStatus; limit: number; cursor?: string },
  ): Promise<MemberInvitationPage | null> {
    const conditions: Record<string, unknown>[] = [
      { weddingId: new Types.ObjectId(weddingId), status: query.status },
    ];
    if (query.cursor) {
      const position = decodeTimeCursor(query.cursor);
      if (!position) return null;
      conditions.push(afterTimeCursor(position));
    }
    const documents = await this.invitations
      .find({ $and: conditions })
      .sort({ createdAt: -1, _id: -1 })
      .limit(query.limit + 1);
    const invitations = documents.slice(0, query.limit).map(toInvitation);
    const last = invitations.at(-1);
    return {
      invitations,
      nextCursor:
        documents.length > query.limit && last
          ? encodeTimeCursor({ createdAt: last.createdAt, id: last.id })
          : null,
    };
  }

  /**
   * Issues a new token, resets the expiry and records the resend — only while the
   * invitation is live and fewer than three resends fall in the last 24 hours (0034 R2,
   * Database Design §7.5). One conditional update, so concurrent resends cannot exceed it.
   */
  async resend(
    id: string,
    tokenHash: string,
    expiresAt: Date,
    now: Date,
  ): Promise<MemberInvitation | null> {
    const document = await this.invitations.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        ...live(now),
        $or: [
          { [`resentAt.${RESENDS_PER_DAY - 1}`]: trusted({ $exists: false }) },
          { 'resentAt.0': trusted({ $lte: new Date(now.getTime() - DAY_MS) }) },
        ],
      },
      {
        $set: { tokenHash, expiresAt, lastSentAt: now },
        $push: { resentAt: { $each: [now], $slice: -RESENDS_PER_DAY } },
      },
      { new: true },
    );
    return document ? toInvitation(document) : null;
  }

  async revoke(id: string, revokedBy: string, now: Date): Promise<MemberInvitation | null> {
    const document = await this.invitations.findOneAndUpdate(
      { _id: new Types.ObjectId(id), ...live(now) },
      {
        $set: {
          status: MemberInvitationStatus.Revoked,
          revokedAt: now,
          revokedBy: new Types.ObjectId(revokedBy),
        },
      },
      { new: true },
    );
    return document ? toInvitation(document) : null;
  }

  /** Live → ACCEPTED, in the acceptance transaction; null when no longer live. */
  async accept(
    tokenHash: string,
    acceptedBy: { userId: string; membershipId: string },
    now: Date,
    transaction: Transaction,
  ): Promise<MemberInvitation | null> {
    const document = await this.invitations.findOneAndUpdate(
      { tokenHash, ...live(now) },
      {
        $set: {
          status: MemberInvitationStatus.Accepted,
          acceptedByUserId: new Types.ObjectId(acceptedBy.userId),
          membershipId: new Types.ObjectId(acceptedBy.membershipId),
          respondedAt: now,
        },
      },
      { new: true, session: sessionOf(transaction) },
    );
    return document ? toInvitation(document) : null;
  }

  /** Live → DECLINED; null when no longer live. */
  async decline(tokenHash: string, now: Date): Promise<MemberInvitation | null> {
    const document = await this.invitations.findOneAndUpdate(
      { tokenHash, ...live(now) },
      { $set: { status: MemberInvitationStatus.Declined, respondedAt: now } },
      { new: true },
    );
    return document ? toInvitation(document) : null;
  }
}
