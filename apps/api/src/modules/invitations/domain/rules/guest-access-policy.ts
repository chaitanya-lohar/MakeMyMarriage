/**
 * Rate limits for the account-free guest routes (Phase 4 PRD §7.1, API Design §10: "per
 * token and IP"). Thresholds approved in decision 0023: the per-IP limit allows for shared
 * networks such as a venue's Wi-Fi; the per-link limit protects each invitation. Every
 * request counts, including unknown tokens, so guessing is throttled per IP.
 */
export const GuestAccessLimits = {
  /** Requests from one IP address, across all tokens. */
  perIp: { name: 'invitation-ip', limit: 120, windowSeconds: 60 },
  /** Requests for one token, from any IP address. */
  perToken: { name: 'invitation-token', limit: 60, windowSeconds: 60 },
} as const;
