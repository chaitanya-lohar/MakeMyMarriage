import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import {
  PartnerConnectionStatus,
  type PartnerConnectionStatus as Status,
} from '../../domain/types/partner-connection.js';

/**
 * `partner_connections` collection (Database Design §7.3, decision 0038): one record per
 * partner invitation, which becomes the connection on acceptance. The raw token is never
 * stored, only its SHA-256 hash. Records are never deleted.
 */
@Schema({ collection: 'partner_connections', timestamps: true })
export class PartnerConnectionRecord {
  @Prop({ type: Types.ObjectId, required: true })
  weddingId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: Object.values(PartnerConnectionStatus) })
  status!: Status;

  /** Set while PENDING or ACTIVE, unset otherwise (the partial unique index below). */
  @Prop()
  open?: boolean;

  /** Trimmed and lower-cased. */
  @Prop({ required: true })
  inviteeEmail!: string;

  @Prop({ required: true })
  tokenHash!: string;

  /** Seven days after the last send (D4). */
  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ required: true })
  lastSentAt!: Date;

  /** Whether the last send succeeded. */
  @Prop({ required: true, default: false })
  emailSent!: boolean;

  /** The latest resend times, oldest first, at most three kept. */
  @Prop({ type: [Date], default: undefined })
  resentAt?: Date[];

  @Prop({ type: Types.ObjectId, required: true })
  inviterUserId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  inviteeUserId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  membershipId?: Types.ObjectId;

  @Prop()
  acceptedAt?: Date;

  @Prop()
  respondedAt?: Date;

  @Prop()
  revokedAt?: Date;

  @Prop({ type: Types.ObjectId })
  revokedBy?: Types.ObjectId;

  @Prop()
  expiredAt?: Date;

  @Prop()
  disconnectedAt?: Date;

  @Prop({ type: Types.ObjectId })
  disconnectedBy?: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export type PartnerConnectionDocument = HydratedDocument<PartnerConnectionRecord>;
export const PartnerConnectionSchema = SchemaFactory.createForClass(PartnerConnectionRecord);

// Token lookup; at most one pending or active connection per wedding; the latest record
// (Database Design §20).
PartnerConnectionSchema.index({ tokenHash: 1 }, { unique: true });
PartnerConnectionSchema.index(
  { weddingId: 1 },
  {
    unique: true,
    partialFilterExpression: { open: true },
    name: 'one_open_partner_connection',
  },
);
PartnerConnectionSchema.index({ weddingId: 1, createdAt: -1 });
