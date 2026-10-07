import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import { MemberType, MembershipRole, MembershipStatus } from '../../domain/enums/membership.js';

/**
 * `wedding_memberships` collection (Database Design §7.2). Fields are added as the
 * features that use them are built (0010): ownerType, permission overrides and the
 * invitation fields arrive with organizers and partner connection.
 */
@Schema({ collection: 'wedding_memberships', timestamps: true })
export class WeddingMembershipRecord {
  @Prop({ type: Types.ObjectId, required: true })
  weddingId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  userId!: Types.ObjectId;

  // Explicit types: the enums are also const objects, which decorator metadata would report.
  @Prop({ type: String, required: true, enum: Object.values(MemberType) })
  memberType!: MemberType;

  @Prop({ type: String, required: true, enum: Object.values(MembershipRole) })
  role!: MembershipRole;

  @Prop({ type: String, required: true, enum: Object.values(MembershipStatus) })
  status!: MembershipStatus;

  @Prop()
  acceptedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type WeddingMembershipDocument = HydratedDocument<WeddingMembershipRecord>;
export const WeddingMembershipSchema = SchemaFactory.createForClass(WeddingMembershipRecord);

// One membership per user per wedding (Database Design §7.2).
WeddingMembershipSchema.index({ userId: 1, weddingId: 1 }, { unique: true });
// At most one OWNER membership per user across all weddings (0010 #18, decision 0012).
// Which statuses count after a partner disconnects is part of A5 (0011).
WeddingMembershipSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { memberType: MemberType.Owner },
    name: 'one_owner_membership_per_user',
  },
);
