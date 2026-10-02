import { Injectable } from '@nestjs/common';
import { AuthSessionsRepository } from '../../infrastructure/repositories/auth-sessions.repository.js';
import { TokenService } from '../services/token.service.js';

/** Revokes the session behind a refresh token. Unknown or invalid tokens are ignored. */
@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly sessions: AuthSessionsRepository,
    private readonly tokens: TokenService,
  ) {}

  async execute(refreshToken: string | undefined): Promise<void> {
    const parsed = refreshToken ? this.tokens.parseRefreshToken(refreshToken) : null;
    if (!parsed) return;
    const found = await this.sessions.findActive(parsed.sessionId);
    // Only the holder of the session's current secret can revoke it.
    if (found && this.tokens.matchesHash(parsed.secret, found.refreshTokenHash)) {
      await this.sessions.revoke(found.session.id);
    }
  }
}
