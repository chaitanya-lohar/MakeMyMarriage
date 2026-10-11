import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, mongo, trusted, Types } from 'mongoose';
import { sessionOf, type Transaction } from '../../../../infrastructure/database/transaction.js';
import {
  DeliveryStatus,
  type Invitation,
  type InvitationSecret,
  type StoredToken,
} from '../../domain/types/invitation.js';
import {
  GuestInvitationRecord,
  type GuestInvitationDocument,
} from '../schemas/guest-invitation.schema.js';

/** Filters on ObjectId fields need ObjectIds: strings are not cast under sanitizeFilter. */
const oid = (id: string) => new Types.ObjectId(id);

const exists = (value: boolean) => trusted({ $exists: value });

/** Thrown when the guest already has an invitation (unique `guestId`). */
export class InvitationExistsError extends Error {
  constructor() {
    super('The guest already has an invitation');
  }
}

function toInvitation(document: GuestInvitationDocument): Invitation {
  return {
    id: document._id.toString(),
    weddingId: document.weddingId.toString(),
    guestId: document.guestId.toString(),
    deliveryStatus: document.deliveryStatus,
    // Revoking removes the token; regenerating issues a new one.
    isRevoked: document.tokenHash === undefined,
    tokenCreatedAt: document.tokenCreatedAt ?? null,
    lastSentAt: document.lastSentAt ?? null,
    firstOpenedAt: document.firstOpenedAt ?? null,
  };
}

function toSecret(document: GuestInvitationDocument): InvitationSecret | null {
  if (!document.tokenCiphertext || !document.tokenKeyVersion) return null;
  return {
    invitation: toInvitation(document),
    tokenCiphertext: document.tokenCiphertext,
    tokenKeyVersion: document.tokenKeyVersion,
  };
}

/** Data access for `guest_invitations`. Token forms are returned only as InvitationSecret. */
@Injectable()
export class GuestInvitationsRepository {
  constructor(
    @InjectModel(GuestInvitationRecord.name)
    private readonly invitations: Model<GuestInvitationRecord>,
  ) {}

  async create(
    weddingId: string,
    guestId: string,
    createdBy: string,
    token: StoredToken,
  ): Promise<Invitation> {
    try {
      const document = await this.invitations.create({
        weddingId: oid(weddingId),
        guestId: oid(guestId),
        ...token,
        tokenCreatedAt: new Date(),
        deliveryStatus: DeliveryStatus.Draft,
        createdBy: oid(createdBy),
      });
      return toInvitation(document);
    } catch (error) {
      if (error instanceof mongo.MongoServerError && error.code === 11000) {
        throw new InvitationExistsError();
      }
      throw error;
    }
  }

  async findForGuest(weddingId: string, guestId: string): Promise<Invitation | null> {
    if (!isValidObjectId(guestId)) return null;
    const document = await this.invitations.findOne({
      weddingId: oid(weddingId),
      guestId: oid(guestId),
    });
    return document ? toInvitation(document) : null;
  }

  /** The guest's invitation with its encrypted token, or null when missing or revoked. */
  async findSecretForGuest(weddingId: string, guestId: string): Promise<InvitationSecret | null> {
    if (!isValidObjectId(guestId)) return null;
    const document = await this.invitations.findOne({
      weddingId: oid(weddingId),
      guestId: oid(guestId),
      tokenHash: exists(true),
    });
    return document ? toSecret(document) : null;
  }

  async findSecretById(invitationId: string): Promise<InvitationSecret | null> {
    if (!isValidObjectId(invitationId)) return null;
    const document = await this.invitations.findOne({
      _id: oid(invitationId),
      tokenHash: exists(true),
    });
    return document ? toSecret(document) : null;
  }

  /** The invitation whose current token has this hash; revoked tokens have no hash. */
  async findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    const document = await this.invitations.findOne({ tokenHash });
    return document ? toInvitation(document) : null;
  }

  /**
   * Replaces the token — the old one stops working at once — and, as regeneration requires,
   * sets the current delivery status back to DRAFT and clears any revocation (0020).
   */
  async replaceToken(
    weddingId: string,
    guestId: string,
    token: StoredToken,
  ): Promise<Invitation | null> {
    const document = await this.invitations.findOneAndUpdate(
      { weddingId: oid(weddingId), guestId: oid(guestId) },
      {
        $set: { ...token, tokenCreatedAt: new Date(), deliveryStatus: DeliveryStatus.Draft },
        $unset: { revokedAt: '' },
      },
      { returnDocument: 'after' },
    );
    return document ? toInvitation(document) : null;
  }

  /**
   * Revokes the token by removing both stored forms; the delivery status is unchanged (0020).
   * Returns the invitation and whether this call revoked it (false if already revoked).
   */
  async revoke(
    weddingId: string,
    guestId: string,
    transaction?: Transaction,
  ): Promise<{ invitation: Invitation; revoked: boolean } | null> {
    const session = sessionOf(transaction);
    const document = await this.invitations.findOneAndUpdate(
      { weddingId: oid(weddingId), guestId: oid(guestId), tokenHash: exists(true) },
      {
        $set: { revokedAt: new Date() },
        $unset: { tokenHash: '', tokenCiphertext: '', tokenKeyVersion: '' },
      },
      { returnDocument: 'after', session },
    );
    if (document) return { invitation: toInvitation(document), revoked: true };
    const current = await this.invitations
      .findOne({ weddingId: oid(weddingId), guestId: oid(guestId) })
      .session(session ?? null);
    return current ? { invitation: toInvitation(current), revoked: false } : null;
  }

  /** The invitations of these guests, by guest ID. */
  async findForGuests(weddingId: string, guestIds: string[]): Promise<Map<string, Invitation>> {
    if (guestIds.length === 0) return new Map();
    const documents = await this.invitations.find({
      weddingId: oid(weddingId),
      guestId: trusted({ $in: guestIds.map(oid) }),
    });
    return new Map(
      documents.map((document) => [document.guestId.toString(), toInvitation(document)]),
    );
  }

  /** Records an open: keeps the first-open time and moves the last-open time. */
  async recordOpen(invitationId: string, at: Date): Promise<void> {
    await this.invitations.updateOne(
      { _id: oid(invitationId) },
      { $min: { firstOpenedAt: at }, $max: { lastOpenedAt: at } },
    );
  }

  /** The current delivery status follows the latest attempt (0018 #8). */
  async applyAttempt(
    invitationId: string,
    status: DeliveryStatus,
    sentAt: Date | null,
    transaction?: Transaction,
  ): Promise<void> {
    await this.invitations.updateOne(
      { _id: oid(invitationId) },
      { $set: { deliveryStatus: status, ...(sentAt ? { lastSentAt: sentAt } : {}) } },
      { session: sessionOf(transaction) },
    );
  }
}
