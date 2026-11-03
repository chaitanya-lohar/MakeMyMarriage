import { Injectable } from '@nestjs/common';
import type { Transaction } from '../../../../infrastructure/database/transaction.js';
import type { MembershipStatus } from '../../domain/enums/membership.js';
import type {
  InvitedAccess,
  Membership,
  OwnerSeat,
  PartnerAdmission,
} from '../../domain/types/membership.js';
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

  /** A wedding's memberships with the given status. */
  listForWedding(weddingId: string, status: MembershipStatus): Promise<Membership[]> {
    return this.memberships.listForWedding(weddingId, status);
  }

  /** The user's membership of the wedding, whatever its status, or null. */
  findForUser(weddingId: string, userId: string): Promise<Membership | null> {
    return this.memberships.findForUser(weddingId, userId);
  }

  /** One membership of the wedding, whatever its status, or null. */
  findInWedding(weddingId: string, membershipId: string): Promise<Membership | null> {
    return this.memberships.findInWedding(weddingId, membershipId);
  }

  /** Sets an ACTIVE non-owner member's role and overrides; null when no longer one. */
  updateAccess(
    weddingId: string,
    membershipId: string,
    access: Pick<Membership, 'role' | 'permissionOverrides'>,
  ): Promise<Membership | null> {
    return this.memberships.updateAccess(weddingId, membershipId, access);
  }

  /** Revokes an ACTIVE non-owner member; null when no longer one. Their data stays. */
  revoke(
    weddingId: string,
    membershipId: string,
    revokedBy: string,
    now: Date = new Date(),
  ): Promise<Membership | null> {
    return this.memberships.revoke(weddingId, membershipId, revokedBy, now);
  }

  /** The membership an accepted invitation gives: new, or a removed member's row reused. */
  admitFromInvitation(
    weddingId: string,
    userId: string,
    access: InvitedAccess,
    now: Date,
    transaction: Transaction,
  ): Promise<{ membership: Membership; reactivated: boolean } | null> {
    return this.memberships.admitFromInvitation(weddingId, userId, access, now, transaction);
  }

  /** Ownership transfer: the giving owner becomes an ADMIN member (Database Design §7.6). */
  demoteOwner(
    weddingId: string,
    membershipId: string,
    seat: OwnerSeat,
    transaction: Transaction,
  ): Promise<Membership | null> {
    return this.memberships.demoteOwner(weddingId, membershipId, seat, transaction);
  }

  /** Ownership transfer: the recipient takes the owner seat (Database Design §7.6). */
  promoteToOwner(
    weddingId: string,
    membershipId: string,
    seat: OwnerSeat,
    transaction: Transaction,
  ): Promise<Membership | null> {
    return this.memberships.promoteToOwner(weddingId, membershipId, seat, transaction);
  }

  /** The wedding's OWNER rows, read inside `transaction` when given. */
  listOwners(weddingId: string, transaction?: Transaction): Promise<Membership[]> {
    return this.memberships.listOwners(weddingId, transaction);
  }

  /** Partner acceptance: the user takes `seat` as owner (Database Design §7.3, 0038 D5, D10). */
  admitAsPartner(
    weddingId: string,
    userId: string,
    seat: OwnerSeat,
    now: Date,
    transaction: Transaction,
  ): Promise<{ membership: Membership; admission: PartnerAdmission } | null> {
    return this.memberships.admitAsPartner(weddingId, userId, seat, now, transaction);
  }

  /** Leaving: the owner becomes a removed member (Database Design §7.3, 0038 D7). */
  leaveAsOwner(
    weddingId: string,
    membershipId: string,
    revokedBy: string,
    now: Date,
    transaction: Transaction,
  ): Promise<Membership | null> {
    return this.memberships.leaveAsOwner(weddingId, membershipId, revokedBy, now, transaction);
  }

  /** The user's active memberships, oldest first. */
  listActiveForUser(userId: string): Promise<Membership[]> {
    return this.memberships.listActiveForUser(userId);
  }

  /** IDs of the weddings in which the user has an ACTIVE membership, oldest first. */
  async activeWeddingIds(userId: string): Promise<string[]> {
    const memberships = await this.memberships.listActiveForUser(userId);
    return memberships.map((membership) => membership.weddingId);
  }
}
