import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, trusted, Types } from 'mongoose';
import { sessionOf, type Transaction } from '../../../../infrastructure/database/transaction.js';
import {
  afterTimeCursor,
  decodeTimeCursor,
  encodeTimeCursor,
} from '../../../../infrastructure/database/time-cursor.js';
import type {
  AuditEntry,
  AuditListQuery,
  AuditPage,
  AuditRecord,
} from '../../domain/types/audit-entry.js';
import { AuditLogRecord, type AuditLogDocument } from '../schemas/audit-log.schema.js';

/** The cursor is not one this API issued. */
export class InvalidAuditCursorError extends Error {
  constructor() {
    super('Invalid audit cursor');
    this.name = 'InvalidAuditCursorError';
  }
}

function toRecord(document: AuditLogDocument): AuditRecord {
  return {
    id: document._id.toString(),
    action: document.action,
    resourceType: document.resourceType,
    resourceId: document.resourceId.toString(),
    createdAt: document.createdAt,
    ...(document.weddingId ? { weddingId: document.weddingId.toString() } : {}),
    ...(document.actorUserId ? { actorUserId: document.actorUserId.toString() } : {}),
    ...(document.metadata ? { metadata: document.metadata } : {}),
  };
}

/** Data access for `audit_logs`. */
@Injectable()
export class AuditLogsRepository {
  constructor(@InjectModel(AuditLogRecord.name) private readonly logs: Model<AuditLogRecord>) {}

  async create(entry: AuditEntry, transaction?: Transaction): Promise<void> {
    await this.logs.create(
      [
        {
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: new Types.ObjectId(entry.resourceId),
          ...(entry.weddingId ? { weddingId: new Types.ObjectId(entry.weddingId) } : {}),
          ...(entry.actorUserId ? { actorUserId: new Types.ObjectId(entry.actorUserId) } : {}),
          ...(entry.metadata ? { metadata: entry.metadata } : {}),
        },
      ],
      { session: sessionOf(transaction) },
    );
  }

  /**
   * A wedding's entries matching the filters, newest first, one page at a time (API Design
   * §7.1). Throws InvalidAuditCursorError for a cursor this API did not issue.
   */
  async listForWedding(weddingId: string, query: AuditListQuery): Promise<AuditPage> {
    const filter: Record<string, unknown> = { weddingId: new Types.ObjectId(weddingId) };
    if (query.action) filter.action = query.action;
    if (query.resourceType) filter.resourceType = query.resourceType;
    if (query.actorUserId) {
      if (!isValidObjectId(query.actorUserId)) return { records: [], nextCursor: null };
      filter.actorUserId = new Types.ObjectId(query.actorUserId);
    }
    const createdAt: Record<string, Date> = {};
    if (query.from) createdAt.$gte = query.from;
    if (query.to) createdAt.$lt = query.to;
    const conditions: Record<string, unknown>[] = [filter];
    // Operators are wrapped in trusted(): the connection sanitizes filters (database.module).
    if (query.from || query.to) conditions.push({ createdAt: trusted(createdAt) });
    if (query.cursor) {
      const position = decodeTimeCursor(query.cursor);
      if (!position) throw new InvalidAuditCursorError();
      conditions.push(afterTimeCursor(position));
    }
    const documents = await this.logs
      .find({ $and: conditions })
      .sort({ createdAt: -1, _id: -1 })
      .limit(query.limit + 1);
    const records = documents.slice(0, query.limit).map(toRecord);
    const last = records.at(-1);
    return {
      records,
      nextCursor:
        documents.length > query.limit && last
          ? encodeTimeCursor({ createdAt: last.createdAt, id: last.id })
          : null,
    };
  }

  /** A resource's entries, oldest first. */
  async listForResource(resourceType: string, resourceId: string): Promise<AuditRecord[]> {
    const documents = await this.logs
      .find({ resourceType, resourceId: new Types.ObjectId(resourceId) })
      .sort({ createdAt: 1, _id: 1 });
    return documents.map(toRecord);
  }
}
