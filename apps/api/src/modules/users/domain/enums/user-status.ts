/**
 * Account status (Database Design §6.1 `users.status`). The design lists no values; V1
 * uses only ACTIVE (decision 0015). New values are added with the feature that needs them.
 */
export const UserStatus = {
  Active: 'ACTIVE',
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
