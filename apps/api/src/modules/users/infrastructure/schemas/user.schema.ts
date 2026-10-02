import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { UserStatus } from '../../domain/enums/user-status.js';

/** `users` collection (Database Design §6.1). */
@Schema({ collection: 'users', timestamps: true })
export class UserRecord {
  @Prop({ required: true, unique: true })
  email!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ required: true })
  displayName!: string;

  @Prop()
  phoneNumber?: string;

  // Explicit type: `UserStatus` is also a const object, which decorator metadata would report.
  @Prop({
    type: String,
    required: true,
    enum: Object.values(UserStatus),
    default: UserStatus.Active,
  })
  status!: UserStatus;

  @Prop()
  deletedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type UserDocument = HydratedDocument<UserRecord>;
export const UserSchema = SchemaFactory.createForClass(UserRecord);
