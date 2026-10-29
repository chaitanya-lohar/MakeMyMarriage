import { createHash, randomBytes } from 'node:crypto';
import type { RateLimitRule } from '../../../../infrastructure/rate-limit/rate-limiter.service.js';
import { MembershipRole } from '../../../workspace/index.js';

/** An invitation expires seven days after its current token was issued (P10-2, 0034 R5). */
export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/** At most 500 characters of optional message (Database Design §7.5). */
export const MESSAGE_MAX_LENGTH = 500;

export const InvitationLimits = {
  /** 0034 R1: 10 invitations per wedding in any rolling hour. */
  createPerWedding: { name: 'member-invitation-create', limit: 10, windowSeconds: 3600 },
  /** Token routes, as for the guest routes (API Design §28, 0023). */
  perIp: { name: 'member-invitation-ip', limit: 120, windowSeconds: 60 },
  perToken: { name: 'member-invitation-token', limit: 60, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

/** A new single-use token: 32 random bytes, base64url (43 characters). */
export function newInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

/** The stored form of a token (Database Design §7.5): its SHA-256 hash. */
export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** "me***@gmail.com": enough for the invitee to recognise the account (API Design §7.1). */
export function emailHint(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

/** The role's name as the email and pages show it. */
export function roleLabel(role: MembershipRole): string {
  const labels: Record<MembershipRole, string> = {
    OWNER: 'an Owner',
    ADMIN: 'an Admin',
    ORGANIZER: 'an Organizer',
    EDITOR: 'an Editor',
    VIEWER: 'a Viewer',
  };
  return labels[role];
}
