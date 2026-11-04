import type { RateLimitRule } from '../../../../infrastructure/rate-limit/rate-limiter.service.js';

/** At most three resends of one invitation in any rolling 24 hours (API Design §28). */
export const PARTNER_RESENDS_PER_DAY = 3;

/** The Phase 10 invitation limits, applied to partner invitations (0038 D4, API Design §28). */
export const PartnerLimits = {
  /** 10 partner invitations per wedding in any rolling hour. */
  createPerWedding: { name: 'partner-invitation-create', limit: 10, windowSeconds: 3600 },
  /** Token routes: 120 per IP and 60 per token a minute. */
  perIp: { name: 'partner-invitation-ip', limit: 120, windowSeconds: 60 },
  perToken: { name: 'partner-invitation-token', limit: 60, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Resends left now: three minus those in the last 24 hours. */
export function resendsLeft(resentAt: readonly Date[], now: Date): number {
  const recent = resentAt.filter((time) => time.getTime() > now.getTime() - DAY_MS).length;
  return Math.max(0, PARTNER_RESENDS_PER_DAY - recent);
}

/** Seconds until another resend is allowed, when none is left. */
export function resendRetryAfterSeconds(resentAt: readonly Date[], now: Date): number {
  const oldest = resentAt.at(-PARTNER_RESENDS_PER_DAY) ?? now;
  return Math.max(1, Math.ceil((oldest.getTime() + DAY_MS - now.getTime()) / 1000));
}
