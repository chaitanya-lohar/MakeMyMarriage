import { Injectable } from '@nestjs/common';
import { UsersService, UserStatus, type User } from '../../../users/index.js';
import { isRememberedSession } from '../../domain/rules/auth-policy.js';
import { AuthSessionsRepository } from '../../infrastructure/repositories/auth-sessions.repository.js';
import { AuthErrors } from '../auth-errors.js';
import type { IssuedSession } from '../services/session-issuer.service.js';
import { TokenService } from '../services/token.service.js';

export type RefreshResult =
  | { outcome: 'refreshed'; user: User; session: IssuedSession }
  /**
   * The session is still active but this refresh token was already rotated — typically by
   * another tab of the same browser. The caller must not clear that browser's cookies,
   * which may already hold the newer tokens.
   */
  | { outcome: 'superseded' };

/**
 * Exchanges a refresh token for a new access token and rotates the refresh token.
 * The session's absolute expiry is unchanged (decision 0015). Throws UNAUTHENTICATED when
 * the session has ended.
 */
@Injectable()
export class RefreshSessionUseCase {
  constructor(
    private readonly sessions: AuthSessionsRepository,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
  ) {}

  async execute(refreshToken: string | undefined): Promise<RefreshResult> {
    const parsed = refreshToken ? this.tokens.parseRefreshToken(refreshToken) : null;
    if (!parsed) throw AuthErrors.unauthenticated();

    const found = await this.sessions.findActive(parsed.sessionId);
    if (!found) throw AuthErrors.unauthenticated();
    if (!this.tokens.matchesHash(parsed.secret, found.refreshTokenHash)) {
      return { outcome: 'superseded' };
    }

    const user = await this.users.findById(found.session.userId);
    if (!user || user.status !== UserStatus.Active) throw AuthErrors.unauthenticated();

    const nextSecret = this.tokens.randomSecret();
    const rotated = await this.sessions.rotate(
      found.session.id,
      found.refreshTokenHash,
      this.tokens.hashSecret(nextSecret),
    );
    // Lost a race with a concurrent refresh of the same token.
    if (!rotated) return { outcome: 'superseded' };

    return {
      outcome: 'refreshed',
      user,
      session: {
        accessToken: await this.tokens.createAccessToken({
          userId: user.id,
          sessionId: found.session.id,
        }),
        refreshToken: this.tokens.composeRefreshToken(found.session.id, nextSecret),
        remembered: isRememberedSession(found.session),
        expiresAt: found.session.expiresAt,
      },
    };
  }
}
