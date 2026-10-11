/**
 * Rate limits for the account-free guest routes (Phase 4 PRD §7.1, API Design §10: "per
 * token and IP"). The thresholds are an engineering choice — API Design §35 leaves numeric
 * limits beyond 0015 open. Every request counts, including unknown tokens, so guessing is
 * throttled per IP.
 */
export const GuestAccessLimits = {
  /** Requests from one IP address, across all tokens. */
  perIp: { name: 'invitation-ip', limit: 60, windowSeconds: 60 },
  /** Requests for one token, from any IP address. */
  perToken: { name: 'invitation-token', limit: 30, windowSeconds: 60 },
} as const;
