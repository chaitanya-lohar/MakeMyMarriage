import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { sessionOf, type Transaction } from '../../../../infrastructure/database/transaction.js';
import { MemberType, MembershipRole, MembershipStatus } from '../../domain/enums/membership.js';
import { OwnerMembershipExistsError, type Membership } from '../../domain/types/membership.js';
import {
  WeddingMembershipRecord,
  type WeddingMembershipDocument,
} from '../schemas/wedding-membership.schema.js';

const DUPLICATE_KEY = 11000;

function toMembership(document: WeddingMembershipDocument): Membership {
  return {
    id: document._id.toString(),
    weddingId: document.weddingId.toString(),
    userId: document.userId.toString(),
    memberType: document.memberType,
    role: document.role,
    status: document.status,
    ...(document.ownerSeat !== undefined && { ownerSeat: document.ownerSeat }),
    permissionOverrides: (document.permissionOverrides ?? []).map(({ module, action, effect }) => ({
      module,
      action,
      effect,
    })),
    ...(document.acceptedAt && { acceptedAt: document.acceptedAt }),
    ...(document.invitationId && { invitationId: document.invitationId.toString() }),
    ...(document.invitedBy && { invitedBy: document.invitedBy.toString() }),
    ...(document.invitedAt && { invitedAt: document.invitedAt }),
    ...(document.revokedAt && { revokedAt: document.revokedAt }),
    ...(document.revokedBy && { revokedBy: document.revokedBy.toString() }),
  };
}

/** Data access for `wedding_memberships`. */
@Injectable()
export class WeddingMembershipsRepository {
  constructor(
    @InjectModel(WeddingMembershipRecord.name)
    private readonly memberships: Model<WeddingMembershipRecord>,
  ) {}

  async createOwner(
    weddingId: string,
    userId: string,
    transaction?: Transaction,
  ): Promise<Membership> {
    try {
      const [document] = await this.memberships.create(
        [
          {
            weddingId: new Types.ObjectId(weddingId),
            userId: new Types.ObjectId(userId),
            memberType: MemberType.Owner,
            role: MembershipRole.Owner,
            status: MembershipStatus.Active,
            // The creator takes the first owner seat (Database Design §7.2, P10-5).
            ownerSeat: 1,
            acceptedAt: new Date(),
          },
        ],
        { session: sessionOf(transaction) },
      );
      return toMembership(document as WeddingMembershipDocument);
    } catch (error) {
      if ((error as { code?: number }).code === DUPLICATE_KEY) {
        throw new OwnerMembershipExistsError();
      }
      throw error;
    }
  }

  async hasOwnerMembership(userId: string): Promise<boolean> {
    if (!isValidObjectId(userId)) return false;
    const count = await this.memberships.countDocuments({
      userId: new Types.ObjectId(userId),
      memberType: MemberType.Owner,
    });
    return count > 0;
  }

  async findActive(userId: string, weddingId: string): Promise<Membership | null> {
    if (!isValidObjectId(userId) || !isValidObjectId(weddingId)) return null;
    const document = await this.memberships.findOne({
      userId: new Types.ObjectId(userId),
      weddingId: new Types.ObjectId(weddingId),
      status: MembershipStatus.Active,
    });
    return document ? toMembership(document) : null;
  }

  /** A wedding's memberships with the given status, in no particular order. */
  async listForWedding(weddingId: string, status: MembershipStatus): Promise<Membership[]> {
    if (!isValidObjectId(weddingId)) return [];
    const documents = await this.memberships.find({
      weddingId: new Types.ObjectId(weddingId),
      status,
    });
    return documents.map(toMembership);
  }

  /** One membership of the wedding, whatever its status, or null. */
  async findInWedding(weddingId: string, membershipId: string): Promise<Membership | null> {
    if (!isValidObjectId(weddingId) || !isValidObjectId(membershipId)) return null;
    const document = await this.memberships.findOne({
      _id: new Types.ObjectId(membershipId),
      weddingId: new Types.ObjectId(weddingId),
    });
    return document ? toMembership(document) : null;
  }

  /**
   * Sets an ACTIVE non-owner membership's role and overrides; null when it is no longer one
   * (Database Design §7.2: owner rows never change here).
   */
  async updateAccess(
    weddingId: string,
    membershipId: string,
    access: Pick<Membership, 'role' | 'permissionOverrides'>,
  ): Promise<Membership | null> {
    if (!isValidObjectId(weddingId) || !isValidObjectId(membershipId)) return null;
    const document = await this.memberships.findOneAndUpdate(
      {
        _id: new Types.ObjectId(membershipId),
        weddingId: new Types.ObjectId(weddingId),
        memberType: MemberType.Member,
        status: MembershipStatus.Active,
      },
      access.permissionOverrides.length > 0
        ? { $set: { role: access.role, permissionOverrides: access.permissionOverrides } }
        : { $set: { role: access.role }, $unset: { permissionOverrides: 1 } },
      { new: true },
    );
    return document ? toMembership(document) : null;
  }

  /** Revokes an ACTIVE non-owner membership; null when it is no longer one. Deletes nothing. */
  async revoke(
    weddingId: string,
    membershipId: string,
    revokedBy: string,
    now: Date,
  ): Promise<Membership | null> {
    if (!isValidObjectId(weddingId) || !isValidObjectId(membershipId)) return null;
    const document = await this.memberships.findOneAndUpdate(
      {
        _id: new Types.ObjectId(membershipId),
        weddingId: new Types.ObjectId(weddingId),
        memberType: MemberType.Member,
        status: MembershipStatus.Active,
      },
      {
        $set: {
          status: MembershipStatus.Revoked,
          revokedAt: now,
          revokedBy: new Types.ObjectId(revokedBy),
        },
      },
      { new: true },
    );
    return document ? toMembership(document) : null;
  }

  /** The user's active memberships, oldest first. */
  async listActiveForUser(userId: string): Promise<Membership[]> {
    if (!isValidObjectId(userId)) return [];
    const documents = await this.memberships
      .find({ userId: new Types.ObjectId(userId), status: MembershipStatus.Active })
      .sort({ createdAt: 1 });
    return documents.map(toMembership);
  }
}
