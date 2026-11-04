import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, trusted, Types } from 'mongoose';
import { sessionOf, type Transaction } from '../../../../infrastructure/database/transaction.js';
import type { NewWedding, Wedding, WeddingChanges } from '../../domain/types/wedding.js';
import { WeddingRecord, type WeddingDocument } from '../schemas/wedding.schema.js';

// Server-built operator; `trusted` exempts it from the global sanitizeFilter (database.module.ts).
const notDeleted = () => ({ deletedAt: trusted({ $exists: false }) });

const OPTIONAL_FIELDS = ['startDate', 'venueName', 'primaryCity', 'description'] as const;

function toStoredDate(calendarDate: string): Date {
  return new Date(`${calendarDate}T00:00:00.000Z`);
}

function toWedding(document: WeddingDocument): Wedding {
  return {
    id: document._id.toString(),
    displayName: document.displayName,
    brideName: document.brideName,
    groomName: document.groomName,
    startDate: document.startDate ? document.startDate.toISOString().slice(0, 10) : null,
    venueName: document.venueName ?? null,
    primaryCity: document.primaryCity ?? null,
    description: document.description ?? null,
    timezone: document.timezone,
  };
}

/** Data access for `weddings`. Soft-deleted weddings are never returned. */
@Injectable()
export class WeddingsRepository {
  constructor(@InjectModel(WeddingRecord.name) private readonly weddings: Model<WeddingRecord>) {}

  async create(wedding: NewWedding, transaction?: Transaction): Promise<Wedding> {
    const [document] = await this.weddings.create(
      [
        {
          displayName: wedding.displayName,
          brideName: wedding.brideName,
          groomName: wedding.groomName,
          timezone: wedding.timezone,
          createdBy: new Types.ObjectId(wedding.createdBy),
          ...(wedding.startDate ? { startDate: toStoredDate(wedding.startDate) } : {}),
          ...(wedding.venueName ? { venueName: wedding.venueName } : {}),
          ...(wedding.primaryCity ? { primaryCity: wedding.primaryCity } : {}),
          ...(wedding.description ? { description: wedding.description } : {}),
        },
      ],
      { session: sessionOf(transaction) },
    );
    return toWedding(document as WeddingDocument);
  }

  async findById(id: string): Promise<Wedding | null> {
    if (!isValidObjectId(id)) return null;
    const document = await this.weddings.findOne({ _id: id, ...notDeleted() });
    return document ? toWedding(document) : null;
  }

  /** The weddings with these IDs, in the order given; missing or deleted ones are skipped. */
  async findManyByIds(ids: string[]): Promise<Wedding[]> {
    const valid = ids.filter((id) => isValidObjectId(id));
    if (valid.length === 0) return [];
    const documents = await this.weddings.find({
      _id: trusted({ $in: valid.map((id) => new Types.ObjectId(id)) }),
      ...notDeleted(),
    });
    const byId = new Map(documents.map((document) => [document._id.toString(), document]));
    return valid.flatMap((id) => {
      const document = byId.get(id);
      return document ? [toWedding(document)] : [];
    });
  }

  /**
   * Increments `ownersVersion` inside an owner-changing transaction (decision 0038): a second
   * such transaction on the same wedding then hits a write conflict and is retried, so owner
   * changes are serialized. False when the wedding is missing or deleted.
   */
  async bumpOwnersVersion(id: string, transaction: Transaction): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    const result = await this.weddings.updateOne(
      { _id: id, ...notDeleted() },
      { $inc: { ownersVersion: 1 } },
      { session: sessionOf(transaction) },
    );
    return result.matchedCount === 1;
  }

  /** Applies the changes; a null optional field is removed. Returns null if not found. */
  async update(id: string, changes: WeddingChanges): Promise<Wedding | null> {
    if (!isValidObjectId(id)) return null;
    const set: Record<string, unknown> = {};
    const unset: Record<string, ''> = {};
    for (const key of ['displayName', 'brideName', 'groomName'] as const) {
      if (changes[key] !== undefined) set[key] = changes[key];
    }
    for (const key of OPTIONAL_FIELDS) {
      const value = changes[key];
      if (value === undefined) continue;
      if (value === null || value === '') unset[key] = '';
      else set[key] = key === 'startDate' ? toStoredDate(value) : value;
    }

    const document = await this.weddings.findOneAndUpdate(
      { _id: id, ...notDeleted() },
      {
        ...(Object.keys(set).length > 0 ? { $set: set } : {}),
        ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
      },
      { returnDocument: 'after' },
    );
    return document ? toWedding(document) : null;
  }
}
