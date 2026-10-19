import { Injectable } from '@nestjs/common';
import { TransactionRunner } from '../../../../infrastructure/database/transaction.js';
import { MembershipsService } from '../../../workspace/index.js';
import { isEntityId } from '../../domain/rules/task-rules.js';
import { TaskActivityAction, type Task } from '../../domain/types/task.js';
import { TaskActivitiesRepository } from '../../infrastructure/repositories/task-activities.repository.js';
import { TaskAssignmentsRepository } from '../../infrastructure/repositories/task-assignments.repository.js';
import { TasksRepository } from '../../infrastructure/repositories/tasks.repository.js';
import { TasksErrors } from '../tasks-errors.js';

/**
 * Assigns and unassigns wedding members (API Design §13, decision 0026 #13). Assigning someone
 * already assigned, or unassigning someone who is not, changes nothing and records nothing.
 *
 * The task is checked inside the transaction, so an assignment racing a deletion is refused
 * rather than recorded after the task's DELETED entry (0026 #16).
 */
@Injectable()
export class TaskAssigneesUseCase {
  constructor(
    private readonly tasks: TasksRepository,
    private readonly assignments: TaskAssignmentsRepository,
    private readonly activities: TaskActivitiesRepository,
    private readonly memberships: MembershipsService,
    private readonly transactions: TransactionRunner,
  ) {}

  async assign(
    weddingId: string,
    taskId: string,
    userId: string,
    actorUserId: string,
  ): Promise<Task> {
    if (!(await this.memberships.findActive(userId, weddingId))) throw TasksErrors.memberNotFound();

    return this.transactions.run(async (transaction) => {
      const task = await this.tasks.findActive(weddingId, taskId, transaction);
      if (!task) throw TasksErrors.notFound();
      if (await this.assignments.add(weddingId, taskId, userId, actorUserId, transaction)) {
        await this.activities.record(
          [
            {
              weddingId,
              taskId,
              actorUserId,
              action: TaskActivityAction.AssigneeAdded,
              newValue: { userId },
            },
          ],
          transaction,
        );
      }
      return task;
    });
  }

  async unassign(
    weddingId: string,
    taskId: string,
    userId: string,
    actorUserId: string,
  ): Promise<Task> {
    // A malformed ID can never be assigned; report it like the other member lookups.
    if (!isEntityId(userId)) throw TasksErrors.memberNotFound();

    return this.transactions.run(async (transaction) => {
      const task = await this.tasks.findActive(weddingId, taskId, transaction);
      if (!task) throw TasksErrors.notFound();
      if (await this.assignments.remove(taskId, userId, transaction)) {
        await this.activities.record(
          [
            {
              weddingId,
              taskId,
              actorUserId,
              action: TaskActivityAction.AssigneeRemoved,
              oldValue: { userId },
            },
          ],
          transaction,
        );
      }
      return task;
    });
  }
}
