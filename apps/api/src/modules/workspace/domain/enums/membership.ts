/** Database Design §7.2 `memberType`. */
export const MemberType = {
  Owner: 'OWNER',
  Member: 'MEMBER',
} as const;
export type MemberType = (typeof MemberType)[keyof typeof MemberType];

/** Database Design §7.2 / §8 predefined roles. Only OWNER is used before Phase 10. */
export const MembershipRole = {
  Owner: 'OWNER',
  Admin: 'ADMIN',
  Organizer: 'ORGANIZER',
  Editor: 'EDITOR',
  Viewer: 'VIEWER',
} as const;
export type MembershipRole = (typeof MembershipRole)[keyof typeof MembershipRole];

/** Database Design §7.2 `status`. */
export const MembershipStatus = {
  Invited: 'INVITED',
  Active: 'ACTIVE',
  Revoked: 'REVOKED',
} as const;
export type MembershipStatus = (typeof MembershipStatus)[keyof typeof MembershipStatus];
