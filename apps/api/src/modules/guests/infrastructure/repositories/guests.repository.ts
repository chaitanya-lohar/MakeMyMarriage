import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, trusted, Types } from 'mongoose';
import { sessionOf, type Transaction } from '../../../../infrastructure/database/transaction.js';
import { normalizeMobile } from '../../domain/rules/guest-rules.js';
import type {
  DuplicateMobileGuest,
  Guest,
  GuestChanges,
  GuestPage,
  NewGuest,
} from '../../domain/types/guest.js';
import { GuestRecord, type GuestDocument } from '../schemas/guest.schema.js';

/** Filters on ObjectId fields need ObjectIds: strings are not cast under sanitizeFilter. */
const oid = (id: string) => new Types.ObjectId(id);

// Server-built operator; `trusted` exempts it from the global sanitizeFilter.
const notDeleted = () => ({ deletedAt: trusted({ $exists: false }) });

/** Alphabetical, case-insensitive guest order; the ID breaks ties so cursors are stable. */
const NAME_COLLATION = { locale: 'en', strength: 2 } as const;

const OPTIONAL_FIELDS = ['email', 'relation', 'notes'] as const;

interface Cursor {
  name: string;
  id: string;
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify([cursor.name, cursor.id])).toString('base64url');
}

/** The cursor's position, or null when it is not one this API issued. */
export function decodeCursor(value: string): Cursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string' &&
      isValidObjectId(parsed[1])
    ) {
      return { name: parsed[0], id: parsed[1] };
    }
  } catch {
    // Falls through: malformed cursor.
  }
  return null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toGuest(document: GuestDocument): Guest {
  return {
    id: document._id.toString(),
    weddingId: document.weddingId.toString(),
    name: document.name,
    mobile: document.mobile,
    email: document.email ?? null,
    relation: document.relation ?? null,
    notes: document.notes ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export interface GuestSearch {
  search?: string;
  /** Restricts the page to these guests (from an event or RSVP filter). */
  guestIds?: string[];
  limit: number;
  cursor?: Cursor;
}

/** Data access for `guests`, always scoped to one wedding. Deleted guests are never returned. */
@Injectable()
export class GuestsRepository {
  constructor(@InjectModel(GuestRecord.name) private readonly guests: Model<GuestRecord>) {}

  async create(guest: NewGuest): Promise<Guest> {
    const document = await this.guests.create({
      weddingId: oid(guest.weddingId),
      name: guest.name,
      mobile: guest.mobile,
      createdBy: oid(guest.createdBy),
      ...Object.fromEntries(
        OPTIONAL_FIELDS.flatMap((key) => (guest[key] ? [[key, guest[key]]] : [])),
      ),
    });
    return toGuest(document);
  }

  async findActive(weddingId: string, guestId: string): Promise<Guest | null> {
    if (!isValidObjectId(guestId)) return null;
    const document = await this.guests.findOne({
      _id: oid(guestId),
      weddingId: oid(weddingId),
      ...notDeleted(),
    });
    return document ? toGuest(document) : null;
  }

  /** Other active guests in the wedding with this normalized mobile. */
  async findDuplicateMobiles(
    weddingId: string,
    mobile: string,
    exceptGuestId: string,
  ): Promise<DuplicateMobileGuest[]> {
    const documents = await this.guests
      .find({
        weddingId: oid(weddingId),
        mobile,
        _id: trusted({ $ne: oid(exceptGuestId) }),
        ...notDeleted(),
      })
      .collation(NAME_COLLATION)
      .sort({ name: 1, _id: 1 });
    return documents.map((document) => ({ id: document._id.toString(), name: document.name }));
  }

  /** One page of active guests, alphabetically, optionally searched and restricted. */
  async search(weddingId: string, query: GuestSearch): Promise<GuestPage> {
    const conditions: Record<string, unknown>[] = [{ weddingId: oid(weddingId) }, notDeleted()];

    if (query.guestIds) {
      conditions.push({ _id: trusted({ $in: query.guestIds.map(oid) }) });
    }

    const search = query.search?.trim();
    if (search) {
      const matches: Record<string, unknown>[] = [
        { name: trusted({ $regex: escapeRegex(search), $options: 'i' }) },
      ];
      const mobile = normalizeMobile(search);
      if (/^\+?\d+$/.test(mobile)) {
        matches.push({ mobile: trusted({ $regex: escapeRegex(mobile) }) });
      }
      conditions.push({ $or: matches });
    }

    if (query.cursor) {
      const { name, id } = query.cursor;
      conditions.push({
        $or: [{ name: trusted({ $gt: name }) }, { name, _id: trusted({ $gt: oid(id) }) }],
      });
    }

    const documents = await this.guests
      .find(trusted({ $and: conditions }))
      .collation(NAME_COLLATION)
      .sort({ name: 1, _id: 1 })
      .limit(query.limit + 1);

    const page = documents.slice(0, query.limit).map(toGuest);
    const last = page.at(-1);
    return {
      guests: page,
      nextCursor:
        documents.length > query.limit && last
          ? encodeCursor({ name: last.name, id: last.id })
          : null,
    };
  }

  async countActive(weddingId: string): Promise<number> {
    return this.guests.countDocuments({ weddingId: oid(weddingId), ...notDeleted() });
  }

  /** Applies the changes; a null optional field is removed. Returns null if not found. */
  async update(weddingId: string, guestId: string, changes: GuestChanges): Promise<Guest | null> {
    if (!isValidObjectId(guestId)) return null;
    const set: Record<string, unknown> = {};
    const unset: Record<string, ''> = {};
    if (changes.name !== undefined) set.name = changes.name;
    if (changes.mobile !== undefined) set.mobile = changes.mobile;
    for (const key of OPTIONAL_FIELDS) {
      const value = changes[key];
      if (value === undefined) continue;
      if (value === null || value === '') unset[key] = '';
      else set[key] = value;
    }

    const document = await this.guests.findOneAndUpdate(
      { _id: oid(guestId), weddingId: oid(weddingId), ...notDeleted() },
      {
        ...(Object.keys(set).length > 0 ? { $set: set } : {}),
        ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
      },
      { returnDocument: 'after' },
    );
    return document ? toGuest(document) : null;
  }

  /** Soft-deletes the guest; their assignments and history stay (Phase 4 PRD §4). */
  async softDelete(
    weddingId: string,
    guestId: string,
    deletedBy: string,
    transaction?: Transaction,
  ): Promise<boolean> {
    if (!isValidObjectId(guestId)) return false;
    const result = await this.guests.updateOne(
      { _id: oid(guestId), weddingId: oid(weddingId), ...notDeleted() },
      { $set: { deletedAt: new Date(), deletedBy: oid(deletedBy) } },
      { session: sessionOf(transaction) },
    );
    return result.modifiedCount === 1;
  }
}
