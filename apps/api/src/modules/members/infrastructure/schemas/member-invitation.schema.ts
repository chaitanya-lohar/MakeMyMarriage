import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import { PermissionAction, PermissionEffect, PermissionModule } from '../../../workspace/index.js';
import { ASSIGNABLE_ROLES, type AssignableRole } from '../../domain/rules/member-authority.js';
import {
  MemberInvitationStatus,
  type MemberInvitationStatus as Status,
} from '../../domain/types/member-invitation.js';

@Schema({ _id: false })
class InvitationOverrideRecord {
  @Prop({ type: String, required: true, enum: Object.values(PermissionModule) })
  module!: PermissionModule;

  @Prop({ type: String, required: true, enum: Object.values(PermissionAction) })
  action!: PermissionAction;

  @Prop({ type: String, required: true, enum: Object.values(PermissionEffect) })
  effect!: PermissionEffect;
}

/**
 * `member_invitations` collection (Database Design §7.5): an organizer invitation by email.
 * The raw token is never stored, only its SHA-256 hash.
 */
@Schema({ collection: 'member_invitations', timestamps: true })
export class MemberInvitationRecord {
  @Prop({ type: Types.ObjectId, required: true })
  weddingId!: Types.ObjectId;

  /** Trimmed and lower-cased. */
  @Prop({ required: true })
  email!: string;

  @Prop({ type: String, required: true, enum: ASSIGNABLE_ROLES })
  role!: AssignableRole;

  @Prop({ type: [SchemaFactory.createForClass(InvitationOverrideRecord)], default: undefined })
  permissionOverrides?: InvitationOverrideRecord[];

  @Prop()
  message?: string;

  @Prop({ type: String, required: true, enum: Object.values(MemberInvitationStatus) })
  status!: Status;

  @Prop({ required: true })
  tokenHash!: string;

  /** The current token's issue time + 7 days (P10-2, 0034 R5). */
  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ type: Types.ObjectId, required: true })
  invitedBy!: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  acceptedByUserId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  membershipId?: Types.ObjectId;

  @Prop()
  respondedAt?: Date;

  @Prop()
  revokedAt?: Date;

  @Prop({ type: Types.ObjectId })
  revokedBy?: Types.ObjectId;

  @Prop()
  expiredAt?: Date;

  @Prop()
  lastSentAt?: Date;

  /** The latest resend times, oldest first, at most three kept (0034 R2). */
  @Prop({ type: [Date], default: undefined })
  resentAt?: Date[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type MemberInvitationDocument = HydratedDocument<MemberInvitationRecord>;
export const MemberInvitationSchema = SchemaFactory.createForClass(MemberInvitationRecord);

// Token lookup; one pending invitation per wedding and email; the invitation list
// (Database Design §20).
MemberInvitationSchema.index({ tokenHash: 1 }, { unique: true });
MemberInvitationSchema.index(
  { weddingId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { status: MemberInvitationStatus.Pending },
    name: 'one_pending_member_invitation_per_email',
  },
);
MemberInvitationSchema.index({ weddingId: 1, status: 1, createdAt: -1 });
