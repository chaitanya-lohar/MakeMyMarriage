import { Injectable } from '@nestjs/common';
import { EmailAlreadyRegisteredError, UsersService, type User } from '../../../users/index.js';
import type { ClientInfo } from '../../domain/types/auth-session.js';
import { AuthErrors } from '../auth-errors.js';
import { PasswordHasher } from '../services/password-hasher.service.js';
import { SessionIssuer, type IssuedSession } from '../services/session-issuer.service.js';

export interface RegisterInput {
  displayName: string;
  email: string;
  password: string;
}

/**
 * Creates a user account and signs it in. No wedding is created (decision 0012).
 * Sign-up starts a browser session ("Remember me" unticked, decision 0015).
 */
@Injectable()
export class RegisterUseCase {
  constructor(
    private readonly users: UsersService,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionIssuer,
  ) {}

  async execute(
    input: RegisterInput,
    client: ClientInfo,
  ): Promise<{ user: User; session: IssuedSession }> {
    let user: User;
    try {
      user = await this.users.create({
        displayName: input.displayName.trim(),
        email: input.email,
        passwordHash: await this.hasher.hash(input.password),
      });
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) throw AuthErrors.emailAlreadyRegistered();
      throw error;
    }
    return { user, session: await this.sessions.start(user.id, false, client) };
  }
}
