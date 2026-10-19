import type { components } from '@makemymarriage/api-client';
import { isCalendarDate } from '@/features/weddings/dates';
import { historyLines, priorityLabels, statusLabels, taskErrors } from './content';

export type ApiTask = components['schemas']['TaskDto'];
export type ApiTaskActivity = components['schemas']['TaskActivityDto'];
export type TaskStatus = ApiTask['status'];
export type TaskPriority = ApiTask['priority'];

/** The five statuses (0010 #3), in the order the designs list them. */
export const TASK_STATUSES: TaskStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
];

/** Priorities as the form shows them, lowest first (Stitch "P7 · T3"). */
export const TASK_PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

/** The list's default: every status except Cancelled (0026 #18). */
export const DEFAULT_STATUSES: TaskStatus[] = TASK_STATUSES.filter(
  (status) => status !== 'CANCELLED',
);

/** Limits from 0026 #6; the API enforces the same. */
export const TaskLimits = { title: 150, description: 1000, notes: 1000 } as const;

/** What the task form holds; the due date is YYYY-MM-DD from the date picker, or empty. */
export interface TaskFormValues {
  title: string;
  description: string;
  notes: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  /** An event ID, or empty for a whole-wedding task. */
  eventId: string;
  assignToMe: boolean;
}

export type TaskFormField = Exclude<keyof TaskFormValues, 'assignToMe'>;
export type TaskFormErrors = Partial<Record<TaskFormField, string>>;

export function emptyTaskForm(eventId = ''): TaskFormValues {
  return {
    title: '',
    description: '',
    notes: '',
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: '',
    eventId,
    assignToMe: false,
  };
}

export function formFromTask(task: ApiTask, userId: string): TaskFormValues {
  return {
    title: task.title,
    description: task.description ?? '',
    notes: task.notes ?? '',
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ?? '',
    eventId: task.eventId ?? '',
    assignToMe: task.assignees.some((assignee) => assignee.userId === userId),
  };
}

const tooLong = (value: string, max: number) =>
  value.trim().length > max
    ? taskErrors.tooLong.replace('{max}', max.toLocaleString('en-IN'))
    : undefined;

/** Checks the form the way the API will (Phase 7 PRD §3), so mistakes show before sending. */
export function validateTaskForm(values: TaskFormValues): TaskFormErrors {
  const title = values.title.trim();
  const errors: TaskFormErrors = {
    title: !title
      ? taskErrors.title
      : title.length > TaskLimits.title
        ? taskErrors.titleTooLong
        : undefined,
    description: tooLong(values.description, TaskLimits.description),
    notes: tooLong(values.notes, TaskLimits.notes),
    dueDate: values.dueDate && !isCalendarDate(values.dueDate) ? taskErrors.dueDate : undefined,
  };
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message !== undefined));
}

const orNull = (value: string) => value.trim() || null;

/** The full request body for a new task. Today only the signed-in member can be assigned (0026 #13). */
export function toNewTaskPayload(values: TaskFormValues, userId: string) {
  return {
    title: values.title.trim(),
    description: orNull(values.description),
    notes: orNull(values.notes),
    status: values.status,
    priority: values.priority,
    dueDate: values.dueDate || null,
    eventId: values.eventId || null,
    assigneeIds: values.assignToMe ? [userId] : [],
  };
}

/**
 * The PATCH body for an edit: only the fields that differ from the task as loaded, so a change
 * made meanwhile in another tab (say, its status) is not undone (review P7-M2). `assigneeIds`
 * is sent only when "Assign to me" changed, and keeps everyone else assigned.
 */
export function toTaskChanges(values: TaskFormValues, userId: string, task: ApiTask) {
  const full = toNewTaskPayload(values, userId);
  const loaded = toNewTaskPayload(formFromTask(task, userId), userId);
  const changes: Partial<ReturnType<typeof toNewTaskPayload>> = {};
  for (const key of [
    'title',
    'description',
    'notes',
    'status',
    'priority',
    'dueDate',
    'eventId',
  ] as const) {
    if (full[key] !== loaded[key]) Object.assign(changes, { [key]: full[key] });
  }
  if (values.assignToMe !== formFromTask(task, userId).assignToMe) {
    const others = task.assignees.map((assignee) => assignee.userId).filter((id) => id !== userId);
    changes.assigneeIds = values.assignToMe ? [...others, userId] : others;
  }
  return changes;
}

/** Field errors reported by the API, as form errors (first message per field). */
export function errorsFromApi(fields: Record<string, string[]>): TaskFormErrors {
  const known: TaskFormField[] = [
    'title',
    'description',
    'notes',
    'status',
    'priority',
    'dueDate',
    'eventId',
  ];
  const errors: TaskFormErrors = {};
  for (const field of known) {
    const message = fields[field]?.[0];
    if (message) errors[field] = message;
  }
  return errors;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "5 Feb 2027" for a YYYY-MM-DD date, as the task screens show it. */
export function formatShortDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** "Book mehendi artist" → "BM"; used for assignee circles. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

const fill = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template,
  );

const dateText = (value: unknown) => (typeof value === 'string' ? formatShortDate(value) : '');

/** The timeline lines for one history entry (Phase 7 PRD §5.5); an edit can give several. */
export function historyText(activity: ApiTaskActivity): string[] {
  const actor = activity.actorName || 'Someone';
  const oldValue = activity.oldValue ?? {};
  const newValue = activity.newValue ?? {};
  switch (activity.action) {
    case 'CREATED':
      return [fill(historyLines.created, { actor })];
    case 'STATUS_CHANGED':
      return [
        fill(historyLines.status, {
          actor,
          from: statusLabels[oldValue.status as TaskStatus] ?? '',
          to: statusLabels[newValue.status as TaskStatus] ?? '',
        }),
      ];
    case 'UPDATED': {
      const lines: string[] = [];
      if ('title' in newValue) {
        lines.push(
          fill(historyLines.title, {
            actor,
            from: typeof oldValue.title === 'string' ? oldValue.title : '',
            to: typeof newValue.title === 'string' ? newValue.title : '',
          }),
        );
      }
      if ('priority' in newValue) {
        lines.push(
          fill(historyLines.priority, {
            actor,
            from: priorityLabels[oldValue.priority as TaskPriority] ?? '',
            to: priorityLabels[newValue.priority as TaskPriority] ?? '',
          }),
        );
      }
      if ('dueDate' in newValue) {
        const from = dateText(oldValue.dueDate);
        const to = dateText(newValue.dueDate);
        lines.push(
          fill(
            !from
              ? historyLines.dueDateAdded
              : !to
                ? historyLines.dueDateRemoved
                : historyLines.dueDate,
            { actor, from, to },
          ),
        );
      }
      const fields = Array.isArray(newValue.fields) ? newValue.fields : [];
      if (fields.includes('description')) lines.push(fill(historyLines.description, { actor }));
      if (fields.includes('notes')) lines.push(fill(historyLines.notes, { actor }));
      return lines;
    }
    case 'EVENT_CHANGED': {
      const from = typeof oldValue.eventName === 'string' ? oldValue.eventName : '';
      const to = typeof newValue.eventName === 'string' ? newValue.eventName : '';
      if (!to) return [fill(historyLines.eventUnlinked, { actor })];
      const hadEvent = Boolean(oldValue.eventId);
      return [
        fill(hadEvent ? historyLines.eventMoved : historyLines.eventLinked, {
          actor,
          from: from || historyLines.aDeletedEvent,
          to,
        }),
      ];
    }
    case 'EVENT_DELETED':
      return [historyLines.eventDeleted];
    case 'ASSIGNEE_ADDED':
      return [fill(historyLines.assigned, { actor, subject: activity.subjectName ?? '' })];
    case 'ASSIGNEE_REMOVED':
      return [fill(historyLines.unassigned, { actor, subject: activity.subjectName ?? '' })];
    case 'DELETED':
      return [fill(historyLines.deleted, { actor })];
    default:
      return [];
  }
}

/** "3 Feb 2027, 6:40 pm" in India time, for history entries. */
export function formatHistoryTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('day')} ${part('month')} ${part('year')}, ${part('hour')}:${part('minute')} ${part('dayPeriod').toLowerCase()}`;
}
