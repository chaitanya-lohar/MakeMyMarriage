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

  /** The user's active memberships, oldest first. */
  async listActiveForUser(userId: string): Promise<Membership[]> {
    if (!isValidObjectId(userId)) return [];
    const documents = await this.memberships
      .find({ userId: new Types.ObjectId(userId), status: MembershipStatus.Active })
      .sort({ createdAt: 1 });
    return documents.map(toMembership);
  }
}
