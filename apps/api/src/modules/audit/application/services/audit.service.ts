import { Injectable } from '@nestjs/common';
import type { Transaction } from '../../../../infrastructure/database/transaction.js';
import type {
  AuditEntry,
  AuditListQuery,
  AuditPage,
  AuditRecord,
} from '../../domain/types/audit-entry.js';
import { AuditLogsRepository } from '../../infrastructure/repositories/audit-logs.repository.js';

/** The audit trail — the audit module's public API (Database Design §22). */
@Injectable()
export class AuditService {
  constructor(private readonly logs: AuditLogsRepository) {}

  /** Records an entry; pass the transaction when it must commit with the audited change. */
  record(entry: AuditEntry, transaction?: Transaction): Promise<void> {
    return this.logs.create(entry, transaction);
  }

  /**
   * A wedding's audit history, newest first, a page at a time (API Design §7.1). Throws
   * InvalidAuditCursorError for a cursor this API did not issue.
   */
  listForWedding(weddingId: string, query: AuditListQuery): Promise<AuditPage> {
    return this.logs.listForWedding(weddingId, query);
  }

  /** A resource's history, oldest first. */
  historyOf(resourceType: string, resourceId: string): Promise<AuditRecord[]> {
    return this.logs.listForResource(resourceType, resourceId);
  }
}
