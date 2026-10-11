import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import { RSVP_STATUSES, type RsvpStatus } from '../../domain/rules/rsvp-rules.js';

/**
 * `guest_events` collection (Database Design §10.2): a guest's assignment to an event and
 * its RSVP. There is no invitation status here (0008). Removing an assignment keeps it with
 * `isActive: false` (0017 #18).
 */
@Schema({ collection: 'guest_events', timestamps: true })
export class GuestEventRecord {
  @Prop({ type: Types.ObjectId, required: true })
  weddingId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  guestId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  eventId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: RSVP_STATUSES })
  rsvpStatus!: RsvpStatus;

  @Prop({ type: Number, default: null })
  attendeeCount!: number | null;

  /** Last guest response. */
  @Prop()
  respondedAt?: Date;

  /** Organizer who last changed the RSVP. */
  @Prop({ type: Types.ObjectId })
  rsvpUpdatedBy?: Types.ObjectId;

  @Prop()
  rsvpUpdatedAt?: Date;

  @Prop({ required: true })
  isActive!: boolean;

  @Prop()
  removedAt?: Date;

  @Prop({ type: Types.ObjectId })
  removedBy?: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export type GuestEventDocument = HydratedDocument<GuestEventRecord>;
export const GuestEventSchema = SchemaFactory.createForClass(GuestEventRecord);

// At most one active assignment per guest and event (Database Design §10.2, §20).
GuestEventSchema.index(
  { weddingId: 1, guestId: 1, eventId: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
    name: 'one_active_assignment_per_guest_event',
  },
);
// Event RSVP counts and filters (Database Design §20).
GuestEventSchema.index({ weddingId: 1, eventId: 1, rsvpStatus: 1 });
