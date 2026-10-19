'use client';

import { Chip, type ChipTone } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { priorityLabels, statusLabels, tasksPage } from '../content';
import { formatShortDate, initials, type ApiTask, type TaskStatus } from '../task-model';

const statusTones: Record<TaskStatus, ChipTone> = {
  TODO: 'neutral',
  IN_PROGRESS: 'neutral',
  BLOCKED: 'champagne',
  COMPLETED: 'sage',
  CANCELLED: 'muted',
};

export function StatusPill({ status }: { status: TaskStatus }) {
  return (
    <Chip tone={statusTones[status]} className="text-label-sm">
      {statusLabels[status]}
    </Chip>
  );
}

export function PriorityLabel({ task }: { task: Pick<ApiTask, 'priority'> }) {
  return (
    <span
      className={`text-body-sm ${task.priority === 'URGENT' ? 'font-semibold text-navy' : 'text-on-surface-variant'}`}
    >
      {priorityLabels[task.priority]}
    </span>
  );
}

/** The red "Overdue" or champagne "Due today" tag; never wraps (0027 correction 2). */
export function DueTag({ task }: { task: Pick<ApiTask, 'isOverdue' | 'isDueToday'> }) {
  if (task.isOverdue) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-md border border-error/30 bg-error-container/50 px-2 py-0.5 text-label-sm font-semibold whitespace-nowrap text-error">
        {tasksPage.overdue}
      </span>
    );
  }
  if (task.isDueToday) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-md border border-secondary-fixed bg-[#faf5ee] px-2 py-0.5 text-label-sm font-semibold whitespace-nowrap text-navy">
        {tasksPage.dueToday}
      </span>
    );
  }
  return null;
}

/** The due date with its tag, or "No due date". */
export function DueDate({ task }: { task: Pick<ApiTask, 'dueDate' | 'isOverdue' | 'isDueToday'> }) {
  if (!task.dueDate) {
    return <span className="text-body-sm text-outline italic">{tasksPage.noDueDate}</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-body-sm whitespace-nowrap text-navy">
        {formatShortDate(task.dueDate)}
      </span>
      <DueTag task={task} />
    </span>
  );
}

/** Assignee initials in small navy circles; a dash when nobody is assigned. */
export function Assignees({ task }: { task: Pick<ApiTask, 'assignees'> }) {
  if (task.assignees.length === 0) {
    return (
      <span className="text-on-surface-variant">
        <span aria-hidden="true">—</span>
        <span className="sr-only">{tasksPage.noAssignee}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex -space-x-1.5">
      {task.assignees.map((assignee) => (
        <span
          key={assignee.userId}
          title={assignee.displayName}
          className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-navy text-[0.6875rem] font-semibold text-on-primary"
        >
          <span aria-hidden="true">{initials(assignee.displayName)}</span>
          <span className="sr-only">{assignee.displayName}</span>
        </span>
      ))}
    </span>
  );
}

/** The event name, or "Whole wedding". */
export function EventTag({ task }: { task: Pick<ApiTask, 'eventName'> }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-md bg-surface-container px-2 py-0.5 text-body-sm break-words text-on-surface">
      {task.eventName ?? tasksPage.wholeWedding}
    </span>
  );
}

/** A small navy toast at the bottom of the screen, e.g. "Task deleted" (Stitch "P7 · T5"). */
export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-between gap-3 rounded-lg bg-navy px-4 py-2 text-body-sm text-on-primary shadow-lg sm:inset-x-auto sm:right-6 sm:bottom-6"
    >
      <span className="flex items-center gap-2">
        <Icon name="check_circle" className="size-5 text-champagne" />
        {message}
      </span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="flex size-9 items-center justify-center rounded-md text-on-primary/80 hover:text-on-primary focus-visible:outline-2 focus-visible:outline-champagne"
      >
        <Icon name="close" className="size-4" />
      </button>
    </div>
  );
}
