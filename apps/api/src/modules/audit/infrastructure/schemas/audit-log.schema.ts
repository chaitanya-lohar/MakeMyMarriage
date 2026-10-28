import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import { AuditAction } from '../../domain/types/audit-entry.js';

/** `audit_logs` collection (Database Design §22). Entries are append-only. */
@Schema({ collection: 'audit_logs', timestamps: { createdAt: true, updatedAt: false } })
export class AuditLogRecord {
  @Prop({ type: Types.ObjectId })
  weddingId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  actorUserId?: Types.ObjectId;

  @Prop({ type: String, required: true, enum: Object.values(AuditAction) })
  action!: AuditAction;

  @Prop({ required: true })
  resourceType!: string;

  @Prop({ type: Types.ObjectId, required: true })
  resourceId!: Types.ObjectId;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  createdAt!: Date;
}

export type AuditLogDocument = HydratedDocument<AuditLogRecord>;
export const AuditLogSchema = SchemaFactory.createForClass(AuditLogRecord);

// A resource's history, newest first.
AuditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
// A wedding's audit history, newest first (Phase 10, Database Design §20).
AuditLogSchema.index({ weddingId: 1, createdAt: -1, _id: -1 });
