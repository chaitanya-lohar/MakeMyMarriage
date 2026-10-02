import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';

/** `auth_sessions` collection (Database Design §6.2). Only the refresh-token hash is stored. */
@Schema({ collection: 'auth_sessions', timestamps: { createdAt: true, updatedAt: false } })
export class AuthSessionRecord {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  refreshTokenHash!: string;

  @Prop({ type: Object })
  deviceInfo?: Record<string, unknown>;

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop({ required: true })
  lastUsedAt!: Date;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop()
  revokedAt?: Date;

  createdAt!: Date;
}

export type AuthSessionDocument = HydratedDocument<AuthSessionRecord>;
export const AuthSessionSchema = SchemaFactory.createForClass(AuthSessionRecord);
