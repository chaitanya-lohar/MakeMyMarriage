import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';

/**
 * `weddings` collection (Database Design §7.1, with brideName/groomName from 0010 #9 and
 * venueName from 0016). Cover image and theme arrive with the features that use them;
 * endDate is not used in V1.
 */
@Schema({ collection: 'weddings', timestamps: true })
export class WeddingRecord {
  @Prop({ required: true })
  displayName!: string;

  @Prop({ required: true })
  brideName!: string;

  @Prop({ required: true })
  groomName!: string;

  /** The wedding date, stored as midnight UTC of that calendar date. */
  @Prop()
  startDate?: Date;

  @Prop({ required: true })
  timezone!: string;

  @Prop()
  venueName?: string;

  @Prop()
  primaryCity?: string;

  @Prop()
  description?: string;

  @Prop({ type: Types.ObjectId, required: true })
  createdBy!: Types.ObjectId;

  @Prop()
  deletedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type WeddingDocument = HydratedDocument<WeddingRecord>;
export const WeddingSchema = SchemaFactory.createForClass(WeddingRecord);
