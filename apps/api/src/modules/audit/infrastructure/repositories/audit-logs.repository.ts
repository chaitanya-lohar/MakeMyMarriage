import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { sessionOf, type Transaction } from '../../../../infrastructure/database/transaction.js';
import type { AuditEntry, AuditRecord } from '../../domain/types/audit-entry.js';
import { AuditLogRecord, type AuditLogDocument } from '../schemas/audit-log.schema.js';

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

  /** A resource's entries, oldest first. */
  async listForResource(resourceType: string, resourceId: string): Promise<AuditRecord[]> {
    const documents = await this.logs
      .find({ resourceType, resourceId: new Types.ObjectId(resourceId) })
      .sort({ createdAt: 1, _id: 1 });
    return documents.map(toRecord);
  }
}
