import type { TaskPriority, TaskStatus } from '../rules/task-rules.js';

/** A wedding task (Database Design §13.1, decision 0026). */
export interface Task {
  id: string;
  weddingId: string;
  title: string;
  description: string | null;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** Calendar date, YYYY-MM-DD, in the wedding's timezone; null when there is none. */
  dueDate: string | null;
  /** Null for a whole-wedding task. */
  eventId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** The fields an organizer enters; null clears an optional field. */
export interface TaskDetails {
  title: string;
  description: string | null;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  eventId: string | null;
}

export interface NewTask extends TaskDetails {
  weddingId: string;
  createdBy: string;
}

/** A change to a task: only the given fields change. */
export type TaskChanges = Partial<TaskDetails>;

/** A task assignee, with the name shown for them. */
export interface TaskAssignee {
  userId: string;
  displayName: string;
}

/** A task with what organizers see next to it. */
export interface TaskView {
  task: Task;
  eventName: string | null;
  assignees: TaskAssignee[];
}

export const TaskActivityAction = {
  Created: 'CREATED',
  Updated: 'UPDATED',
  StatusChanged: 'STATUS_CHANGED',
  EventChanged: 'EVENT_CHANGED',
  EventDeleted: 'EVENT_DELETED',
  AssigneeAdded: 'ASSIGNEE_ADDED',
  AssigneeRemoved: 'ASSIGNEE_REMOVED',
  Deleted: 'DELETED',
} as const;

export type TaskActivityAction = (typeof TaskActivityAction)[keyof typeof TaskActivityAction];

/** One entry of a task's history (Database Design §13.3, decision 0026 #15). */
export interface TaskActivity {
  id: string;
  taskId: string;
  actorUserId: string;
  action: TaskActivityAction;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  createdAt: Date;
}

export interface NewTaskActivity {
  weddingId: string;
  taskId: string;
  actorUserId: string;
  action: TaskActivityAction;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}

/** List filters (API Design §13); `eventId: 'none'` means whole-wedding tasks. */
export interface TaskListQuery {
  statuses: TaskStatus[];
  priority?: TaskPriority;
  eventId?: string;
  overdue: boolean;
  assignedTo?: string;
  search?: string;
  limit: number;
  cursor?: string;
  today: string;
}

export interface TaskPage {
  tasks: Task[];
  nextCursor: string | null;
}

/** Dashboard task counts (0013, 0026 #20); Cancelled is in none. */
export interface TaskCounts {
  pending: number;
  blocked: number;
  completed: number;
  overdue: number;
}
