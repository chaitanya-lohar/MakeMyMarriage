import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, trusted, Types } from 'mongoose';
import type { EventChanges, NewEvent, WeddingEvent } from '../../domain/types/event.js';
import { EventRecord, type EventDocument } from '../schemas/event.schema.js';

// Server-built operators; `trusted` exempts them from the global sanitizeFilter.
const notDeleted = () => ({ deletedAt: trusted({ $exists: false }) });

/** Date, then start time; events without a start time come first on their day (0017 #17). */
const EVENT_ORDER = { date: 1, startTime: 1, _id: 1 } as const;

const OPTIONAL_FIELDS = ['startTime', 'endTime', 'description', 'dressCode', 'notes'] as const;

/** Filters on ObjectId fields need ObjectIds: strings are not cast under sanitizeFilter. */
const oid = (id: string) => new Types.ObjectId(id);

function toStoredDate(calendarDate: string): Date {
  return new Date(`${calendarDate}T00:00:00.000Z`);
}

function toEvent(document: EventDocument): WeddingEvent {
  return {
    id: document._id.toString(),
    weddingId: document.weddingId.toString(),
    name: document.name,
    type: document.type,
    date: document.date.toISOString().slice(0, 10),
    startTime: document.startTime ?? null,
    endTime: document.endTime ?? null,
    timezone: document.timezone,
    description: document.description ?? null,
    venue: { name: document.venue?.name ?? null, address: document.venue?.address ?? null },
    dressCode: document.dressCode ?? null,
    notes: document.notes ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

/** Data access for `events`, always scoped to one wedding. Deleted events are never returned. */
@Injectable()
export class EventsRepository {
  constructor(@InjectModel(EventRecord.name) private readonly events: Model<EventRecord>) {}

  async create(event: NewEvent): Promise<WeddingEvent> {
    const venue = {
      ...(event.venue.name ? { name: event.venue.name } : {}),
      ...(event.venue.address ? { address: event.venue.address } : {}),
    };
    const document = await this.events.create({
      weddingId: new Types.ObjectId(event.weddingId),
      name: event.name,
      type: event.type,
      date: toStoredDate(event.date),
      timezone: event.timezone,
      createdBy: new Types.ObjectId(event.createdBy),
      ...(Object.keys(venue).length > 0 ? { venue } : {}),
      ...Object.fromEntries(
        OPTIONAL_FIELDS.flatMap((key) => (event[key] ? [[key, event[key]]] : [])),
      ),
    });
    return toEvent(document);
  }

  async findActive(weddingId: string, eventId: string): Promise<WeddingEvent | null> {
    if (!isValidObjectId(eventId)) return null;
    const document = await this.events.findOne({
      _id: oid(eventId),
      weddingId: oid(weddingId),
      ...notDeleted(),
    });
    return document ? toEvent(document) : null;
  }

  /** The wedding's active events with these IDs, in event order; others are skipped. */
  async findActiveMany(weddingId: string, eventIds: string[]): Promise<WeddingEvent[]> {
    const valid = eventIds.filter((id) => isValidObjectId(id));
    if (valid.length === 0) return [];
    const documents = await this.events
      .find({
        _id: trusted({ $in: valid.map((id) => new Types.ObjectId(id)) }),
        weddingId: oid(weddingId),
        ...notDeleted(),
      })
      .sort(EVENT_ORDER);
    return documents.map(toEvent);
  }

  /** Every active event of the wedding, in event order. The list is bounded (API Design §8). */
  async listActive(weddingId: string): Promise<WeddingEvent[]> {
    const documents = await this.events
      .find({ weddingId: oid(weddingId), ...notDeleted() })
      .sort(EVENT_ORDER);
    return documents.map(toEvent);
  }

  /** Active events dated on or after `fromDate` (YYYY-MM-DD), in event order. */
  async listActiveFrom(
    weddingId: string,
    fromDate: string,
    limit: number,
  ): Promise<WeddingEvent[]> {
    const documents = await this.events
      .find({
        weddingId: oid(weddingId),
        date: trusted({ $gte: toStoredDate(fromDate) }),
        ...notDeleted(),
      })
      .sort(EVENT_ORDER)
      .limit(limit);
    return documents.map(toEvent);
  }

  /** Applies the changes; a null optional field is removed. Returns null if not found. */
  async update(
    weddingId: string,
    eventId: string,
    changes: EventChanges,
  ): Promise<WeddingEvent | null> {
    if (!isValidObjectId(eventId)) return null;
    const set: Record<string, unknown> = {};
    const unset: Record<string, ''> = {};
    if (changes.name !== undefined) set.name = changes.name;
    if (changes.type !== undefined) set.type = changes.type;
    if (changes.date !== undefined) set.date = toStoredDate(changes.date);
    for (const key of OPTIONAL_FIELDS) {
      const value = changes[key];
      if (value === undefined) continue;
      if (value === null || value === '') unset[key] = '';
      else set[key] = value;
    }
    for (const key of ['name', 'address'] as const) {
      const value = changes.venue?.[key];
      if (value === undefined) continue;
      if (value === null || value === '') unset[`venue.${key}`] = '';
      else set[`venue.${key}`] = value;
    }

    const document = await this.events.findOneAndUpdate(
      { _id: oid(eventId), weddingId: oid(weddingId), ...notDeleted() },
      {
        ...(Object.keys(set).length > 0 ? { $set: set } : {}),
        ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
      },
      { returnDocument: 'after' },
    );
    return document ? toEvent(document) : null;
  }

  /** Soft-deletes the event; its assignments and history stay (0017 #12). */
  async softDelete(weddingId: string, eventId: string, deletedBy: string): Promise<boolean> {
    if (!isValidObjectId(eventId)) return false;
    const result = await this.events.updateOne(
      { _id: oid(eventId), weddingId: oid(weddingId), ...notDeleted() },
      { $set: { deletedAt: new Date(), deletedBy: new Types.ObjectId(deletedBy) } },
    );
    return result.modifiedCount === 1;
  }
}
