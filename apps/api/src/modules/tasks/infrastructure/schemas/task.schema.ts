import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from '../../domain/rules/task-rules.js';

/**
 * `tasks` collection (Database Design §13.1, decision 0026). Attachments are deferred
 * (0026 #3).
 */
@Schema({ collection: 'tasks', timestamps: true })
export class TaskRecord {
  @Prop({ type: Types.ObjectId, required: true })
  weddingId!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop()
  description?: string;

  @Prop()
  notes?: string;

  @Prop({ type: String, required: true, enum: TASK_STATUSES })
  status!: TaskStatus;

  @Prop({ type: String, required: true, enum: TASK_PRIORITIES })
  priority!: TaskPriority;

  /** Midnight UTC of the calendar date in the wedding's timezone, as for events. */
  @Prop()
  dueDate?: Date;

  /** Absent for a whole-wedding task. */
  @Prop({ type: Types.ObjectId })
  eventId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  createdBy!: Types.ObjectId;

  @Prop()
  deletedAt?: Date;

  @Prop({ type: Types.ObjectId })
  deletedBy?: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export type TaskDocument = HydratedDocument<TaskRecord>;
export const TaskSchema = SchemaFactory.createForClass(TaskRecord);

// Database Design §13, §26.
TaskSchema.index({ weddingId: 1, status: 1 });
TaskSchema.index({ weddingId: 1, priority: 1 });
TaskSchema.index({ weddingId: 1, dueDate: 1 });
TaskSchema.index({ weddingId: 1, eventId: 1 });
