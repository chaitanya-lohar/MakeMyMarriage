import { Injectable } from '@nestjs/common';
import { RateLimiter } from '../../../../infrastructure/rate-limit/rate-limiter.service.js';
import { UsersService } from '../../../users/index.js';
import { AuthRateLimits } from '../../domain/rules/auth-policy.js';
import { AuthSessionsRepository } from '../../infrastructure/repositories/auth-sessions.repository.js';
import { PasswordResetTokensRepository } from '../../infrastructure/repositories/password-reset-tokens.repository.js';
import { AuthErrors } from '../auth-errors.js';
import { PasswordHasher } from '../services/password-hasher.service.js';
import { TokenService } from '../services/token.service.js';

/**
 * Sets a new password with a single-use reset token, then signs the user out everywhere
 * (System Design §7.1), invalidates any other outstanding reset links and lifts any
 * sign-in lockout.
 */
@Injectable()
export class ResetPasswordUseCase {
  constructor(
    private readonly resetTokens: PasswordResetTokensRepository,
    private readonly sessions: AuthSessionsRepository,
    private readonly users: UsersService,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly rateLimiter: RateLimiter,
  ) {}

  async execute(token: string, newPassword: string): Promise<void> {
    const userId = await this.resetTokens.consume(this.tokens.hashSecret(token));
    if (!userId) throw AuthErrors.resetTokenInvalid();

    await this.users.setPasswordHash(userId, await this.hasher.hash(newPassword));
    await this.sessions.revokeAllForUser(userId);
    await this.resetTokens.invalidateAllForUser(userId);

    // A user locked out by failed sign-ins can use the new password straight away.
    const user = await this.users.findById(userId);
    if (user) await this.rateLimiter.reset(AuthRateLimits.loginFailures, user.email);
  }
}
