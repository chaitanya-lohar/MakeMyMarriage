import { Injectable } from '@nestjs/common';
import { EventsService } from '../../../events/index.js';
import type { TaskListQuery, TaskPage } from '../../domain/types/task.js';
import { TaskAssignmentsRepository } from '../../infrastructure/repositories/task-assignments.repository.js';
import {
  decodeTaskCursor,
  TasksRepository,
} from '../../infrastructure/repositories/tasks.repository.js';
import { TasksErrors } from '../tasks-errors.js';

/**
 * Lists, filters and searches tasks (Phase 7 PRD §6, API Design §13). The event filter takes
 * an active event of the wedding, or `none` for whole-wedding tasks.
 */
@Injectable()
export class ListTasksUseCase {
  constructor(
    private readonly tasks: TasksRepository,
    private readonly assignments: TaskAssignmentsRepository,
    private readonly events: EventsService,
  ) {}

  async execute(weddingId: string, query: TaskListQuery): Promise<TaskPage> {
    const cursor = query.cursor === undefined ? undefined : decodeTaskCursor(query.cursor);
    if (cursor === null) throw TasksErrors.invalidCursor();

    if (query.eventId !== undefined && query.eventId !== 'none') {
      await this.events.getActive(weddingId, query.eventId);
    }

    let taskIds: string[] | undefined;
    if (query.assignedTo !== undefined) {
      taskIds = await this.assignments.taskIdsForUser(weddingId, query.assignedTo);
      if (taskIds.length === 0) return { tasks: [], nextCursor: null };
    }

    return this.tasks.list(weddingId, {
      statuses: query.statuses,
      priority: query.priority,
      eventId: query.eventId,
      overdue: query.overdue,
      search: query.search,
      limit: query.limit,
      today: query.today,
      cursor,
      taskIds,
    });
  }
}
