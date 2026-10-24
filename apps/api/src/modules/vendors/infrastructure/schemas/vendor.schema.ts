import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import { VENDOR_CATEGORIES, type VendorCategory } from '../../domain/rules/vendor-rules.js';
@Schema({ collection: 'wedding_vendors', timestamps: true })
export class VendorRecord {
  @Prop({ type: Types.ObjectId, required: true }) weddingId!: Types.ObjectId;
  @Prop({ required: true, maxlength: 150 }) name!: string;
  @Prop({ type: String, required: true, enum: VENDOR_CATEGORIES }) category!: VendorCategory;
  @Prop({ maxlength: 150 }) contactPerson?: string;
  @Prop() phone?: string;
  @Prop({ maxlength: 254 }) email?: string;
  @Prop({ maxlength: 500 }) address?: string;
  @Prop({ maxlength: 500 }) website?: string;
  @Prop({ maxlength: 1000 }) notes?: string;
  @Prop({ type: Types.ObjectId, required: true }) createdBy!: Types.ObjectId;
  @Prop() deletedAt?: Date;
  @Prop({ type: Types.ObjectId }) deletedBy?: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;
}
export type VendorDocument = HydratedDocument<VendorRecord>;
export const VendorSchema = SchemaFactory.createForClass(VendorRecord);
VendorSchema.index(
  { weddingId: 1, deletedAt: 1, name: 1 },
  { collation: { locale: 'en', strength: 2 } },
);
VendorSchema.index({ weddingId: 1, category: 1 });
