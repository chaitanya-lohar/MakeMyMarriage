import { Injectable } from '@nestjs/common';
import { UsersService, type User } from '../../../users/index.js';
import { isRememberedSession } from '../../domain/rules/auth-policy.js';
import { AuthSessionsRepository } from '../../infrastructure/repositories/auth-sessions.repository.js';
import { AuthErrors } from '../auth-errors.js';
import type { IssuedSession } from '../services/session-issuer.service.js';
import { TokenService } from '../services/token.service.js';

/**
 * Exchanges a refresh token for a new access token and rotates the refresh token.
 * The session's absolute expiry is unchanged (decision 0015).
 */
@Injectable()
export class RefreshSessionUseCase {
  constructor(
    private readonly sessions: AuthSessionsRepository,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
  ) {}

  async execute(refreshToken: string | undefined): Promise<{ user: User; session: IssuedSession }> {
    const parsed = refreshToken ? this.tokens.parseRefreshToken(refreshToken) : null;
    if (!parsed) throw AuthErrors.unauthenticated();

    const found = await this.sessions.findActive(parsed.sessionId);
    if (!found || !this.tokens.matchesHash(parsed.secret, found.refreshTokenHash)) {
      throw AuthErrors.unauthenticated();
    }

    const user = await this.users.findById(found.session.userId);
    if (!user) throw AuthErrors.unauthenticated();

    const nextSecret = this.tokens.randomSecret();
    const rotated = await this.sessions.rotate(
      found.session.id,
      found.refreshTokenHash,
      this.tokens.hashSecret(nextSecret),
    );
    if (!rotated) throw AuthErrors.unauthenticated();

    return {
      user,
      session: {
        accessToken: await this.tokens.createAccessToken({
          userId: user.id,
          sessionId: found.session.id,
        }),
        refreshToken: this.tokens.composeRefreshToken(found.session.id, nextSecret),
        remembered: isRememberedSession(found.session),
      },
    };
  }
}
