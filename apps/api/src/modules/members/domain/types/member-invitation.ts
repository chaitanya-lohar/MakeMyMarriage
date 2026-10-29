import type { PermissionOverride } from '../../../workspace/index.js';
import type { AssignableRole } from '../rules/member-authority.js';

/** Invitation statuses (Database Design §7.5), distinct from membership statuses. */
export const MemberInvitationStatus = {
  Pending: 'PENDING',
  Accepted: 'ACCEPTED',
  Declined: 'DECLINED',
  Expired: 'EXPIRED',
  Revoked: 'REVOKED',
} as const;
export type MemberInvitationStatus =
  (typeof MemberInvitationStatus)[keyof typeof MemberInvitationStatus];

/** An organizer invitation (Database Design §7.5). Never carries the token or its hash. */
export interface MemberInvitation {
  id: string;
  weddingId: string;
  email: string;
  role: AssignableRole;
  permissionOverrides: PermissionOverride[];
  message: string | null;
  /** As stored; `effectiveStatus` reports a pending invitation past `expiresAt` as EXPIRED. */
  status: MemberInvitationStatus;
  expiresAt: Date;
  invitedBy: string;
  acceptedByUserId?: string;
  membershipId?: string;
  respondedAt?: Date;
  revokedAt?: Date;
  lastSentAt?: Date;
  resentAt: Date[];
  createdAt: Date;
}

/** The status to report: a PENDING invitation past `expiresAt` is EXPIRED (P10-2). */
export function effectiveStatus(
  invitation: Pick<MemberInvitation, 'status' | 'expiresAt'>,
  now: Date,
): MemberInvitationStatus {
  return invitation.status === MemberInvitationStatus.Pending && invitation.expiresAt <= now
    ? MemberInvitationStatus.Expired
    : invitation.status;
}

export interface NewMemberInvitation {
  weddingId: string;
  email: string;
  role: AssignableRole;
  permissionOverrides: PermissionOverride[];
  message: string | null;
  tokenHash: string;
  expiresAt: Date;
  invitedBy: string;
  now: Date;
}

export interface MemberInvitationPage {
  invitations: MemberInvitation[];
  nextCursor: string | null;
}

/** A PENDING invitation already exists for this wedding and email. */
export class MemberInvitationPendingError extends Error {
  constructor() {
    super('A pending invitation exists for this email');
    this.name = 'MemberInvitationPendingError';
  }
}
