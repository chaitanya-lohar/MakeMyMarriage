import { Injectable } from '@nestjs/common';
import { normalizeEmail } from '../../domain/rules/email.js';
import type { NewUser, User, UserCredentials } from '../../domain/types/user.js';
import { UsersRepository } from '../../infrastructure/repositories/users.repository.js';

/** The users module's public API for other modules (exported from index.ts). */
@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  /** Throws EmailAlreadyRegisteredError if the email is taken. */
  create(newUser: NewUser): Promise<User> {
    return this.users.create({ ...newUser, email: normalizeEmail(newUser.email) });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findById(id);
  }

  /** The users with these IDs, for showing names (e.g. task assignees); unknown IDs are skipped. */
  findManyByIds(ids: string[]): Promise<User[]> {
    return this.users.findManyByIds(ids);
  }

  findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return this.users.findCredentialsByEmail(normalizeEmail(email));
  }

  setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    return this.users.updatePasswordHash(userId, passwordHash);
  }
}
