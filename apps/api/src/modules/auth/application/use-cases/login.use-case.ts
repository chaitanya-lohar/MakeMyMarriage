import { Injectable } from '@nestjs/common';
import { RateLimiter } from '../../../../infrastructure/rate-limit/rate-limiter.service.js';
import { normalizeEmail, UsersService, UserStatus, type User } from '../../../users/index.js';
import { AuthRateLimits } from '../../domain/rules/auth-policy.js';
import type { ClientInfo } from '../../domain/types/auth-session.js';
import { AuthErrors } from '../auth-errors.js';
import { PasswordHasher } from '../services/password-hasher.service.js';
import { SessionIssuer, type IssuedSession } from '../services/session-issuer.service.js';

export interface LoginInput {
  email: string;
  password: string;
  rememberMe: boolean;
}

/**
 * Email/password sign-in. The same error is returned whether the email is unknown or the
 * password is wrong, and both paths take the same time (decision 0015).
 */
@Injectable()
export class LoginUseCase {
  constructor(
    private readonly users: UsersService,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionIssuer,
    private readonly rateLimiter: RateLimiter,
  ) {}

  async execute(
    input: LoginInput,
    client: ClientInfo,
  ): Promise<{ user: User; session: IssuedSession }> {
    const email = normalizeEmail(input.email);
    if (await this.rateLimiter.isLimited(AuthRateLimits.loginFailures, email)) {
      throw AuthErrors.tooManyAttempts();
    }

    const credentials = await this.users.findCredentialsByEmail(email);
    const passwordMatches = await this.hasher.verify(credentials?.passwordHash, input.password);
    if (!credentials || !passwordMatches || credentials.user.status !== UserStatus.Active) {
      await this.rateLimiter.hit(AuthRateLimits.loginFailures, email);
      throw AuthErrors.invalidCredentials();
    }

    await this.rateLimiter.reset(AuthRateLimits.loginFailures, email);
    return {
      user: credentials.user,
      session: await this.sessions.start(credentials.user.id, input.rememberMe, client),
    };
  }
}
