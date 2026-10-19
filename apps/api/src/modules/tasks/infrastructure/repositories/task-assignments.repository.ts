import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, trusted, Types } from 'mongoose';
import { sessionOf, type Transaction } from '../../../../infrastructure/database/transaction.js';
import { TaskAssignmentRecord } from '../schemas/task-assignment.schema.js';

const DUPLICATE_KEY = 11000;

/** Filters on ObjectId fields need ObjectIds: strings are not cast under sanitizeFilter. */
const oid = (id: string) => new Types.ObjectId(id);

/** Data access for `task_assignments` (Database Design §13.2). */
@Injectable()
export class TaskAssignmentsRepository {
  constructor(
    @InjectModel(TaskAssignmentRecord.name)
    private readonly assignments: Model<TaskAssignmentRecord>,
  ) {}

  /** Each task's assignee user IDs, oldest assignment first. */
  async userIdsByTask(taskIds: string[]): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    if (taskIds.length === 0) return result;
    const documents = await this.assignments
      .find({ taskId: trusted({ $in: taskIds.map(oid) }) })
      .sort({ createdAt: 1, _id: 1 });
    for (const document of documents) {
      const taskId = document.taskId.toString();
      result.set(taskId, [...(result.get(taskId) ?? []), document.userId.toString()]);
    }
    return result;
  }

  /** IDs of the wedding's tasks assigned to this user ("Assigned to me"). */
  async taskIdsForUser(weddingId: string, userId: string): Promise<string[]> {
    const documents = await this.assignments.find(
      { weddingId: oid(weddingId), userId: oid(userId) },
      { taskId: 1 },
    );
    return documents.map((document) => document.taskId.toString());
  }

  /**
   * Assigns the user; false when they were already assigned (never twice — 0026 #13). Checked
   * first: inside a transaction a duplicate-key error would abort the whole transaction. The
   * unique index still guards against a concurrent duplicate.
   */
  async add(
    weddingId: string,
    taskId: string,
    userId: string,
    createdBy: string,
    transaction?: Transaction,
  ): Promise<boolean> {
    const session = sessionOf(transaction);
    const existing = await this.assignments
      .findOne({ taskId: oid(taskId), userId: oid(userId) }, { _id: 1 })
      .session(session ?? null);
    if (existing) return false;
    try {
      await this.assignments.create(
        [
          {
            weddingId: oid(weddingId),
            taskId: oid(taskId),
            userId: oid(userId),
            createdBy: oid(createdBy),
          },
        ],
        { session },
      );
      return true;
    } catch (error) {
      if (!transaction && (error as { code?: number }).code === DUPLICATE_KEY) return false;
      throw error;
    }
  }

  /** Removes the assignment; false when the user was not assigned. */
  async remove(taskId: string, userId: string, transaction?: Transaction): Promise<boolean> {
    const result = await this.assignments.deleteOne(
      { taskId: oid(taskId), userId: oid(userId) },
      { session: sessionOf(transaction) },
    );
    return result.deletedCount === 1;
  }
}
