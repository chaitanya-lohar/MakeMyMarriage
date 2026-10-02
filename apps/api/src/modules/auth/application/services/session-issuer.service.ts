import { Injectable } from '@nestjs/common';
import { sessionLifetimeMs } from '../../domain/rules/auth-policy.js';
import type { ClientInfo } from '../../domain/types/auth-session.js';
import { AuthSessionsRepository } from '../../infrastructure/repositories/auth-sessions.repository.js';
import { TokenService } from './token.service.js';

/** The credentials handed to the browser as cookies. */
export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  /** "Remember me": the refresh cookie persists across browser restarts. */
  remembered: boolean;
}

const MAX_USER_AGENT_LENGTH = 512;

/** Starts a new sign-in session for a user. */
@Injectable()
export class SessionIssuer {
  constructor(
    private readonly sessions: AuthSessionsRepository,
    private readonly tokens: TokenService,
  ) {}

  async start(userId: string, rememberMe: boolean, client: ClientInfo): Promise<IssuedSession> {
    const secret = this.tokens.randomSecret();
    const session = await this.sessions.create({
      userId,
      refreshTokenHash: this.tokens.hashSecret(secret),
      expiresAt: new Date(Date.now() + sessionLifetimeMs(rememberMe)),
      userAgent: client.userAgent?.slice(0, MAX_USER_AGENT_LENGTH),
      ipAddress: client.ipAddress,
    });
    return {
      accessToken: await this.tokens.createAccessToken({ userId, sessionId: session.id }),
      refreshToken: this.tokens.composeRefreshToken(session.id, secret),
      remembered: rememberMe,
    };
  }
}
