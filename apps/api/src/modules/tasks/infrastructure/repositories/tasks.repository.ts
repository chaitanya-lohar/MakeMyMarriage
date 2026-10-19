import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, trusted, Types, type PipelineStage } from 'mongoose';
import { sessionOf, type Transaction } from '../../../../infrastructure/database/transaction.js';
import {
  addDays,
  CLOSED_STATUSES,
  PRIORITY_RANK,
  TaskStatus,
  UPCOMING_TASKS_DAYS,
  UPCOMING_TASKS_LIMIT,
  type TaskPriority,
} from '../../domain/rules/task-rules.js';
import type {
  NewTask,
  Task,
  TaskChanges,
  TaskCounts,
  TaskListQuery,
  TaskPage,
} from '../../domain/types/task.js';
import { TaskRecord, type TaskDocument } from '../schemas/task.schema.js';

/** Filters on ObjectId fields need ObjectIds: strings are not cast under sanitizeFilter. */
const oid = (id: string) => new Types.ObjectId(id);

// Server-built operator; `trusted` exempts it from the global sanitizeFilter.
const notDeleted = () => ({ deletedAt: trusted({ $exists: false }) });

const OPTIONAL_TEXT = ['description', 'notes'] as const;

/** Undated tasks sort after every dated one (0026 #18). */
const UNDATED = new Date('9999-12-31T00:00:00.000Z');

function toStoredDate(calendarDate: string): Date {
  return new Date(`${calendarDate}T00:00:00.000Z`);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface TaskShape {
  _id: Types.ObjectId;
  weddingId: Types.ObjectId;
  title: string;
  description?: string;
  notes?: string;
  status: Task['status'];
  priority: TaskPriority;
  dueDate?: Date;
  eventId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

function toTask(document: TaskShape | TaskDocument): Task {
  return {
    id: document._id.toString(),
    weddingId: document.weddingId.toString(),
    title: document.title,
    description: document.description ?? null,
    notes: document.notes ?? null,
    status: document.status,
    priority: document.priority,
    dueDate: document.dueDate ? document.dueDate.toISOString().slice(0, 10) : null,
    eventId: document.eventId ? document.eventId.toString() : null,
    createdBy: document.createdBy.toString(),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

/** List order (0026 #18): due date, undated last; then Urgent → Low; then newest first. */
const ORDER_FIELDS: PipelineStage = {
  $addFields: {
    dueKey: { $ifNull: ['$dueDate', UNDATED] },
    rank: {
      $switch: {
        branches: Object.entries(PRIORITY_RANK).map(([priority, rank]) => ({
          case: { $eq: ['$priority', priority] },
          then: rank,
        })),
        default: 0,
      },
    },
  },
};
const ORDER = { dueKey: 1, rank: -1, createdAt: -1, _id: -1 } as const;

interface Cursor {
  dueKey: Date;
  rank: number;
  createdAt: Date;
  id: string;
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(
    JSON.stringify([
      cursor.dueKey.toISOString(),
      cursor.rank,
      cursor.createdAt.toISOString(),
      cursor.id,
    ]),
  ).toString('base64url');
}

/** The cursor's position, or null when it is not one this API issued. */
export function decodeTaskCursor(value: string): Cursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      Array.isArray(parsed) &&
      parsed.length === 4 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'number' &&
      typeof parsed[2] === 'string' &&
      typeof parsed[3] === 'string' &&
      isValidObjectId(parsed[3])
    ) {
      const dueKey = new Date(parsed[0]);
      const createdAt = new Date(parsed[2]);
      if (!Number.isNaN(dueKey.getTime()) && !Number.isNaN(createdAt.getTime())) {
        return { dueKey, rank: parsed[1], createdAt, id: parsed[3] };
      }
    }
  } catch {
    // Falls through: malformed cursor.
  }
  return null;
}

export interface TaskListFilter extends Omit<TaskListQuery, 'cursor' | 'assignedTo'> {
  cursor?: Cursor;
  /** Restricts the list to these tasks ("assigned to me"). */
  taskIds?: string[];
}

/** Data access for `tasks`, always scoped to one wedding. Deleted tasks are never returned. */
@Injectable()
export class TasksRepository {
  constructor(@InjectModel(TaskRecord.name) private readonly tasks: Model<TaskRecord>) {}

  async create(task: NewTask, transaction?: Transaction): Promise<Task> {
    const [document] = await this.tasks.create(
      [
        {
          weddingId: oid(task.weddingId),
          title: task.title,
          status: task.status,
          priority: task.priority,
          createdBy: oid(task.createdBy),
          ...(task.description ? { description: task.description } : {}),
          ...(task.notes ? { notes: task.notes } : {}),
          ...(task.dueDate ? { dueDate: toStoredDate(task.dueDate) } : {}),
          ...(task.eventId ? { eventId: oid(task.eventId) } : {}),
        },
      ],
      { session: sessionOf(transaction) },
    );
    return toTask(document as TaskDocument);
  }

  async findActive(weddingId: string, taskId: string): Promise<Task | null> {
    if (!isValidObjectId(taskId)) return null;
    const document = await this.tasks.findOne({
      _id: oid(taskId),
      weddingId: oid(weddingId),
      ...notDeleted(),
    });
    return document ? toTask(document) : null;
  }

  /** Applies the changes; a null optional field is removed. Returns null if not found. */
  async update(
    weddingId: string,
    taskId: string,
    changes: TaskChanges,
    transaction?: Transaction,
  ): Promise<Task | null> {
    if (!isValidObjectId(taskId)) return null;
    const set: Record<string, unknown> = {};
    const unset: Record<string, ''> = {};
    if (changes.title !== undefined) set.title = changes.title;
    if (changes.status !== undefined) set.status = changes.status;
    if (changes.priority !== undefined) set.priority = changes.priority;
    for (const key of OPTIONAL_TEXT) {
      const value = changes[key];
      if (value === undefined) continue;
      if (value === null || value === '') unset[key] = '';
      else set[key] = value;
    }
    if (changes.dueDate !== undefined) {
      if (changes.dueDate === null) unset.dueDate = '';
      else set.dueDate = toStoredDate(changes.dueDate);
    }
    if (changes.eventId !== undefined) {
      if (changes.eventId === null) unset.eventId = '';
      else set.eventId = oid(changes.eventId);
    }

    const document = await this.tasks.findOneAndUpdate(
      { _id: oid(taskId), weddingId: oid(weddingId), ...notDeleted() },
      {
        ...(Object.keys(set).length > 0 ? { $set: set } : {}),
        ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
      },
      { returnDocument: 'after', session: sessionOf(transaction) },
    );
    return document ? toTask(document) : null;
  }

  /** Soft-deletes the task; its assignments and history are kept (0026 #10). */
  async softDelete(
    weddingId: string,
    taskId: string,
    deletedBy: string,
    transaction?: Transaction,
  ): Promise<boolean> {
    if (!isValidObjectId(taskId)) return false;
    const result = await this.tasks.updateOne(
      { _id: oid(taskId), weddingId: oid(weddingId), ...notDeleted() },
      { $set: { deletedAt: new Date(), deletedBy: oid(deletedBy) } },
      { session: sessionOf(transaction) },
    );
    return result.modifiedCount === 1;
  }

  /** A page of the list, in list order, after the cursor (API Design §13, §24). */
  async list(weddingId: string, filter: TaskListFilter): Promise<TaskPage> {
    const match: Record<string, unknown> = {
      weddingId: oid(weddingId),
      deletedAt: { $exists: false },
      status: { $in: filter.statuses },
    };
    if (filter.priority) match.priority = filter.priority;
    if (filter.eventId === 'none') match.eventId = { $exists: false };
    else if (filter.eventId) match.eventId = oid(filter.eventId);
    if (filter.overdue) {
      match.dueDate = { $lt: toStoredDate(filter.today) };
      match.status = {
        $in: filter.statuses.filter((status) => !CLOSED_STATUSES.includes(status)),
      };
    }
    if (filter.taskIds) match._id = { $in: filter.taskIds.map(oid) };
    const search = filter.search?.trim();
    if (search) match.title = { $regex: escapeRegex(search), $options: 'i' };

    const pipeline: PipelineStage[] = [{ $match: match }, ORDER_FIELDS];
    const { cursor } = filter;
    if (cursor) {
      const after = oid(cursor.id);
      pipeline.push({
        $match: {
          $or: [
            { dueKey: { $gt: cursor.dueKey } },
            { dueKey: cursor.dueKey, rank: { $lt: cursor.rank } },
            { dueKey: cursor.dueKey, rank: cursor.rank, createdAt: { $lt: cursor.createdAt } },
            {
              dueKey: cursor.dueKey,
              rank: cursor.rank,
              createdAt: cursor.createdAt,
              _id: { $lt: after },
            },
          ],
        },
      });
    }
    pipeline.push({ $sort: ORDER }, { $limit: filter.limit + 1 });

    const rows = await this.tasks.aggregate<TaskShape & { dueKey: Date; rank: number }>(pipeline);
    const page = rows.slice(0, filter.limit);
    const last = page.at(-1);
    return {
      tasks: page.map(toTask),
      nextCursor:
        rows.length > filter.limit && last
          ? encodeCursor({
              dueKey: last.dueKey,
              rank: last.rank,
              createdAt: last.createdAt,
              id: last._id.toString(),
            })
          : null,
    };
  }

  /** Dashboard counts over tasks that are not deleted (0013, 0026 #20). */
  async counts(weddingId: string, today: string): Promise<TaskCounts> {
    const [byStatus, overdue] = await Promise.all([
      this.tasks.aggregate<{ _id: string; count: number }>([
        { $match: { weddingId: oid(weddingId), deletedAt: { $exists: false } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.tasks.countDocuments({
        weddingId: oid(weddingId),
        ...notDeleted(),
        dueDate: trusted({ $lt: toStoredDate(today) }),
        status: trusted({ $nin: CLOSED_STATUSES }),
      }),
    ]);
    const count = (status: string) => byStatus.find((row) => row._id === status)?.count ?? 0;
    return {
      pending: count(TaskStatus.Todo) + count(TaskStatus.InProgress),
      blocked: count(TaskStatus.Blocked),
      completed: count(TaskStatus.Completed),
      overdue,
    };
  }

  /**
   * Upcoming tasks for the dashboard (0026 #20): open tasks due up to seven days after today,
   * which includes every overdue task; by due date (so overdue first), then priority. At most
   * five; undated tasks never appear.
   */
  async upcoming(weddingId: string, today: string): Promise<Task[]> {
    const rows = await this.tasks.aggregate<TaskShape>([
      {
        $match: {
          weddingId: oid(weddingId),
          deletedAt: { $exists: false },
          status: { $nin: CLOSED_STATUSES },
          dueDate: { $lte: toStoredDate(addDays(today, UPCOMING_TASKS_DAYS)) },
        },
      },
      ORDER_FIELDS,
      { $sort: ORDER },
      { $limit: UPCOMING_TASKS_LIMIT },
    ]);
    return rows.map(toTask);
  }

  /**
   * Makes every task linked to a deleted event a whole-wedding task (0026 #12). Returns the
   * IDs of the tasks it changed.
   */
  async unlinkEvent(
    weddingId: string,
    eventId: string,
    transaction: Transaction,
  ): Promise<string[]> {
    const filter = { weddingId: oid(weddingId), eventId: oid(eventId), ...notDeleted() };
    const session = sessionOf(transaction);
    const documents = await this.tasks.find(filter, { _id: 1 }, { session });
    if (documents.length === 0) return [];
    await this.tasks.updateMany(filter, { $unset: { eventId: '' } }, { session });
    return documents.map((document) => (document._id as Types.ObjectId).toString());
  }
}
