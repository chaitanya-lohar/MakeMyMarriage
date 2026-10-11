import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import { EVENT_TYPES, type EventType } from '../../domain/rules/event-rules.js';

@Schema({ _id: false })
export class EventVenueRecord {
  @Prop()
  name?: string;

  @Prop()
  address?: string;
}

const EventVenueSchema = SchemaFactory.createForClass(EventVenueRecord);

/**
 * `events` collection (Database Design §9, decision 0017). A date-only event has no time
 * fields (0017 #17). Map location, cover image, isPublic, instructions and publicId
 * arrive in later phases.
 */
@Schema({ collection: 'events', timestamps: true })
export class EventRecord {
  @Prop({ type: Types.ObjectId, required: true })
  weddingId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: String, required: true, enum: EVENT_TYPES })
  type!: EventType;

  @Prop()
  description?: string;

  /** Midnight UTC of the calendar date in the wedding's timezone. */
  @Prop({ required: true })
  date!: Date;

  @Prop()
  startTime?: string;

  @Prop()
  endTime?: string;

  @Prop({ required: true })
  timezone!: string;

  @Prop({ type: EventVenueSchema })
  venue?: EventVenueRecord;

  @Prop()
  dressCode?: string;

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

export type EventDocument = HydratedDocument<EventRecord>;
export const EventSchema = SchemaFactory.createForClass(EventRecord);

// Database Design §20.
EventSchema.index({ weddingId: 1, date: 1, startTime: 1 });
EventSchema.index({ weddingId: 1, deletedAt: 1 });
