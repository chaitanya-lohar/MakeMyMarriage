import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { sessionOf, type Transaction } from '../../../../infrastructure/database/transaction.js';
import type { NewTaskActivity, TaskActivity } from '../../domain/types/task.js';
import { TaskActivityRecord, type TaskActivityDocument } from '../schemas/task-activity.schema.js';

/** Filters on ObjectId fields need ObjectIds: strings are not cast under sanitizeFilter. */
const oid = (id: string) => new Types.ObjectId(id);

function toActivity(document: TaskActivityDocument): TaskActivity {
  return {
    id: document._id.toString(),
    taskId: document.taskId.toString(),
    actorUserId: document.actorUserId.toString(),
    action: document.action,
    oldValue: document.oldValue ?? null,
    newValue: document.newValue ?? null,
    createdAt: document.createdAt,
  };
}

/** Data access for `task_activities` (Database Design §13.3). History is never rewritten. */
@Injectable()
export class TaskActivitiesRepository {
  constructor(
    @InjectModel(TaskActivityRecord.name)
    private readonly activities: Model<TaskActivityRecord>,
  ) {}

  async record(entries: NewTaskActivity[], transaction?: Transaction): Promise<void> {
    if (entries.length === 0) return;
    await this.activities.create(
      entries.map((entry) => ({
        weddingId: oid(entry.weddingId),
        taskId: oid(entry.taskId),
        actorUserId: oid(entry.actorUserId),
        action: entry.action,
        ...(entry.oldValue ? { oldValue: entry.oldValue } : {}),
        ...(entry.newValue ? { newValue: entry.newValue } : {}),
      })),
      { session: sessionOf(transaction), ordered: true },
    );
  }

  /** A task's history, newest first (Phase 7 PRD §5.5). */
  async listForTask(taskId: string): Promise<TaskActivity[]> {
    const documents = await this.activities
      .find({ taskId: oid(taskId) })
      .sort({ createdAt: -1, _id: -1 });
    return documents.map(toActivity);
  }
}
