import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';

/** `task_assignments` collection (Database Design §13.2): one member per task at most once. */
@Schema({ collection: 'task_assignments', timestamps: { createdAt: true, updatedAt: false } })
export class TaskAssignmentRecord {
  @Prop({ type: Types.ObjectId, required: true })
  weddingId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  taskId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  createdBy!: Types.ObjectId;

  createdAt!: Date;
}

export type TaskAssignmentDocument = HydratedDocument<TaskAssignmentRecord>;
export const TaskAssignmentSchema = SchemaFactory.createForClass(TaskAssignmentRecord);

// Database Design §13.2, §26: no duplicate assignee; "my tasks".
TaskAssignmentSchema.index({ taskId: 1, userId: 1 }, { unique: true });
TaskAssignmentSchema.index({ userId: 1, weddingId: 1 });
