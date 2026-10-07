import { Injectable } from '@nestjs/common';
import type { Transaction } from '../../../../infrastructure/database/transaction.js';
import type { Membership } from '../../domain/types/membership.js';
import { WeddingMembershipsRepository } from '../../infrastructure/repositories/wedding-memberships.repository.js';

/** Membership and access context for weddings — the workspace module's public API. */
@Injectable()
export class MembershipsService {
  constructor(private readonly memberships: WeddingMembershipsRepository) {}

  /** Whether the user already owns a wedding (0010 #18, decision 0012). */
  ownsAWedding(userId: string): Promise<boolean> {
    return this.memberships.hasOwnerMembership(userId);
  }

  /**
   * Makes the user the OWNER of a new wedding. Throws OwnerMembershipExistsError when the
   * user already owns one, even if a concurrent request created it first.
   */
  addOwner(weddingId: string, userId: string, transaction?: Transaction): Promise<Membership> {
    return this.memberships.createOwner(weddingId, userId, transaction);
  }

  /** The user's ACTIVE membership of a wedding, or null — the basis of every access check. */
  findActive(userId: string, weddingId: string): Promise<Membership | null> {
    return this.memberships.findActive(userId, weddingId);
  }

  /** IDs of the weddings in which the user has an ACTIVE membership, oldest first. */
  async activeWeddingIds(userId: string): Promise<string[]> {
    const memberships = await this.memberships.listActiveForUser(userId);
    return memberships.map((membership) => membership.weddingId);
  }
}
