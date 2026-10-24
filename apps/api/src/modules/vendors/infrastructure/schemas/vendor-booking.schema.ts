import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import { BOOKING_STATUSES, type BookingStatus } from '../../domain/rules/vendor-rules.js';
@Schema({ collection: 'vendor_bookings', timestamps: true })
export class VendorBookingRecord {
  @Prop({ type: Types.ObjectId, required: true }) weddingId!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true }) vendorId!: Types.ObjectId;
  @Prop({ required: true, maxlength: 150 }) title!: string;
  @Prop({ type: String, required: true, enum: BOOKING_STATUSES, default: 'NOT_CONTACTED' })
  status!: BookingStatus;
  @Prop() bookingDate?: Date;
  @Prop() serviceDate?: Date;
  @Prop({ type: Types.ObjectId }) eventId?: Types.ObjectId;
  @Prop({ min: 1, max: 10_000_000_000 }) agreedPriceMinor?: number;
  @Prop({ maxlength: 1000 }) notes?: string;
  @Prop({ type: Types.ObjectId, required: true }) createdBy!: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;
}
export type VendorBookingDocument = HydratedDocument<VendorBookingRecord>;
export const VendorBookingSchema = SchemaFactory.createForClass(VendorBookingRecord);
VendorBookingSchema.index({ weddingId: 1, vendorId: 1 });
VendorBookingSchema.index({ weddingId: 1, status: 1, serviceDate: 1 });
VendorBookingSchema.index({ weddingId: 1, eventId: 1 });
