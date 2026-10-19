// Public entry point of the tasks module (decision 0006).
export { TasksService, type TaskDashboard } from './application/services/tasks.service.js';
export {
  isDueToday,
  isOverdue,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TaskPriority,
  TaskStatus,
} from './domain/rules/task-rules.js';
export type { Task, TaskCounts } from './domain/types/task.js';
export { TasksModule } from './tasks.module.js';
