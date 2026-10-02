import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id password hashing (decision 0015) with the library's recommended parameters,
 * which are encoded in each hash so they can be raised later without breaking old hashes.
 */
@Injectable()
export class PasswordHasher {
  // Verified against when an email has no account, so a failed sign-in takes the same
  // time whether or not the account exists.
  private readonly decoyHash = hash('decoy-password-for-timing-only');

  hash(password: string): Promise<string> {
    return hash(password);
  }

  async verify(passwordHash: string | undefined, password: string): Promise<boolean> {
    try {
      const matches = await verify(passwordHash ?? (await this.decoyHash), password);
      return passwordHash !== undefined && matches;
    } catch {
      return false;
    }
  }
}
