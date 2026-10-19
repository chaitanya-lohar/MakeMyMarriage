'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Banner, controlClasses, PrimaryButton, QuietButton } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { networkError } from '@/features/weddings/content';
import { formatDate } from '@/features/weddings/dates';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import { TASKS_PATH } from '@/features/workspace/components/shell-parts';
import { PageHeader, SkeletonCard } from '@/features/workspace/components/workspace-page';
import { SESSION_ENDED_PATH, useReadyWorkspace } from '@/features/workspace/workspace-context';
import { api, call } from '@/lib/api';
import { deleteTask, priorityLabels, statusLabels, taskDetail, tasksPage } from '../content';
import {
  formatHistoryTime,
  formatShortDate,
  historyText,
  TASK_STATUSES,
  type ApiTask,
  type ApiTaskActivity,
  type TaskStatus,
} from '../task-model';
import { DueTag, StatusPill } from './task-parts';
import { TaskNotAvailable } from './task-not-available';

type State =
  | { status: 'loading' }
  | { status: 'gone' }
  | { status: 'error' }
  | { status: 'ready'; task: ApiTask; history: ApiTaskActivity[] };

/** `/tasks/[taskId]`: Stitch "P7 · T4 Task Detail" and the cancelled state of "P7 · T5". */
export function TaskDetail({ wedding, taskId }: { wedding: ApiWedding; taskId: string }) {
  const router = useRouter();
  const { user, setNotice } = useReadyWorkspace();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const path = { weddingId: wedding.id, taskId };

  // Loads the task and its history; `attempt` reloads them after a change or a retry.
  useEffect(() => {
    let active = true;
    const params = { params: { path: { weddingId: wedding.id, taskId } } };
    void Promise.all([
      call(() => api.GET('/api/v1/weddings/{weddingId}/tasks/{taskId}', params)),
      call(() => api.GET('/api/v1/weddings/{weddingId}/tasks/{taskId}/activities', params)),
    ]).then(([task, history]) => {
      if (!active) return;
      if (task.data && history.data) {
        setState({ status: 'ready', task: task.data, history: history.data });
        return;
      }
      const error = task.error ?? history.error;
      if (error?.status === 401) router.replace(SESSION_ENDED_PATH);
      else if (error?.status === 404) setState({ status: 'gone' });
      else setState({ status: 'error' });
    });
    return () => {
      active = false;
    };
  }, [wedding.id, taskId, attempt, router]);

  /** Runs a change, then reloads the task and its history. */
  async function act(change: () => Promise<{ error?: { status: number } }>) {
    setBusy(true);
    setActionError(undefined);
    const result = await change();
    if (result.error?.status === 401) router.replace(SESSION_ENDED_PATH);
    else if (result.error?.status === 404) setState({ status: 'gone' });
    else if (result.error) {
      setActionError(result.error.status === 0 ? networkError : taskDetail.updateError);
    } else setAttempt((value) => value + 1);
    setBusy(false);
  }

  const changeStatus = (status: TaskStatus) =>
    act(() =>
      call(() =>
        api.PATCH('/api/v1/weddings/{weddingId}/tasks/{taskId}', {
          params: { path },
          body: { status },
        }),
      ),
    );
  const assignMe = () =>
    act(() =>
      call(() =>
        api.POST('/api/v1/weddings/{weddingId}/tasks/{taskId}/assignees', {
          params: { path },
          body: { userId: user.id },
        }),
      ),
    );
  const unassign = (userId: string) =>
    act(() =>
      call(() =>
        api.DELETE('/api/v1/weddings/{weddingId}/tasks/{taskId}/assignees/{userId}', {
          params: { path: { ...path, userId } },
        }),
      ),
    );

  const cancelDelete = useCallback(() => {
    setConfirming(false);
    setDeleteError(undefined);
  }, []);

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(undefined);
    const result = await call(() =>
      api.DELETE('/api/v1/weddings/{weddingId}/tasks/{taskId}', { params: { path } }),
    );
    setDeleting(false);
    if (!result.error || result.error.status === 404) {
      setNotice('task-deleted');
      router.push(TASKS_PATH);
    } else if (result.error.status === 401) router.replace(SESSION_ENDED_PATH);
    else setDeleteError(result.error.status === 0 ? networkError : deleteTask.error);
  }

  if (state.status === 'gone') return <TaskNotAvailable />;
  if (state.status === 'error') {
    return (
      <div className="space-y-4">
        <Banner tone="error" icon="error">
          {tasksPage.loadError}
        </Banner>
        <PrimaryButton icon="refresh" onClick={() => setAttempt((value) => value + 1)}>
          {tasksPage.retry}
        </PrimaryButton>
      </div>
    );
  }
  if (state.status === 'loading') {
    return (
      <div className="space-y-4" aria-busy="true">
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-64" />
        <SkeletonCard className="h-48" />
      </div>
    );
  }

  const { task, history } = state;
  const mine = task.assignees.some((assignee) => assignee.userId === user.id);

  return (
    <div className="max-w-[880px]">
      <PageHeader
        title={task.title}
        back={{ href: TASKS_PATH, label: taskDetail.back }}
        subtitle={
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <StatusPill status={task.status} />
            <span className="text-body-sm text-on-surface-variant">
              {priorityLabels[task.priority]}
            </span>
            <DueTag task={task} />
            {task.dueDate && (
              <span className="inline-flex items-center gap-1 text-body-sm text-on-surface-variant">
                <Icon name="calendar_today" className="size-4" />
                {taskDetail.due.replace('{date}', formatShortDate(task.dueDate))}
              </span>
            )}
          </span>
        }
        actions={
          <>
            <label className="relative">
              <span className="sr-only">{taskDetail.changeStatus.replace('{status}', '')}</span>
              <select
                value={task.status}
                disabled={busy}
                onChange={(changeEvent) =>
                  void changeStatus(changeEvent.target.value as TaskStatus)
                }
                className={`${controlClasses} min-h-11 appearance-none py-2.5 pr-10 pl-3 sm:w-52`}
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {taskDetail.changeStatus.replace('{status}', statusLabels[status])}
                  </option>
                ))}
              </select>
              <Icon
                name="keyboard_arrow_down"
                className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-outline"
              />
            </label>
            <Link
              href={`${TASKS_PATH}/${task.id}/edit`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-champagne bg-white px-5 text-label-md text-navy transition-colors hover:bg-ivory focus-visible:outline-2 focus-visible:outline-secondary"
            >
              <Icon name="edit" className="size-5" />
              {taskDetail.edit}
            </Link>
            <QuietButton icon="delete" tone="danger" onClick={() => setConfirming(true)}>
              {taskDetail.delete}
            </QuietButton>
          </>
        }
      />

      <div className="space-y-6">
        {actionError && (
          <Banner tone="error" icon="error">
            {actionError}
          </Banner>
        )}
        {task.status === 'CANCELLED' && (
          <Banner tone="info" icon="info">
            {taskDetail.cancelledNote}
          </Banner>
        )}

        <section className="rounded-xl border border-hairline bg-white p-6 shadow-sm sm:p-8">
          <h2 className="mb-5 border-b border-hairline pb-3 font-serif text-headline-sm text-navy">
            {taskDetail.details}
          </h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            <Detail label={taskDetail.event}>{task.eventName ?? tasksPage.wholeWedding}</Detail>
            <Detail label={taskDetail.dueDate}>
              {task.dueDate ? formatDate(task.dueDate) : <Empty />}
            </Detail>
            <Detail label={taskDetail.priority}>{priorityLabels[task.priority]}</Detail>
            <Detail label={taskDetail.assignee}>
              {task.assignees.length === 0 ? (
                <span className="flex flex-wrap items-center gap-2">
                  <Empty />
                  <AssignButton disabled={busy} onClick={() => void assignMe()}>
                    {taskDetail.assignToMe}
                  </AssignButton>
                </span>
              ) : (
                <ul className="space-y-1">
                  {task.assignees.map((assignee) => (
                    <li key={assignee.userId} className="flex flex-wrap items-center gap-2">
                      <span className="break-words">{assignee.displayName}</span>
                      <AssignButton disabled={busy} onClick={() => void unassign(assignee.userId)}>
                        {taskDetail.unassign}
                      </AssignButton>
                    </li>
                  ))}
                  {!mine && (
                    <li>
                      <AssignButton disabled={busy} onClick={() => void assignMe()}>
                        {taskDetail.assignToMe}
                      </AssignButton>
                    </li>
                  )}
                </ul>
              )}
            </Detail>
            <Detail label={taskDetail.description} wide>
              {task.description ? (
                <span className="whitespace-pre-line">{task.description}</span>
              ) : (
                <Empty />
              )}
            </Detail>
            <Detail label={taskDetail.notes} wide>
              {task.notes ? <span className="whitespace-pre-line">{task.notes}</span> : <Empty />}
            </Detail>
          </dl>
        </section>

        <section className="rounded-xl border border-hairline bg-white p-6 shadow-sm sm:p-8">
          <h2 className="mb-5 border-b border-hairline pb-3 font-serif text-headline-sm text-navy">
            {taskDetail.history}
          </h2>
          {history.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">{taskDetail.historyEmpty}</p>
          ) : (
            <ol className="space-y-4">
              {history.flatMap((activity) =>
                historyText(activity).map((line, index) => (
                  <li key={`${activity.id}-${index}`} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-2 size-2 shrink-0 rounded-full bg-champagne"
                    />
                    <div className="min-w-0">
                      <p className="text-body-md break-words text-navy">{line}</p>
                      <p className="text-body-sm text-on-surface-variant">
                        {formatHistoryTime(activity.createdAt)}
                      </p>
                    </div>
                  </li>
                )),
              )}
            </ol>
          )}
        </section>
      </div>

      {confirming && (
        <ConfirmDialog
          title={deleteTask.title}
          body={deleteTask.body.replace('{title}', task.title)}
          icon="delete"
          confirmLabel={deleteTask.confirm}
          cancelLabel={deleteTask.cancel}
          pendingLabel={deleteTask.deleting}
          tone="danger"
          pending={deleting}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={cancelDelete}
        />
      )}
    </div>
  );
}

function Detail({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="mb-1 text-body-sm text-on-surface-variant">{label}</dt>
      <dd className="text-body-md break-words text-navy">{children}</dd>
    </div>
  );
}

function Empty() {
  return <span className="text-on-surface-variant italic">{taskDetail.none}</span>;
}

function AssignButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-11 items-center rounded-lg px-2 text-label-md text-navy underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-secondary disabled:text-outline"
    >
      {children}
    </button>
  );
}
