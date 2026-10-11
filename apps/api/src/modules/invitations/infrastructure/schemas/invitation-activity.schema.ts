import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import {
  ActivityType,
  type ActivityType as ActivityTypeValue,
} from '../../domain/types/invitation.js';

/**
 * `invitation_activities` collection (Database Design §10.5). Every open is stored; opens are
 * history, never a delivery status (0017 #9).
 */
@Schema({ collection: 'invitation_activities', timestamps: { createdAt: true, updatedAt: false } })
export class InvitationActivityRecord {
  @Prop({ type: Types.ObjectId, required: true })
  weddingId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  guestInvitationId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: Object.values(ActivityType) })
  type!: ActivityTypeValue;

  @Prop({ required: true })
  occurredAt!: Date;

  createdAt!: Date;
}

export type InvitationActivityDocument = HydratedDocument<InvitationActivityRecord>;
export const InvitationActivitySchema = SchemaFactory.createForClass(InvitationActivityRecord);

// Database Design §20.
InvitationActivitySchema.index({ guestInvitationId: 1, occurredAt: 1 });
