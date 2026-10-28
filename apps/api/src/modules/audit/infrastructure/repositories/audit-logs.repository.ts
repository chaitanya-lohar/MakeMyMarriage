import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, trusted, Types } from 'mongoose';
import { sessionOf, type Transaction } from '../../../../infrastructure/database/transaction.js';
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

interface AuditCursor {
  createdAt: Date;
  id: string;
}

function encodeAuditCursor(cursor: AuditCursor): string {
  return Buffer.from(JSON.stringify([cursor.createdAt.toISOString(), cursor.id])).toString(
    'base64url',
  );
}

/** The cursor's position, or null when it is not one this API issued. */
function decodeAuditCursor(value: string): AuditCursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string' &&
      isValidObjectId(parsed[1])
    ) {
      const createdAt = new Date(parsed[0]);
      if (!Number.isNaN(createdAt.getTime())) return { createdAt, id: parsed[1] };
    }
  } catch {
    // Falls through: malformed cursor.
  }
  return null;
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
      const position = decodeAuditCursor(query.cursor);
      if (!position) throw new InvalidAuditCursorError();
      conditions.push({
        $or: [
          { createdAt: trusted({ $lt: position.createdAt }) },
          {
            createdAt: position.createdAt,
            _id: trusted({ $lt: new Types.ObjectId(position.id) }),
          },
        ],
      });
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
          ? encodeAuditCursor({ createdAt: last.createdAt, id: last.id })
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
