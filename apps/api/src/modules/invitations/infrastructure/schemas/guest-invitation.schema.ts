import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import { DELIVERY_STATUSES, type DeliveryStatus } from '../../domain/types/invitation.js';

/**
 * `guest_invitations` collection (Database Design §10.3, decision 0018): one per guest. The
 * current token is stored as a hash (lookup) and an encrypted copy, both removed on revoke.
 * There is no expiry in Phase 4 (0017 #8).
 */
@Schema({ collection: 'guest_invitations', timestamps: true })
export class GuestInvitationRecord {
  @Prop({ type: Types.ObjectId, required: true })
  weddingId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  guestId!: Types.ObjectId;

  @Prop()
  tokenHash?: string;

  @Prop()
  tokenCiphertext?: string;

  @Prop()
  tokenKeyVersion?: string;

  @Prop()
  tokenCreatedAt?: Date;

  @Prop()
  revokedAt?: Date;

  @Prop({ type: String, required: true, enum: DELIVERY_STATUSES })
  deliveryStatus!: DeliveryStatus;

  @Prop()
  lastSentAt?: Date;

  @Prop()
  firstOpenedAt?: Date;

  @Prop()
  lastOpenedAt?: Date;

  @Prop({ type: Types.ObjectId, required: true })
  createdBy!: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export type GuestInvitationDocument = HydratedDocument<GuestInvitationRecord>;
export const GuestInvitationSchema = SchemaFactory.createForClass(GuestInvitationRecord);

// Database Design §20.
GuestInvitationSchema.index({ guestId: 1 }, { unique: true });
GuestInvitationSchema.index(
  { tokenHash: 1 },
  { unique: true, partialFilterExpression: { tokenHash: { $exists: true } } },
);
