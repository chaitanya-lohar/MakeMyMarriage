'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { Banner, controlClasses, describedBy, Field, PrimaryButton } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import type { ApiEvent } from '@/features/events/event-model';
import { networkError } from '@/features/weddings/content';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import { TASKS_PATH } from '@/features/workspace/components/shell-parts';
import { PageHeader, SkeletonCard } from '@/features/workspace/components/workspace-page';
import { SESSION_ENDED_PATH, useReadyWorkspace } from '@/features/workspace/workspace-context';
import { api, call } from '@/lib/api';
import {
  MultiMemberPicker,
  useMemberDirectory,
  type PickableMember,
} from '@/features/members/components/member-picker';
import { priorityLabels, statusLabels, taskFields, taskForm, tasksPage } from '../content';
import {
  emptyTaskForm,
  errorsFromApi,
  formFromTask,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TaskLimits,
  toNewTaskPayload,
  toTaskChanges,
  validateTaskForm,
  type ApiTask,
  type TaskFormErrors,
  type TaskFormValues,
} from '../task-model';
import { TaskNotAvailable } from './task-not-available';

type BannerState = 'server' | 'network' | null;

/** `/tasks/new`: Stitch "P7 · T3"; from an event's shortcut the event is preselected (T7). */
export function AddTaskPage({ wedding, eventId }: { wedding: ApiWedding; eventId?: string }) {
  return <TaskForm wedding={wedding} task={null} presetEventId={eventId} />;
}

/** `/tasks/[taskId]/edit`: the same form, filled in. */
export function EditTaskPage({ wedding, taskId }: { wedding: ApiWedding; taskId: string }) {
  const router = useRouter();
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'gone' }
    | { status: 'error' }
    | { status: 'ready'; task: ApiTask }
  >({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void call(() =>
      api.GET('/api/v1/weddings/{weddingId}/tasks/{taskId}', {
        params: { path: { weddingId: wedding.id, taskId } },
      }),
    ).then((result) => {
      if (!active) return;
      if (result.data) setState({ status: 'ready', task: result.data });
      else if (result.error.status === 401) router.replace(SESSION_ENDED_PATH);
      else if (result.error.status === 404) setState({ status: 'gone' });
      else setState({ status: 'error' });
    });
    return () => {
      active = false;
    };
  }, [wedding.id, taskId, attempt, router]);

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
        <SkeletonCard className="h-16" />
        <SkeletonCard className="h-96" />
      </div>
    );
  }
  return <TaskForm key={state.task.id} wedding={wedding} task={state.task} />;
}

function TaskForm({
  wedding,
  task,
  presetEventId,
}: {
  wedding: ApiWedding;
  task: ApiTask | null;
  presetEventId?: string;
}) {
  const router = useRouter();
  const { user } = useReadyWorkspace();
  // null while the events load; the select is disabled until then.
  const [events, setEvents] = useState<ApiEvent[] | null>(null);
  const [values, setValues] = useState<TaskFormValues>(() =>
    task ? formFromTask(task) : emptyTaskForm(presetEventId ?? ''),
  );
  const directory = useMemberDirectory(wedding.id, user.id);
  // Assignees who have since left the wedding stay listed, so an edit never drops them (0030).
  const pickable = directory && [
    ...directory,
    ...(task?.assignees ?? [])
      .filter((assignee) => !directory.some((member) => member.userId === assignee.userId))
      .map((assignee) => ({
        userId: assignee.userId,
        displayName: assignee.displayName,
        isOwner: false,
        former: true,
      })),
  ];
  const [errors, setErrors] = useState<TaskFormErrors>({});
  const [banner, setBanner] = useState<BannerState>(null);
  const [pending, setPending] = useState(false);
  const [gone, setGone] = useState(false);
  // Set synchronously, so a quick second submit is ignored before the button re-renders.
  const submitting = useRef(false);

  useEffect(() => {
    void call(() =>
      api.GET('/api/v1/weddings/{weddingId}/events', {
        params: { path: { weddingId: wedding.id } },
      }),
    ).then((result) => {
      if (!result.data) {
        // Without the list, the select still shows the linked event (see TaskFields).
        setEvents([]);
        return;
      }
      const loaded = result.data;
      setEvents(loaded);
      // A preset event that no longer exists falls back to the whole wedding.
      setValues((current) =>
        current.eventId && !loaded.some((event) => event.id === current.eventId)
          ? { ...current, eventId: '' }
          : current,
      );
    });
  }, [wedding.id]);

  function change<K extends keyof TaskFormValues>(field: K, value: TaskFormValues[K]) {
    setValues((previous) => ({ ...previous, [field]: value }));
    if (field !== 'assigneeIds' && errors[field as Exclude<K, 'assigneeIds'>]) {
      setErrors((previous) => ({ ...previous, [field]: undefined }));
    }
  }

  function setSaving(value: boolean) {
    submitting.current = value;
    setPending(value);
  }

  async function save(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (submitting.current) return;
    setBanner(null);
    const found = validateTaskForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    const result = task
      ? await call(() =>
          api.PATCH('/api/v1/weddings/{weddingId}/tasks/{taskId}', {
            params: { path: { weddingId: wedding.id, taskId: task.id } },
            body: toTaskChanges(values, task),
          }),
        )
      : await call(() =>
          api.POST('/api/v1/weddings/{weddingId}/tasks', {
            params: { path: { weddingId: wedding.id } },
            body: toNewTaskPayload(values),
          }),
        );
    if (result.data) {
      // Stay busy until the page changes. A new task opens the list; an edit returns to it.
      router.push(task ? `${TASKS_PATH}/${task.id}` : TASKS_PATH);
      return;
    }
    setSaving(false);
    const { status, code, fields } = result.error;
    if (status === 401) router.replace(SESSION_ENDED_PATH);
    else if (code === 'EVENT_NOT_FOUND') {
      // The chosen event was deleted meanwhile: fall back to the whole wedding.
      change('eventId', '');
      setBanner('server');
    } else if (code === 'TASK_NOT_FOUND' || code === 'WEDDING_NOT_FOUND') setGone(true);
    else if (code === 'VALIDATION_FAILED') setErrors(errorsFromApi(fields));
    else setBanner(status === 0 ? 'network' : 'server');
  }

  if (gone) return <TaskNotAvailable />;
  const cancelHref = task ? `${TASKS_PATH}/${task.id}` : TASKS_PATH;

  return (
    <div className="max-w-[720px]">
      <PageHeader
        title={task ? taskForm.editTitle : taskForm.addTitle}
        subtitle={task ? taskForm.editSubtitle : taskForm.addSubtitle}
        back={{ href: cancelHref, label: taskForm.back }}
      />

      <section className="rounded-xl border border-hairline bg-white p-6 shadow-sm sm:p-8">
        <div className="space-y-4 empty:hidden">
          {banner === 'server' && (
            <Banner tone="error" icon="error">
              {taskForm.serverError}
            </Banner>
          )}
          {banner === 'network' && (
            <Banner tone="error" icon="wifi_off">
              {networkError}
            </Banner>
          )}
        </div>

        <form onSubmit={(formEvent) => void save(formEvent)} noValidate className="mt-6 first:mt-0">
          <TaskFields
            values={values}
            errors={errors}
            events={events}
            linkedEvent={task?.eventId ? { id: task.eventId, name: task.eventName } : null}
            fromEvent={Boolean(presetEventId) && values.eventId === presetEventId}
            members={pickable}
            currentUserId={user.id}
            onChange={change}
            disabled={pending}
          />
          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-hairline pt-6 sm:flex-row sm:justify-end">
            <Link
              href={cancelHref}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-outline-variant/70 bg-white px-5 text-label-md text-navy transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-secondary"
            >
              {taskForm.cancel}
            </Link>
            <PrimaryButton type="submit" pending={pending} pendingLabel={taskForm.saving}>
              {task ? taskForm.saveChanges : taskForm.save}
            </PrimaryButton>
          </div>
        </form>
      </section>
    </div>
  );
}

const counter = (value: string, max: number) =>
  `${value.trim().length.toLocaleString('en-IN')} / ${max.toLocaleString('en-IN')}`;

/** The T3 fields, in the approved order. */
function TaskFields({
  values,
  errors,
  events,
  linkedEvent,
  fromEvent,
  members,
  currentUserId,
  onChange,
  disabled,
}: {
  values: TaskFormValues;
  errors: TaskFormErrors;
  /** Null while loading. */
  events: ApiEvent[] | null;
  /** The task's event as loaded, shown even if the events list fails or lacks it. */
  linkedEvent: { id: string; name: string | null } | null;
  /** True while the event preset from an event's shortcut is still chosen. */
  fromEvent: boolean;
  /** Null while the member directory loads. */
  members: PickableMember[] | null;
  currentUserId: string;
  onChange: <K extends keyof TaskFormValues>(field: K, value: TaskFormValues[K]) => void;
  disabled: boolean;
}) {
  const ids = {
    title: useId(),
    description: useId(),
    event: useId(),
    dueDate: useId(),
    priority: useId(),
    status: useId(),
    assignee: useId(),
    notes: useId(),
  };
  const select = `${controlClasses} min-h-11 appearance-none py-2.5 pr-10 pl-3`;
  const chevron = (
    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-outline">
      <Icon name="keyboard_arrow_down" className="size-5" />
    </span>
  );

  return (
    <div className="space-y-5">
      <Field
        id={ids.title}
        label={
          <>
            {taskFields.title.label}
            <span className="text-error"> *</span>
          </>
        }
        error={errors.title}
        aside={counter(values.title, TaskLimits.title)}
      >
        <input
          id={ids.title}
          name="title"
          value={values.title}
          onChange={(changeEvent) => onChange('title', changeEvent.target.value)}
          placeholder={taskFields.title.placeholder}
          disabled={disabled}
          autoComplete="off"
          aria-required
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={describedBy(ids.title, errors.title)}
          className={`${controlClasses} min-h-11 px-3 py-2.5`}
        />
      </Field>

      <Field
        id={ids.description}
        label={taskFields.description.label}
        error={errors.description}
        aside={counter(values.description, TaskLimits.description)}
      >
        <textarea
          id={ids.description}
          name="description"
          rows={3}
          value={values.description}
          onChange={(changeEvent) => onChange('description', changeEvent.target.value)}
          placeholder={taskFields.description.placeholder}
          disabled={disabled}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={describedBy(ids.description, errors.description)}
          className={`${controlClasses} resize-y p-3 leading-relaxed`}
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id={ids.event}
          label={taskFields.event.label}
          error={errors.eventId}
          hint={fromEvent ? taskFields.event.fromEventHint : undefined}
        >
          <div className="relative">
            <select
              id={ids.event}
              name="eventId"
              value={values.eventId}
              onChange={(changeEvent) => onChange('eventId', changeEvent.target.value)}
              disabled={disabled || events === null}
              aria-describedby={describedBy(
                ids.event,
                errors.eventId,
                fromEvent ? taskFields.event.fromEventHint : undefined,
              )}
              className={select}
            >
              <option value="">{tasksPage.wholeWedding}</option>
              {linkedEvent && !(events ?? []).some((event) => event.id === linkedEvent.id) && (
                <option value={linkedEvent.id}>{linkedEvent.name ?? linkedEvent.id}</option>
              )}
              {(events ?? []).map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
            {chevron}
          </div>
        </Field>

        <Field id={ids.dueDate} label={taskFields.dueDate.label} error={errors.dueDate}>
          <input
            id={ids.dueDate}
            name="dueDate"
            type="date"
            value={values.dueDate}
            onChange={(changeEvent) => onChange('dueDate', changeEvent.target.value)}
            disabled={disabled}
            aria-invalid={errors.dueDate ? true : undefined}
            aria-describedby={describedBy(ids.dueDate, errors.dueDate)}
            className={`${controlClasses} min-h-11 px-3 py-2.5`}
          />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-1.5 block text-body-sm font-medium text-navy">
          {taskFields.priority.label}
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TASK_PRIORITIES.map((priority) => (
            <label
              key={priority}
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border text-label-md transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-secondary ${
                values.priority === priority
                  ? 'border-navy bg-navy text-on-primary'
                  : 'border-outline-variant/70 bg-white text-navy hover:bg-surface-container-low'
              }`}
            >
              <input
                type="radio"
                name="priority"
                value={priority}
                checked={values.priority === priority}
                onChange={() => onChange('priority', priority)}
                disabled={disabled}
                className="sr-only"
              />
              {priorityLabels[priority]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id={ids.status} label={taskFields.status.label} error={errors.status}>
          <div className="relative">
            <select
              id={ids.status}
              name="status"
              value={values.status}
              onChange={(changeEvent) =>
                onChange('status', changeEvent.target.value as TaskFormValues['status'])
              }
              disabled={disabled}
              className={select}
            >
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
            {chevron}
          </div>
        </Field>

        <fieldset>
          <legend className="mb-1.5 block text-body-sm font-medium text-navy">
            {taskFields.assignee.label}
          </legend>
          {members ? (
            <MultiMemberPicker
              name={ids.assignee}
              members={members}
              currentUserId={currentUserId}
              selected={values.assigneeIds}
              onChange={(userIds) => onChange('assigneeIds', userIds)}
              disabled={disabled}
            />
          ) : (
            <div className="h-11 animate-pulse rounded-lg bg-surface-container-low" />
          )}
        </fieldset>
      </div>

      <Field
        id={ids.notes}
        label={taskFields.notes.label}
        error={errors.notes}
        hint={taskFields.notes.hint}
        aside={counter(values.notes, TaskLimits.notes)}
      >
        <textarea
          id={ids.notes}
          name="notes"
          rows={3}
          value={values.notes}
          onChange={(changeEvent) => onChange('notes', changeEvent.target.value)}
          placeholder={taskFields.notes.placeholder}
          disabled={disabled}
          aria-invalid={errors.notes ? true : undefined}
          aria-describedby={describedBy(ids.notes, errors.notes, taskFields.notes.hint)}
          className={`${controlClasses} resize-y p-3 leading-relaxed`}
        />
      </Field>
    </div>
  );
}
