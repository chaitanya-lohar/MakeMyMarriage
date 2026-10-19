import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, trusted, Types } from 'mongoose';
import {
  EmailAlreadyRegisteredError,
  type NewUser,
  type User,
  type UserCredentials,
} from '../../domain/types/user.js';
import { UserRecord, type UserDocument } from '../schemas/user.schema.js';

const DUPLICATE_KEY = 11000;

// Server-built operator; `trusted` exempts it from the global sanitizeFilter (database.module.ts).
const notDeleted = () => ({ deletedAt: trusted({ $exists: false }) });

function toUser(document: UserDocument): User {
  return {
    id: document._id.toString(),
    email: document.email,
    displayName: document.displayName,
    status: document.status,
    createdAt: document.createdAt,
  };
}

/** Data access for `users`. Callers pass normalized emails. */
@Injectable()
export class UsersRepository {
  constructor(@InjectModel(UserRecord.name) private readonly users: Model<UserRecord>) {}

  async create(newUser: NewUser): Promise<User> {
    try {
      return toUser(await this.users.create(newUser));
    } catch (error) {
      if ((error as { code?: number }).code === DUPLICATE_KEY) {
        throw new EmailAlreadyRegisteredError();
      }
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    if (!isValidObjectId(id)) return null;
    const document = await this.users.findOne({ _id: id, ...notDeleted() });
    return document ? toUser(document) : null;
  }

  /** The users with these IDs that are not deleted; unknown IDs are skipped. */
  async findManyByIds(ids: string[]): Promise<User[]> {
    const valid = [...new Set(ids)].filter((id) => isValidObjectId(id));
    if (valid.length === 0) return [];
    const documents = await this.users.find({
      _id: trusted({ $in: valid.map((id) => new Types.ObjectId(id)) }),
      ...notDeleted(),
    });
    return documents.map(toUser);
  }

  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    const document = await this.users.findOne({ email, ...notDeleted() });
    return document ? { user: toUser(document), passwordHash: document.passwordHash } : null;
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.users.updateOne({ _id: id }, { $set: { passwordHash } });
  }
}
