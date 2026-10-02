import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, trusted, Types } from 'mongoose';
import type { AuthSession, NewAuthSession } from '../../domain/types/auth-session.js';
import { AuthSessionRecord, type AuthSessionDocument } from '../schemas/auth-session.schema.js';

function toSession(document: AuthSessionDocument): AuthSession {
  return {
    id: document._id.toString(),
    userId: document.userId.toString(),
    createdAt: document.createdAt,
    expiresAt: document.expiresAt,
  };
}

// Server-built operators; `trusted` exempts them from the global sanitizeFilter.
const active = (now: Date) => ({
  revokedAt: trusted({ $exists: false }),
  expiresAt: trusted({ $gt: now }),
});

@Injectable()
export class AuthSessionsRepository {
  constructor(
    @InjectModel(AuthSessionRecord.name) private readonly sessions: Model<AuthSessionRecord>,
  ) {}

  async create(session: NewAuthSession): Promise<AuthSession> {
    const document = await this.sessions.create({
      ...session,
      userId: new Types.ObjectId(session.userId),
      lastUsedAt: new Date(),
    });
    return toSession(document);
  }

  /** Active (not revoked, not expired) session with its refresh-token hash. */
  async findActive(id: string): Promise<{ session: AuthSession; refreshTokenHash: string } | null> {
    if (!isValidObjectId(id)) return null;
    const document = await this.sessions.findOne({ _id: id, ...active(new Date()) });
    return document
      ? { session: toSession(document), refreshTokenHash: document.refreshTokenHash }
      : null;
  }

  /**
   * Replaces the refresh-token hash only if it is still the expected one, so two
   * concurrent refreshes with the same token cannot both succeed.
   */
  async rotate(id: string, expectedHash: string, nextHash: string): Promise<boolean> {
    const result = await this.sessions.updateOne(
      { _id: id, refreshTokenHash: expectedHash, ...active(new Date()) },
      { $set: { refreshTokenHash: nextHash, lastUsedAt: new Date() } },
    );
    return result.modifiedCount === 1;
  }

  async revoke(id: string): Promise<void> {
    if (!isValidObjectId(id)) return;
    await this.sessions.updateOne(
      { _id: id, revokedAt: trusted({ $exists: false }) },
      { $set: { revokedAt: new Date() } },
    );
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.sessions.updateMany(
      { userId: new Types.ObjectId(userId), revokedAt: trusted({ $exists: false }) },
      { $set: { revokedAt: new Date() } },
    );
  }
}
