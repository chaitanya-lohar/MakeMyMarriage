import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, trusted, Types } from 'mongoose';
import { PasswordResetTokenRecord } from '../schemas/password-reset-token.schema.js';

@Injectable()
export class PasswordResetTokensRepository {
  constructor(
    @InjectModel(PasswordResetTokenRecord.name)
    private readonly tokens: Model<PasswordResetTokenRecord>,
  ) {}

  async create(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.tokens.create({ userId: new Types.ObjectId(userId), tokenHash, expiresAt });
  }

  /**
   * Marks an unused, unexpired token as used and returns its user, atomically, so a
   * token works exactly once even under concurrent requests. Null if not usable.
   */
  async consume(tokenHash: string): Promise<string | null> {
    const now = new Date();
    const document = await this.tokens.findOneAndUpdate(
      { tokenHash, usedAt: trusted({ $exists: false }), expiresAt: trusted({ $gt: now }) },
      { $set: { usedAt: now } },
    );
    return document ? document.userId.toString() : null;
  }

  /** Invalidates any other outstanding links once the password has been reset. */
  async invalidateAllForUser(userId: string): Promise<void> {
    await this.tokens.updateMany(
      { userId: new Types.ObjectId(userId), usedAt: trusted({ $exists: false }) },
      { $set: { usedAt: new Date() } },
    );
  }
}
