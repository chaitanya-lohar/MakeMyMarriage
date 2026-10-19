import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/index.js';
import { EventsModule, EventTasks } from '../events/index.js';
import { UsersModule } from '../users/index.js';
import { WeddingsModule } from '../weddings/index.js';
import { WorkspaceModule } from '../workspace/index.js';
import { TasksController } from './api/controllers/tasks.controller.js';
import { EventTasksAdapter } from './application/services/event-tasks.adapter.js';
import { TasksService } from './application/services/tasks.service.js';
import { ListTasksUseCase } from './application/use-cases/list-tasks.use-case.js';
import { SaveTaskUseCase } from './application/use-cases/save-task.use-case.js';
import { TaskAssigneesUseCase } from './application/use-cases/task-assignees.use-case.js';
import { TaskActivitiesRepository } from './infrastructure/repositories/task-activities.repository.js';
import { TaskAssignmentsRepository } from './infrastructure/repositories/task-assignments.repository.js';
import { TasksRepository } from './infrastructure/repositories/tasks.repository.js';
import {
  TaskActivityRecord,
  TaskActivitySchema,
} from './infrastructure/schemas/task-activity.schema.js';
import {
  TaskAssignmentRecord,
  TaskAssignmentSchema,
} from './infrastructure/schemas/task-assignment.schema.js';
import { TaskRecord, TaskSchema } from './infrastructure/schemas/task.schema.js';

/**
 * Wedding tasks, their assignees and history (System Design §6, Database Design §13,
 * decision 0026).
 *
 * Global only so the events module can use the EventTasks port without importing this
 * module, which depends on events (see the port).
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TaskRecord.name, schema: TaskSchema },
      { name: TaskAssignmentRecord.name, schema: TaskAssignmentSchema },
      { name: TaskActivityRecord.name, schema: TaskActivitySchema },
    ]),
    WorkspaceModule,
    WeddingsModule,
    EventsModule,
    UsersModule,
    AuditModule,
  ],
  controllers: [TasksController],
  providers: [
    TasksRepository,
    TaskAssignmentsRepository,
    TaskActivitiesRepository,
    TasksService,
    SaveTaskUseCase,
    ListTasksUseCase,
    TaskAssigneesUseCase,
    { provide: EventTasks, useClass: EventTasksAdapter },
  ],
  exports: [TasksService, EventTasks],
})
export class TasksModule {}
