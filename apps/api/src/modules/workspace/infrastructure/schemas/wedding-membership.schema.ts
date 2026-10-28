import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import { MemberType, MembershipRole, MembershipStatus } from '../../domain/enums/membership.js';
import {
  PermissionAction,
  PermissionEffect,
  PermissionModule,
} from '../../domain/enums/permission.js';
import { OWNER_SEATS, type OwnerSeat } from '../../domain/types/membership.js';

/** One `permissionOverrides` entry (Database Design §7.2, §8.4). */
@Schema({ _id: false })
export class PermissionOverrideRecord {
  @Prop({ type: String, required: true, enum: Object.values(PermissionModule) })
  module!: PermissionModule;

  @Prop({ type: String, required: true, enum: Object.values(PermissionAction) })
  action!: PermissionAction;

  @Prop({ type: String, required: true, enum: Object.values(PermissionEffect) })
  effect!: PermissionEffect;
}

const PermissionOverrideSchema = SchemaFactory.createForClass(PermissionOverrideRecord);

/**
 * `wedding_memberships` collection (Database Design §7.2). Fields are added as the
 * features that use them are built (0010): ownerType arrives with partner connection.
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

  /** 1 or 2, set exactly when memberType is OWNER (P10-5). */
  @Prop({ type: Number, enum: OWNER_SEATS })
  ownerSeat?: OwnerSeat;

  @Prop({ type: [PermissionOverrideSchema], default: undefined })
  permissionOverrides?: PermissionOverrideRecord[];

  @Prop({ type: Types.ObjectId })
  invitationId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  invitedBy?: Types.ObjectId;

  @Prop()
  invitedAt?: Date;

  @Prop()
  revokedAt?: Date;

  @Prop({ type: Types.ObjectId })
  revokedBy?: Types.ObjectId;

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
// At most two owners per wedding: each OWNER row holds seat 1 or 2 (P10-5). Existing owner
// rows get their seat from data migration 001 (decision 0034), which also creates this
// index; migrations run before any index build (Database Design §30), so it is never built
// over owner rows without a seat.
WeddingMembershipSchema.index(
  { weddingId: 1, ownerSeat: 1 },
  {
    unique: true,
    partialFilterExpression: { memberType: MemberType.Owner },
    name: 'owner_seat_per_wedding',
  },
);
// Member list and owner count (Database Design §20).
WeddingMembershipSchema.index({ weddingId: 1, status: 1, role: 1 });
