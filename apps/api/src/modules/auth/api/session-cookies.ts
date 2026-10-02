import type { CookieOptions, Response } from 'express';
import { API_PREFIX } from '../../../bootstrap/configure-http-app.js';
import { SessionPolicy } from '../domain/rules/auth-policy.js';
import type { IssuedSession } from '../application/services/session-issuer.service.js';

/** Cookie carrying the 15-minute access token; sent with every API request. */
export const ACCESS_COOKIE = 'mmm_at';
/** Cookie carrying the refresh token; sent only to the auth endpoints. */
export const REFRESH_COOKIE = 'mmm_rt';

const REFRESH_PATH = `/${API_PREFIX}/auth`;

function baseOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure };
}

/**
 * Sets the session cookies (decision 0015). The access cookie always ends with the
 * browser session; the refresh cookie persists for the session's lifetime only when
 * "Remember me" was ticked.
 */
export function setSessionCookies(
  response: Response,
  session: IssuedSession,
  secure: boolean,
): void {
  response.cookie(ACCESS_COOKIE, session.accessToken, { ...baseOptions(secure), path: '/' });
  response.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...baseOptions(secure),
    path: REFRESH_PATH,
    ...(session.remembered ? { maxAge: SessionPolicy.rememberedSessionMs } : {}),
  });
}

export function clearSessionCookies(response: Response, secure: boolean): void {
  response.clearCookie(ACCESS_COOKIE, { ...baseOptions(secure), path: '/' });
  response.clearCookie(REFRESH_COOKIE, { ...baseOptions(secure), path: REFRESH_PATH });
}
