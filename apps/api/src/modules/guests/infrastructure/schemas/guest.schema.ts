import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';

/** `guests` collection (Database Design §10.1). `mobile` is not unique (0017 #13). */
@Schema({ collection: 'guests', timestamps: true })
export class GuestRecord {
  @Prop({ type: Types.ObjectId, required: true })
  weddingId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  /** Normalized: separators removed, leading "+" kept. */
  @Prop({ required: true })
  mobile!: string;

  /** Trimmed and lower-cased. */
  @Prop()
  email?: string;

  @Prop()
  relation?: string;

  @Prop()
  notes?: string;

  @Prop({ type: Types.ObjectId, required: true })
  createdBy!: Types.ObjectId;

  @Prop()
  deletedAt?: Date;

  @Prop({ type: Types.ObjectId })
  deletedBy?: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export type GuestDocument = HydratedDocument<GuestRecord>;
export const GuestSchema = SchemaFactory.createForClass(GuestRecord);

// Database Design §20.
GuestSchema.index({ weddingId: 1, name: 1 });
GuestSchema.index({ weddingId: 1, mobile: 1 });
GuestSchema.index({ weddingId: 1, deletedAt: 1 });
