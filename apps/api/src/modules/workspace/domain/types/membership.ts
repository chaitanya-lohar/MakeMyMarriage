import type { MemberType, MembershipRole, MembershipStatus } from '../enums/membership.js';

/** A user's access to a wedding (Database Design §7.2). */
export interface Membership {
  id: string;
  weddingId: string;
  userId: string;
  memberType: MemberType;
  role: MembershipRole;
  status: MembershipStatus;
}

/** The user already holds an OWNER membership (0010 #18, decision 0012). */
export class OwnerMembershipExistsError extends Error {
  constructor() {
    super('The user already owns a wedding');
    this.name = 'OwnerMembershipExistsError';
  }
}
