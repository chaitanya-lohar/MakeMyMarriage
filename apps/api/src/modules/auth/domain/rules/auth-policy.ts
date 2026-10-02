/** Authentication rules approved in decision 0015. */

export const PasswordPolicy = {
  minLength: 8,
  maxLength: 128,
} as const;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const SessionPolicy = {
  accessTokenTtlSeconds: 15 * 60,
  /** "Remember me" ticked. */
  rememberedSessionMs: 30 * DAY_MS,
  /** "Remember me" unticked, and sign-up: browser-session cookies, at most 24 hours. */
  browserSessionMs: 24 * HOUR_MS,
} as const;

export const ResetPolicy = {
  tokenTtlMs: 60 * MINUTE_MS,
} as const;

export const AuthRateLimits = {
  /** 5 failed sign-ins per email per 15 minutes. */
  loginFailures: { name: 'login-failures', limit: 5, windowSeconds: 15 * 60 },
  /** 3 reset requests per email per hour. */
  resetRequests: { name: 'reset-requests', limit: 3, windowSeconds: 60 * 60 },
} as const;

/** Absolute session lifetime from sign-in; refreshing never extends it. */
export function sessionLifetimeMs(rememberMe: boolean): number {
  return rememberMe ? SessionPolicy.rememberedSessionMs : SessionPolicy.browserSessionMs;
}

/**
 * Whether a stored session was created with "Remember me". Derived from its lifetime so
 * the session record needs no extra field (Database Design §6.2 is used unchanged).
 */
export function isRememberedSession(session: { createdAt: Date; expiresAt: Date }): boolean {
  return session.expiresAt.getTime() - session.createdAt.getTime() > SessionPolicy.browserSessionMs;
}
