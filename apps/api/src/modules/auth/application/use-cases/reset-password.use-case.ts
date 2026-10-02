import { Injectable } from '@nestjs/common';
import { UsersService } from '../../../users/index.js';
import { AuthSessionsRepository } from '../../infrastructure/repositories/auth-sessions.repository.js';
import { PasswordResetTokensRepository } from '../../infrastructure/repositories/password-reset-tokens.repository.js';
import { AuthErrors } from '../auth-errors.js';
import { PasswordHasher } from '../services/password-hasher.service.js';
import { TokenService } from '../services/token.service.js';

/**
 * Sets a new password with a single-use reset token, then signs the user out everywhere
 * (System Design §7.1) and invalidates any other outstanding reset links.
 */
@Injectable()
export class ResetPasswordUseCase {
  constructor(
    private readonly resetTokens: PasswordResetTokensRepository,
    private readonly sessions: AuthSessionsRepository,
    private readonly users: UsersService,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async execute(token: string, newPassword: string): Promise<void> {
    const userId = await this.resetTokens.consume(this.tokens.hashSecret(token));
    if (!userId) throw AuthErrors.resetTokenInvalid();

    await this.users.setPasswordHash(userId, await this.hasher.hash(newPassword));
    await this.sessions.revokeAllForUser(userId);
    await this.resetTokens.invalidateAllForUser(userId);
  }
}
