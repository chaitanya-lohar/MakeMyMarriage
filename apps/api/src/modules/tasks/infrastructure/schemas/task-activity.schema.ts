import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import { TaskActivityAction } from '../../domain/types/task.js';

/**
 * `task_activities` collection (Database Design §13.3, decision 0026 #15): the history of a
 * task, kept after the task is deleted (0026 #16).
 */
@Schema({ collection: 'task_activities', timestamps: { createdAt: true, updatedAt: false } })
export class TaskActivityRecord {
  @Prop({ type: Types.ObjectId, required: true })
  weddingId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  taskId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  actorUserId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: Object.values(TaskActivityAction) })
  action!: TaskActivityAction;

  @Prop({ type: Object })
  oldValue?: Record<string, unknown>;

  @Prop({ type: Object })
  newValue?: Record<string, unknown>;

  createdAt!: Date;
}

export type TaskActivityDocument = HydratedDocument<TaskActivityRecord>;
export const TaskActivitySchema = SchemaFactory.createForClass(TaskActivityRecord);

// Database Design §26.
TaskActivitySchema.index({ taskId: 1, createdAt: 1 });
