import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditService } from './application/services/audit.service.js';
import { AuditLogsRepository } from './infrastructure/repositories/audit-logs.repository.js';
import { AuditLogRecord, AuditLogSchema } from './infrastructure/schemas/audit-log.schema.js';

/** Meaningful and security-sensitive history (System Design §6, Database Design §22). */
@Module({
  imports: [MongooseModule.forFeature([{ name: AuditLogRecord.name, schema: AuditLogSchema }])],
  providers: [AuditLogsRepository, AuditService],
  exports: [AuditService],
})
export class AuditModule {}
