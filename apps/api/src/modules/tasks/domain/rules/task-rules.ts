/** Task rules: Phase 7 PRD v1.0 §3–§4 and §8, decisions 0010 #3, 0013 and 0026. */

export const TaskStatus = {
  Todo: 'TODO',
  InProgress: 'IN_PROGRESS',
  Blocked: 'BLOCKED',
  Completed: 'COMPLETED',
  Cancelled: 'CANCELLED',
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TASK_STATUSES = Object.values(TaskStatus);

export const TaskPriority = {
  Low: 'LOW',
  Medium: 'MEDIUM',
  High: 'HIGH',
  Urgent: 'URGENT',
} as const;

export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export const TASK_PRIORITIES = Object.values(TaskPriority);

/** Higher ranks sort first: Urgent, High, Medium, Low (0026 #18). */
export const PRIORITY_RANK: Record<TaskPriority, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/** Statuses never overdue, and never upcoming on the dashboard (0013, 0026 #8). */
export const CLOSED_STATUSES: readonly TaskStatus[] = [TaskStatus.Completed, TaskStatus.Cancelled];

/** The list shows every status except Cancelled unless statuses are chosen (0026 #18). */
export const DEFAULT_LIST_STATUSES: readonly TaskStatus[] = TASK_STATUSES.filter(
  (status) => status !== TaskStatus.Cancelled,
);

export const TaskLimits = {
  titleMaxLength: 150,
  descriptionMaxLength: 1000,
  notesMaxLength: 1000,
} as const;

/** The dashboard lists at most five upcoming tasks due within seven days (0026 #20). */
export const UPCOMING_TASKS_LIMIT = 5;
export const UPCOMING_TASKS_DAYS = 7;

/** Field messages (DRAFT wording — 0027). */
export const TaskMessages = {
  title: 'Enter a title.',
  titleTooLong: 'Use 150 characters or fewer.',
  status: 'Choose a status.',
  priority: 'Choose a priority.',
  dueDate: 'Enter a valid date.',
  tooLong: (max: number) => `Keep it under ${max.toLocaleString('en-IN')} characters.`,
} as const;

/**
 * Overdue (0026 #8): due before today in the wedding's timezone, and neither completed nor
 * cancelled. `dueDate` and `today` are YYYY-MM-DD, which compare correctly as text.
 */
export function isOverdue(dueDate: string | null, status: TaskStatus, today: string): boolean {
  return dueDate !== null && dueDate < today && !CLOSED_STATUSES.includes(status);
}

/** Due today, and not closed: shown as "Due today" rather than overdue. */
export function isDueToday(dueDate: string | null, status: TaskStatus, today: string): boolean {
  return dueDate === today && !CLOSED_STATUSES.includes(status);
}

/** The calendar date `days` after `date` (both YYYY-MM-DD). */
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
