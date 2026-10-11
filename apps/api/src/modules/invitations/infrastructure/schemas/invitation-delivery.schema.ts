import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import {
  AttemptStatus,
  DeliveryKind,
  type AttemptStatus as AttemptStatusValue,
  type DeliveryKind as DeliveryKindValue,
} from '../../domain/types/invitation.js';

/**
 * `invitation_deliveries` collection (Database Design §10.4): one record per send or resend
 * attempt. Records are never changed afterwards (0020).
 */
@Schema({ collection: 'invitation_deliveries', timestamps: { createdAt: true, updatedAt: false } })
export class InvitationDeliveryRecord {
  @Prop({ type: Types.ObjectId, required: true })
  weddingId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  guestInvitationId!: Types.ObjectId;

  @Prop({ required: true })
  channel!: string;

  @Prop({ required: true })
  attemptNumber!: number;

  @Prop({ type: String, required: true, enum: Object.values(DeliveryKind) })
  kind!: DeliveryKindValue;

  @Prop({ required: true })
  provider!: string;

  @Prop()
  providerMessageId?: string;

  @Prop({ type: String, required: true, enum: Object.values(AttemptStatus) })
  status!: AttemptStatusValue;

  /** Makes the send job safe to retry. */
  @Prop({ required: true })
  idempotencyKey!: string;

  @Prop()
  sentAt?: Date;

  @Prop()
  deliveredAt?: Date;

  @Prop()
  failedAt?: Date;

  @Prop()
  failureReason?: string;

  createdAt!: Date;
}

export type InvitationDeliveryDocument = HydratedDocument<InvitationDeliveryRecord>;
export const InvitationDeliverySchema = SchemaFactory.createForClass(InvitationDeliveryRecord);

// Database Design §20.
InvitationDeliverySchema.index({ guestInvitationId: 1, createdAt: 1 });
InvitationDeliverySchema.index({ idempotencyKey: 1 }, { unique: true });
InvitationDeliverySchema.index({ status: 1, createdAt: 1 });
