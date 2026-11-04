import type { MemberType, MembershipRole, MembershipStatus } from '../enums/membership.js';
import type { PermissionAction, PermissionEffect, PermissionModule } from '../enums/permission.js';

/** The two owner seats of a wedding (Database Design §7.2, P10-5). */
export const OWNER_SEATS = [1, 2] as const;
export type OwnerSeat = (typeof OWNER_SEATS)[number];

/** One stored `ALLOW` or `DENY` of a `(module, action)` (Database Design §8.4). */
export interface PermissionOverride {
  module: PermissionModule;
  action: PermissionAction;
  effect: PermissionEffect;
}

/** A user's access to a wedding (Database Design §7.2). */
export interface Membership {
  id: string;
  weddingId: string;
  userId: string;
  memberType: MemberType;
  role: MembershipRole;
  status: MembershipStatus;
  /** Set exactly when memberType is OWNER. */
  ownerSeat?: OwnerSeat;
  /** Ignored on OWNER rows. Empty when the member has the role defaults only. */
  permissionOverrides: PermissionOverride[];
  acceptedAt?: Date;
  /** The member invitation this membership came from (Database Design §7.5). */
  invitationId?: string;
  invitedBy?: string;
  invitedAt?: Date;
  revokedAt?: Date;
  revokedBy?: string;
}

/** What an accepted organizer invitation grants (Database Design §7.5, P10-3). */
export interface InvitedAccess {
  role: MembershipRole;
  permissionOverrides: PermissionOverride[];
  invitationId: string;
  invitedBy: string;
  invitedAt: Date;
}

/**
 * How a partner's membership was made an owner (Database Design §7.3, decision 0038): a new
 * row, an organizer's row promoted (D5), or a removed member's row reactivated (D10).
 */
export type PartnerAdmission = 'CREATED' | 'PROMOTED' | 'REACTIVATED';

/** The owner seat was taken by someone else (`owner_seat_per_wedding`). */
export class OwnerSeatTakenError extends Error {
  constructor() {
    super('The owner seat is taken');
    this.name = 'OwnerSeatTakenError';
  }
}

/** The user already holds an OWNER membership (0010 #18, decision 0012). */
export class OwnerMembershipExistsError extends Error {
  constructor() {
    super('The user already owns a wedding');
    this.name = 'OwnerMembershipExistsError';
  }
}
