import { Injectable } from '@nestjs/common';
import { TransactionRunner } from '../../../../infrastructure/database/transaction.js';
import { AuditAction, AuditService } from '../../../audit/index.js';
import { EventsService } from '../../../events/index.js';
import { UsersService } from '../../../users/index.js';
import { todayIn, WeddingsService } from '../../../weddings/index.js';
import { weddingNotFound } from '../../../workspace/index.js';
import {
  TaskActivityAction,
  type Task,
  type TaskActivity,
  type TaskCounts,
  type TaskView,
} from '../../domain/types/task.js';
import { TaskActivitiesRepository } from '../../infrastructure/repositories/task-activities.repository.js';
import { TaskAssignmentsRepository } from '../../infrastructure/repositories/task-assignments.repository.js';
import { TasksRepository } from '../../infrastructure/repositories/tasks.repository.js';
import { TasksErrors } from '../tasks-errors.js';

/** A history entry with the name of the person who made it. */
export interface TaskActivityView {
  activity: TaskActivity;
  actorName: string;
  /** For assignee changes: the name of the person assigned or unassigned. */
  subjectName: string | null;
}

/** The user an assignee entry is about. */
function subjectOf(activity: TaskActivity): string | null {
  const value = activity.newValue?.userId ?? activity.oldValue?.userId;
  return typeof value === 'string' ? value : null;
}

/** The dashboard's task figures (Phase 7 PRD §8, decision 0026 #20). */
export interface TaskDashboard {
  counts: TaskCounts;
  upcoming: Task[];
  today: string;
  /** Any task that is not deleted, Cancelled included (0026 #20). */
  hasTasks: boolean;
}

/**
 * Task reads and deletion for the tasks controller, and the dashboard figures for the
 * dashboard module. Every method is scoped to one wedding; deleted tasks are never returned.
 */
@Injectable()
export class TasksService {
  constructor(
    private readonly tasks: TasksRepository,
    private readonly assignments: TaskAssignmentsRepository,
    private readonly activities: TaskActivitiesRepository,
    private readonly events: EventsService,
    private readonly users: UsersService,
    private readonly weddings: WeddingsService,
    private readonly audit: AuditService,
    private readonly transactions: TransactionRunner,
  ) {}

  /** Today in the wedding's timezone, which every overdue check uses (0026 #8). */
  async today(weddingId: string, now: Date = new Date()): Promise<string> {
    const wedding = await this.weddings.findById(weddingId);
    if (!wedding) throw weddingNotFound();
    return todayIn(wedding.timezone, now);
  }

  /** The active task, or TASK_NOT_FOUND. */
  async getActive(weddingId: string, taskId: string): Promise<Task> {
    const task = await this.tasks.findActive(weddingId, taskId);
    if (!task) throw TasksErrors.notFound();
    return task;
  }

  /** Tasks with their event names and assignees, in the given order. */
  async views(weddingId: string, tasks: Task[]): Promise<TaskView[]> {
    const [events, assigneeIds] = await Promise.all([
      this.events.listActive(weddingId),
      this.assignments.userIdsByTask(tasks.map((task) => task.id)),
    ]);
    const eventNames = new Map(events.map((event) => [event.id, event.name]));
    const users = await this.users.findManyByIds([...assigneeIds.values()].flat());
    const names = new Map(users.map((user) => [user.id, user.displayName]));
    return tasks.map((task) => ({
      task,
      eventName: task.eventId ? (eventNames.get(task.eventId) ?? null) : null,
      assignees: (assigneeIds.get(task.id) ?? []).map((userId) => ({
        userId,
        displayName: names.get(userId) ?? '',
      })),
    }));
  }

  async view(weddingId: string, task: Task): Promise<TaskView> {
    const [view] = await this.views(weddingId, [task]);
    return view as TaskView;
  }

  /** The task's history, newest first, with the names of the people who made it. */
  async history(weddingId: string, taskId: string): Promise<TaskActivityView[]> {
    await this.getActive(weddingId, taskId);
    const activities = await this.activities.listForTask(taskId);
    const users = await this.users.findManyByIds(
      activities.flatMap((activity) => [activity.actorUserId, subjectOf(activity) ?? []].flat()),
    );
    const names = new Map(users.map((user) => [user.id, user.displayName]));
    return activities.map((activity) => {
      const subject = subjectOf(activity);
      return {
        activity,
        actorName: names.get(activity.actorUserId) ?? '',
        subjectName: subject ? (names.get(subject) ?? '') : null,
      };
    });
  }

  /**
   * Soft-deletes the task after the client's confirmation. Its history is kept, a deletion
   * entry is added, and the deletion is audited (0026 #10, #17).
   */
  async delete(weddingId: string, taskId: string, userId: string): Promise<void> {
    const deleted = await this.transactions.run(async (transaction) => {
      if (!(await this.tasks.softDelete(weddingId, taskId, userId, transaction))) return false;
      await this.activities.record(
        [{ weddingId, taskId, actorUserId: userId, action: TaskActivityAction.Deleted }],
        transaction,
      );
      await this.audit.record(
        {
          weddingId,
          actorUserId: userId,
          action: AuditAction.TaskDeleted,
          resourceType: 'task',
          resourceId: taskId,
        },
        transaction,
      );
      return true;
    });
    if (!deleted) throw TasksErrors.notFound();
  }

  /** The dashboard's counts and upcoming tasks, computed on every request (0026 #20). */
  async dashboard(weddingId: string, now: Date = new Date()): Promise<TaskDashboard> {
    const today = await this.today(weddingId, now);
    const [counts, upcoming, hasTasks] = await Promise.all([
      this.tasks.counts(weddingId, today),
      this.tasks.upcoming(weddingId, today),
      this.tasks.exists(weddingId),
    ]);
    return { counts, upcoming, today, hasTasks };
  }
}
