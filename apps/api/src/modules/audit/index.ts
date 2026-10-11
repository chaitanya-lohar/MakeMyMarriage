// Public entry point of the audit module (decision 0006).
export { AuditService } from './application/services/audit.service.js';
export { AuditAction, type AuditEntry, type AuditRecord } from './domain/types/audit-entry.js';
export { AuditModule } from './audit.module.js';
