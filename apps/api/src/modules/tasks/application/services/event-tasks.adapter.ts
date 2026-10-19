import { Injectable } from '@nestjs/common';
import type { Transaction } from '../../../../infrastructure/database/transaction.js';
import { EventTasks } from '../../../events/index.js';
import { TaskActivityAction } from '../../domain/types/task.js';
import { TaskActivitiesRepository } from '../../infrastructure/repositories/task-activities.repository.js';
import { TasksRepository } from '../../infrastructure/repositories/tasks.repository.js';

/** The tasks module's side of the events module's EventTasks port (decision 0026 #12). */
@Injectable()
export class EventTasksAdapter extends EventTasks {
  constructor(
    private readonly tasks: TasksRepository,
    private readonly activities: TaskActivitiesRepository,
  ) {
    super();
  }

  async unlinkDeletedEvent(
    weddingId: string,
    eventId: string,
    actorUserId: string,
    transaction: Transaction,
  ): Promise<void> {
    const taskIds = await this.tasks.unlinkEvent(weddingId, eventId, transaction);
    await this.activities.record(
      taskIds.map((taskId) => ({
        weddingId,
        taskId,
        actorUserId,
        action: TaskActivityAction.EventDeleted,
        oldValue: { eventId },
      })),
      transaction,
    );
  }
}
