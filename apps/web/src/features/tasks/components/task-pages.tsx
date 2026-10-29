'use client';

import { RequireWedding } from '@/features/workspace/components/workspace-page';
import { TaskDetail } from './task-detail';
import { AddTaskPage, EditTaskPage } from './task-form';
import { TasksList } from './tasks-list';

/** `/tasks` */
export function TasksPageContent() {
  return (
    <RequireWedding permission={['TASKS', 'VIEW']}>
      {(wedding) => <TasksList wedding={wedding} />}
    </RequireWedding>
  );
}

/** `/tasks/new`, optionally `?eventId=` from an event's shortcut (Stitch "P7 · T7"). */
export function NewTaskPageContent({ eventId }: { eventId?: string }) {
  return (
    <RequireWedding permission={['TASKS', 'CREATE']}>
      {(wedding) => <AddTaskPage wedding={wedding} eventId={eventId} />}
    </RequireWedding>
  );
}

/** `/tasks/[taskId]` */
export function TaskDetailPageContent({ taskId }: { taskId: string }) {
  return (
    <RequireWedding permission={['TASKS', 'VIEW']}>
      {(wedding) => <TaskDetail key={taskId} wedding={wedding} taskId={taskId} />}
    </RequireWedding>
  );
}

/** `/tasks/[taskId]/edit` */
export function EditTaskPageContent({ taskId }: { taskId: string }) {
  return (
    <RequireWedding permission={['TASKS', 'EDIT']}>
      {(wedding) => <EditTaskPage key={taskId} wedding={wedding} taskId={taskId} />}
    </RequireWedding>
  );
}
