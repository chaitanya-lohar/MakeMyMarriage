import { Injectable } from '@nestjs/common';
import {
  TransactionRunner,
  type Transaction,
} from '../../../../infrastructure/database/transaction.js';
import { EventsService } from '../../../events/index.js';
import { MembershipsService } from '../../../workspace/index.js';
import {
  TaskActivityAction,
  type NewTaskActivity,
  type Task,
  type TaskChanges,
  type TaskDetails,
} from '../../domain/types/task.js';
import { TaskActivitiesRepository } from '../../infrastructure/repositories/task-activities.repository.js';
import { TaskAssignmentsRepository } from '../../infrastructure/repositories/task-assignments.repository.js';
import { TasksRepository } from '../../infrastructure/repositories/tasks.repository.js';
import { TasksErrors } from '../tasks-errors.js';

/** Fields whose old and new values are kept in the history; long texts only by name. */
const VALUE_FIELDS = ['title', 'priority', 'dueDate'] as const;
const TEXT_FIELDS = ['description', 'notes'] as const;

/**
 * Creates and edits tasks (Phase 7 PRD §5.1, decision 0026). The task, its assignees and its
 * history entries are saved in one transaction, so the history never misses a change.
 */
@Injectable()
export class SaveTaskUseCase {
  constructor(
    private readonly tasks: TasksRepository,
    private readonly assignments: TaskAssignmentsRepository,
    private readonly activities: TaskActivitiesRepository,
    private readonly events: EventsService,
    private readonly memberships: MembershipsService,
    private readonly transactions: TransactionRunner,
  ) {}

  async create(
    weddingId: string,
    userId: string,
    details: TaskDetails,
    assigneeIds: string[] = [],
  ): Promise<Task> {
    const eventName = await this.eventName(weddingId, details.eventId);
    const assignees = await this.members(weddingId, assigneeIds);

    return this.transactions.run(async (transaction) => {
      const task = await this.tasks.create(
        { ...details, weddingId, createdBy: userId },
        transaction,
      );
      const entries: NewTaskActivity[] = [
        { weddingId, taskId: task.id, actorUserId: userId, action: TaskActivityAction.Created },
      ];
      if (task.eventId) {
        entries.push({
          weddingId,
          taskId: task.id,
          actorUserId: userId,
          action: TaskActivityAction.EventChanged,
          newValue: { eventId: task.eventId, eventName },
        });
      }
      entries.push(
        ...(await this.addAssignees(weddingId, task.id, userId, assignees, transaction)),
      );
      await this.activities.record(entries, transaction);
      return task;
    });
  }

  /**
   * Applies the changes. `assigneeIds`, when given, is the complete new set of assignees.
   * Every real change becomes a history entry (0026 #15); any status may follow any other
   * (0026 #9).
   */
  async update(
    weddingId: string,
    taskId: string,
    userId: string,
    changes: TaskChanges,
    assigneeIds?: string[],
  ): Promise<Task> {
    const current = await this.tasks.findActive(weddingId, taskId);
    if (!current) throw TasksErrors.notFound();

    const eventChanged = changes.eventId !== undefined && changes.eventId !== current.eventId;
    const [oldEventName, newEventName] = eventChanged
      ? await Promise.all([
          this.knownEventName(weddingId, current.eventId),
          this.eventName(weddingId, changes.eventId ?? null),
        ])
      : [null, null];
    const wanted =
      assigneeIds === undefined ? undefined : await this.members(weddingId, assigneeIds);

    return this.transactions.run(async (transaction) => {
      const task = await this.tasks.update(weddingId, taskId, changes, transaction);
      if (!task) throw TasksErrors.notFound();
      const entry = (
        action: NewTaskActivity['action'],
        oldValue?: Record<string, unknown>,
        newValue?: Record<string, unknown>,
      ): NewTaskActivity => ({
        weddingId,
        taskId,
        actorUserId: userId,
        action,
        oldValue,
        newValue,
      });

      const entries: NewTaskActivity[] = [];
      const oldValues: Record<string, unknown> = {};
      const newValues: Record<string, unknown> = {};
      for (const field of VALUE_FIELDS) {
        if (current[field] !== task[field]) {
          oldValues[field] = current[field];
          newValues[field] = task[field];
        }
      }
      // Long texts are named, not copied, in the history.
      const textFields = TEXT_FIELDS.filter((field) => current[field] !== task[field]);
      if (Object.keys(newValues).length > 0 || textFields.length > 0) {
        entries.push(
          entry(TaskActivityAction.Updated, oldValues, { ...newValues, fields: textFields }),
        );
      }
      if (current.status !== task.status) {
        entries.push(
          entry(
            TaskActivityAction.StatusChanged,
            { status: current.status },
            { status: task.status },
          ),
        );
      }
      if (eventChanged) {
        entries.push(
          entry(
            TaskActivityAction.EventChanged,
            { eventId: current.eventId, eventName: oldEventName },
            { eventId: task.eventId, eventName: newEventName },
          ),
        );
      }
      if (wanted !== undefined) {
        entries.push(
          ...(await this.replaceAssignees(weddingId, taskId, userId, wanted, transaction)),
        );
      }
      await this.activities.record(entries, transaction);
      return task;
    });
  }

  /** The name of an active event of the wedding, or EVENT_NOT_FOUND (0026 #11). */
  private async eventName(weddingId: string, eventId: string | null): Promise<string | null> {
    if (eventId === null) return null;
    return (await this.events.getActive(weddingId, eventId)).name;
  }

  /** The current event's name for the history; null if it is gone. */
  private async knownEventName(weddingId: string, eventId: string | null): Promise<string | null> {
    if (eventId === null) return null;
    return (await this.events.findActive(weddingId, eventId))?.name ?? null;
  }

  /** The distinct IDs, each an active member of the wedding, or MEMBER_NOT_FOUND. */
  private async members(weddingId: string, userIds: string[]): Promise<string[]> {
    const unique = [...new Set(userIds)];
    for (const userId of unique) {
      if (!(await this.memberships.findActive(userId, weddingId)))
        throw TasksErrors.memberNotFound();
    }
    return unique;
  }

  private async addAssignees(
    weddingId: string,
    taskId: string,
    actorUserId: string,
    userIds: string[],
    transaction: Transaction,
  ): Promise<NewTaskActivity[]> {
    const entries: NewTaskActivity[] = [];
    for (const userId of userIds) {
      if (await this.assignments.add(weddingId, taskId, userId, actorUserId, transaction)) {
        entries.push({
          weddingId,
          taskId,
          actorUserId,
          action: TaskActivityAction.AssigneeAdded,
          newValue: { userId },
        });
      }
    }
    return entries;
  }

  private async replaceAssignees(
    weddingId: string,
    taskId: string,
    actorUserId: string,
    wanted: string[],
    transaction: Transaction,
  ): Promise<NewTaskActivity[]> {
    const current = (await this.assignments.userIdsByTask([taskId])).get(taskId) ?? [];
    const entries: NewTaskActivity[] = [];
    for (const userId of current.filter((id) => !wanted.includes(id))) {
      if (await this.assignments.remove(taskId, userId, transaction)) {
        entries.push({
          weddingId,
          taskId,
          actorUserId,
          action: TaskActivityAction.AssigneeRemoved,
          oldValue: { userId },
        });
      }
    }
    const added = wanted.filter((id) => !current.includes(id));
    entries.push(...(await this.addAssignees(weddingId, taskId, actorUserId, added, transaction)));
    return entries;
  }
}
