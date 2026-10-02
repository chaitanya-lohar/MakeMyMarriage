import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';

/** `password_reset_tokens` collection (Database Design §6.3). Raw tokens are never stored. */
@Schema({ collection: 'password_reset_tokens', timestamps: { createdAt: true, updatedAt: false } })
export class PasswordResetTokenRecord {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop()
  usedAt?: Date;

  createdAt!: Date;
}

export type PasswordResetTokenDocument = HydratedDocument<PasswordResetTokenRecord>;
export const PasswordResetTokenSchema = SchemaFactory.createForClass(PasswordResetTokenRecord);
