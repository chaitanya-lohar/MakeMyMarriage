import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../../config/app-config.js';
import { EmailOutbox } from '../../../../infrastructure/email/email-outbox.service.js';
import { RateLimiter } from '../../../../infrastructure/rate-limit/rate-limiter.service.js';
import { normalizeEmail, UsersService, UserStatus } from '../../../users/index.js';
import { AuthRateLimits, ResetPolicy } from '../../domain/rules/auth-policy.js';
import { PasswordResetTokensRepository } from '../../infrastructure/repositories/password-reset-tokens.repository.js';
import { AuthErrors } from '../auth-errors.js';
import { passwordResetEmail } from '../emails/password-reset.email.js';
import { TokenService } from '../services/token.service.js';

/**
 * Emails a single-use reset link if the account exists. The caller always gets the same
 * response, so the endpoint never reveals whether an email is registered (decision 0015).
 */
@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    private readonly users: UsersService,
    private readonly resetTokens: PasswordResetTokensRepository,
    private readonly tokens: TokenService,
    private readonly outbox: EmailOutbox,
    private readonly rateLimiter: RateLimiter,
    private readonly config: AppConfig,
  ) {}

  async execute(rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const attempts = await this.rateLimiter.hit(AuthRateLimits.resetRequests, email);
    if (attempts > AuthRateLimits.resetRequests.limit) throw AuthErrors.tooManyAttempts();

    const credentials = await this.users.findCredentialsByEmail(email);
    if (!credentials || credentials.user.status !== UserStatus.Active) return;

    const token = this.tokens.randomSecret();
    await this.resetTokens.create(
      credentials.user.id,
      this.tokens.hashSecret(token),
      new Date(Date.now() + ResetPolicy.tokenTtlMs),
    );

    const resetUrl = `${this.config.web.appUrl}/reset-password?token=${token}`;
    // Sent after the response, so its timing does not reveal that the account exists (0025).
    this.outbox.sendAfterResponse(
      passwordResetEmail(credentials.user.email, credentials.user.displayName, resetUrl),
    );
  }
}
