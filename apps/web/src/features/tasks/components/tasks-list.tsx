'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Banner, controlClasses, PrimaryButton, SecondaryButton } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import type { ApiEvent } from '@/features/events/event-model';
import { NotAvailable } from '@/features/weddings/components/not-available';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import { TASKS_PATH } from '@/features/workspace/components/shell-parts';
import {
  PageHeader,
  PrimaryLink,
  SkeletonCard,
  useOneOffNotice,
} from '@/features/workspace/components/workspace-page';
import { SESSION_ENDED_PATH } from '@/features/workspace/workspace-context';
import { api, call, toApiError, type ApiError } from '@/lib/api';
import { priorityLabels, statusLabels, tasksPage } from '../content';
import {
  DEFAULT_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type ApiTask,
  type TaskPriority,
  type TaskStatus,
} from '../task-model';
import { Assignees, DueDate, EventTag, PriorityLabel, StatusPill, Toast } from './task-parts';

const PAGE_SIZE = 25;
/** The "Whole wedding" choice of the event filter (API: `eventId=none`). */
const WHOLE_WEDDING = 'none';

interface Filters {
  search: string;
  statuses: TaskStatus[];
  priority: TaskPriority | '';
  eventId: string;
  overdue: boolean;
  assignedToMe: boolean;
}

const noFilters: Filters = {
  search: '',
  statuses: DEFAULT_STATUSES,
  priority: '',
  eventId: '',
  overdue: false,
  assignedToMe: false,
};

const sameStatuses = (a: TaskStatus[], b: TaskStatus[]) =>
  a.length === b.length && a.every((status) => b.includes(status));

function isFiltered(filters: Filters): boolean {
  return Boolean(
    filters.search ||
    !sameStatuses(filters.statuses, DEFAULT_STATUSES) ||
    filters.priority ||
    filters.eventId ||
    filters.overdue ||
    filters.assignedToMe,
  );
}

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'gone' }
  | { status: 'ready'; tasks: ApiTask[]; nextCursor: string | null };

/** One page of tasks for the current filters. */
async function fetchPage(
  weddingId: string,
  filters: Filters,
  cursor?: string,
): Promise<{ tasks: ApiTask[]; nextCursor: string | null } | { error: ApiError }> {
  try {
    const { data, error, response } = await api.GET('/api/v1/weddings/{weddingId}/tasks', {
      params: {
        path: { weddingId },
        query: {
          limit: PAGE_SIZE,
          status: filters.statuses,
          ...(filters.search ? { search: filters.search } : {}),
          ...(filters.priority ? { priority: filters.priority } : {}),
          ...(filters.eventId ? { eventId: filters.eventId } : {}),
          ...(filters.overdue ? { overdue: true } : {}),
          ...(filters.assignedToMe ? { assignedToMe: true } : {}),
          ...(cursor ? { cursor } : {}),
        },
      },
    });
    if (error !== undefined || !response.ok || !data) {
      return { error: toApiError(error, response.status) };
    }
    return { tasks: data.data, nextCursor: data.meta.pagination.nextCursor };
  } catch {
    return { error: toApiError(undefined, 0) };
  }
}

/** `/tasks`: Stitch "P7 · T1 Tasks List" and "P7 · T2 Tasks States" (decision 0027). */
export function TasksList({ wedding }: { wedding: ApiWedding }) {
  const router = useRouter();
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showDeleted, dismissDeleted] = useOneOffNotice('task-deleted');
  // Bumped whenever the list reloads, so a slower Load more from earlier filters is ignored.
  const listVersion = useRef(0);

  function applyFilters(next: Filters) {
    setState({ status: 'loading' });
    setFilters(next);
  }

  // The search box applies after a short pause in typing.
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = search.trim();
      if (trimmed === filters.search) return;
      setState({ status: 'loading' });
      setFilters({ ...filters, search: trimmed });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filters]);

  useEffect(() => {
    void call(() =>
      api.GET('/api/v1/weddings/{weddingId}/events', {
        params: { path: { weddingId: wedding.id } },
      }),
    ).then((result) => {
      if (result.data) setEvents(result.data);
    });
  }, [wedding.id]);

  useEffect(() => {
    let active = true;
    listVersion.current += 1;
    void fetchPage(wedding.id, filters).then((result) => {
      if (!active) return;
      if ('tasks' in result) {
        setState({ status: 'ready', tasks: result.tasks, nextCursor: result.nextCursor });
      } else if (result.error.status === 401) router.replace(SESSION_ENDED_PATH);
      else if (result.error.status === 404 && result.error.code === 'WEDDING_NOT_FOUND') {
        setState({ status: 'gone' });
      } else if (result.error.status === 404) {
        // The chosen event was deleted meanwhile: clear the filter.
        applyFilters({ ...filters, eventId: '' });
      } else setState({ status: 'error' });
    });
    return () => {
      active = false;
    };
  }, [wedding.id, filters, attempt, router]);

  async function loadMore() {
    if (state.status !== 'ready' || !state.nextCursor) return;
    const version = listVersion.current;
    setLoadingMore(true);
    const result = await fetchPage(wedding.id, filters, state.nextCursor);
    setLoadingMore(false);
    if (version !== listVersion.current) return;
    if ('tasks' in result) {
      setState((current) =>
        current.status === 'ready'
          ? {
              status: 'ready',
              tasks: [...current.tasks, ...result.tasks],
              nextCursor: result.nextCursor,
            }
          : current,
      );
    } else if (result.error.status === 401) router.replace(SESSION_ENDED_PATH);
    else setState({ status: 'error' });
  }

  function clearFilters() {
    setSearch('');
    applyFilters(noFilters);
  }

  if (state.status === 'gone') return <NotAvailable />;
  const filtered = isFiltered(filters);
  // The empty state hides the filters: there is nothing to filter yet (Stitch T2, state A).
  const empty = state.status === 'ready' && state.tasks.length === 0 && !filtered;

  return (
    <div>
      <PageHeader
        title={tasksPage.title}
        subtitle={tasksPage.subtitle}
        actions={<PrimaryLink href={`${TASKS_PATH}/new`}>{tasksPage.add}</PrimaryLink>}
      />

      {!empty && (
        <FilterBar
          filters={filters}
          search={search}
          events={events}
          onSearch={setSearch}
          onChange={applyFilters}
          onClear={clearFilters}
          onOpenSheet={() => setSheetOpen(true)}
        />
      )}

      {state.status === 'loading' && (
        <div className="space-y-3" aria-busy="true">
          <span className="sr-only" role="status">
            {tasksPage.loading}
          </span>
          {Array.from({ length: 5 }, (_, index) => (
            <SkeletonCard key={index} className="h-16" />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <div className="space-y-4">
          <Banner tone="error" icon="error">
            {tasksPage.loadError}
          </Banner>
          <SecondaryButton
            icon="refresh"
            onClick={() => {
              setState({ status: 'loading' });
              setAttempt((value) => value + 1);
            }}
          >
            {tasksPage.retry}
          </SecondaryButton>
        </div>
      )}

      {state.status === 'ready' && state.tasks.length === 0 && (
        <EmptyState filtered={filtered} onClear={clearFilters} />
      )}

      {state.status === 'ready' && state.tasks.length > 0 && (
        <>
          <TaskTable tasks={state.tasks} />
          <ul className="space-y-3 md:hidden">
            {state.tasks.map((task) => (
              <li key={task.id}>
                <TaskCard task={task} />
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-col items-center gap-2">
            {state.nextCursor && (
              <SecondaryButton
                onClick={() => void loadMore()}
                pending={loadingMore}
                pendingLabel={tasksPage.loadingMore}
                icon="keyboard_arrow_down"
              >
                {tasksPage.loadMore}
              </SecondaryButton>
            )}
            <p className="text-body-sm text-on-surface-variant">
              {state.tasks.length === 1
                ? tasksPage.showing.one
                : tasksPage.showing.other.replace(
                    '{count}',
                    state.tasks.length.toLocaleString('en-IN'),
                  )}
            </p>
          </div>
        </>
      )}

      {sheetOpen && (
        <FilterSheet
          filters={filters}
          events={events}
          onApply={(next) => {
            setSheetOpen(false);
            applyFilters({ ...next, search: filters.search });
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {showDeleted && <Toast message={tasksPage.deleted} onClose={dismissDeleted} />}
    </div>
  );
}

function FilterBar({
  filters,
  search,
  events,
  onSearch,
  onChange,
  onClear,
  onOpenSheet,
}: {
  filters: Filters;
  search: string;
  events: ApiEvent[];
  onSearch: (value: string) => void;
  onChange: (next: Filters) => void;
  onClear: () => void;
  onOpenSheet: () => void;
}) {
  const filtered = isFiltered(filters);
  const single = filters.statuses.length === 1 ? filters.statuses[0] : undefined;
  const statusValue = sameStatuses(filters.statuses, DEFAULT_STATUSES) ? '' : (single ?? 'several');
  const activeCount = [
    !sameStatuses(filters.statuses, DEFAULT_STATUSES),
    filters.priority,
    filters.eventId,
    filters.overdue,
    filters.assignedToMe,
  ].filter(Boolean).length;

  return (
    <div className="mb-5 space-y-3 rounded-xl border border-hairline bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">{tasksPage.search}</span>
          <Icon
            name="search"
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-outline"
          />
          <input
            type="search"
            value={search}
            onChange={(changeEvent) => onSearch(changeEvent.target.value)}
            placeholder={tasksPage.search}
            className={`${controlClasses} min-h-11 py-2.5 pr-3 pl-10`}
          />
        </label>
        <div className="hidden gap-3 md:flex">
          <FilterSelect
            label={tasksPage.statusFilter}
            width="md:w-64"
            value={statusValue}
            onChange={(value) =>
              onChange({
                ...filters,
                statuses: value ? [value as TaskStatus] : DEFAULT_STATUSES,
              })
            }
            options={[
              { value: '', label: tasksPage.allExceptCancelled },
              ...(statusValue === 'several' ? [{ value: 'several', label: '…' }] : []),
              ...TASK_STATUSES.map((status) => ({ value: status, label: statusLabels[status] })),
            ]}
          />
          <FilterSelect
            label={tasksPage.priorityFilter}
            value={filters.priority}
            onChange={(value) => onChange({ ...filters, priority: value as TaskPriority | '' })}
            options={[
              { value: '', label: tasksPage.allPriorities },
              ...[...TASK_PRIORITIES]
                .reverse()
                .map((priority) => ({ value: priority, label: priorityLabels[priority] })),
            ]}
          />
          <FilterSelect
            label={tasksPage.eventFilter}
            value={filters.eventId}
            onChange={(eventId) => onChange({ ...filters, eventId })}
            options={[
              { value: '', label: tasksPage.allEvents },
              { value: WHOLE_WEDDING, label: tasksPage.wholeWedding },
              ...events.map((event) => ({ value: event.id, label: event.name })),
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onOpenSheet}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-outline-variant/70 bg-white px-4 text-label-md text-navy md:hidden"
        >
          <Icon name="tune" className="size-5" />
          {tasksPage.filters}
          {activeCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-navy text-[0.6875rem] text-on-primary">
              {activeCount}
            </span>
          )}
        </button>
        <span className="hidden flex-wrap gap-2 md:flex">
          <ToggleChip
            label={tasksPage.overdueOnly}
            pressed={filters.overdue}
            onToggle={() => onChange({ ...filters, overdue: !filters.overdue })}
          />
          <ToggleChip
            label={tasksPage.assignedToMe}
            pressed={filters.assignedToMe}
            onToggle={() => onChange({ ...filters, assignedToMe: !filters.assignedToMe })}
          />
        </span>
        {filtered && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto inline-flex min-h-11 items-center rounded-lg px-2 text-label-md text-on-surface-variant hover:text-navy focus-visible:outline-2 focus-visible:outline-secondary"
          >
            {tasksPage.clearFilters}
          </button>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  width = 'md:w-44',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  width?: string;
}) {
  return (
    <label className={`relative ${width}`}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(changeEvent) => onChange(changeEvent.target.value)}
        className={`${controlClasses} min-h-11 appearance-none py-2.5 pr-10 pl-3`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.value === 'several'}>
            {option.value && option.value !== 'several'
              ? option.label
              : `${label}: ${option.label}`}
          </option>
        ))}
      </select>
      <Icon
        name="keyboard_arrow_down"
        className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-outline"
      />
    </label>
  );
}

function ToggleChip({
  label,
  pressed,
  onToggle,
}: {
  label: string;
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-label-md transition-colors focus-visible:outline-2 focus-visible:outline-secondary ${
        pressed
          ? 'border-navy bg-navy text-on-primary'
          : 'border-outline-variant/70 bg-white text-on-surface-variant hover:text-navy'
      }`}
    >
      {pressed && <Icon name="check" className="size-4" />}
      {label}
    </button>
  );
}

/** The mobile "Filters" bottom sheet (Stitch "P7 · T2", section E). */
function FilterSheet({
  filters,
  events,
  onApply,
  onClose,
}: {
  filters: Filters;
  events: ApiEvent[];
  onApply: (next: Filters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Filters>(filters);

  useEffect(() => {
    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggleStatus = (status: TaskStatus) =>
    setDraft((current) => {
      const statuses = current.statuses.includes(status)
        ? current.statuses.filter((value) => value !== status)
        : [...current.statuses, status];
      return { ...current, statuses: statuses.length > 0 ? statuses : DEFAULT_STATUSES };
    });

  const optionClass = (selected: boolean) =>
    `inline-flex min-h-11 items-center rounded-full border px-4 text-label-md ${
      selected
        ? 'border-navy bg-navy text-on-primary'
        : 'border-outline-variant/70 bg-white text-navy'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:hidden">
      <div aria-hidden="true" className="absolute inset-0 bg-navy/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tasksPage.filters}
        className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-headline-sm text-navy">{tasksPage.filters}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-11 items-center justify-center rounded-lg text-on-surface-variant"
          >
            <Icon name="close" className="size-5" />
          </button>
        </div>

        <fieldset className="mb-5">
          <legend className="mb-2 text-label-md text-navy">{tasksPage.statusFilter}</legend>
          <div className="space-y-1">
            {TASK_STATUSES.map((status) => (
              <label key={status} className="flex min-h-11 items-center gap-3 text-body-md">
                <input
                  type="checkbox"
                  checked={draft.statuses.includes(status)}
                  onChange={() => toggleStatus(status)}
                  className="size-5 accent-navy"
                />
                {statusLabels[status]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mb-5">
          <legend className="mb-2 text-label-md text-navy">{tasksPage.priorityFilter}</legend>
          <div className="flex flex-wrap gap-2">
            {(['', ...[...TASK_PRIORITIES].reverse()] as (TaskPriority | '')[]).map((priority) => (
              <button
                key={priority || 'all'}
                type="button"
                aria-pressed={draft.priority === priority}
                onClick={() => setDraft({ ...draft, priority })}
                className={optionClass(draft.priority === priority)}
              >
                {priority ? priorityLabels[priority] : tasksPage.allPriorities}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mb-5">
          <legend className="mb-2 text-label-md text-navy">{tasksPage.eventFilter}</legend>
          <div className="flex flex-wrap gap-2">
            {[
              { value: '', label: tasksPage.allEvents },
              { value: WHOLE_WEDDING, label: tasksPage.wholeWedding },
              ...events.map((event) => ({ value: event.id, label: event.name })),
            ].map((option) => (
              <button
                key={option.value || 'all'}
                type="button"
                aria-pressed={draft.eventId === option.value}
                onClick={() => setDraft({ ...draft, eventId: option.value })}
                className={optionClass(draft.eventId === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mb-6 space-y-1">
          {(
            [
              ['overdue', tasksPage.overdueOnly],
              ['assignedToMe', tasksPage.assignedToMe],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex min-h-11 items-center gap-3 text-body-md">
              <input
                type="checkbox"
                checked={draft[key]}
                onChange={() => setDraft({ ...draft, [key]: !draft[key] })}
                className="size-5 accent-navy"
              />
              {label}
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <SecondaryButton
            className="flex-1"
            onClick={() => setDraft({ ...noFilters, search: draft.search })}
          >
            {tasksPage.clear}
          </SecondaryButton>
          <PrimaryButton className="flex-1" onClick={() => onApply(draft)}>
            {tasksPage.apply}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function TaskTitle({ task }: { task: ApiTask }) {
  return (
    <Link
      href={`${TASKS_PATH}/${task.id}`}
      className={`rounded font-medium break-words text-navy hover:underline focus-visible:outline-2 focus-visible:outline-secondary ${
        task.status === 'COMPLETED' ? 'text-on-surface-variant line-through' : ''
      }`}
    >
      {task.title}
    </Link>
  );
}

function TaskTable({ tasks }: { tasks: ApiTask[] }) {
  const header = 'px-4 py-3 text-left text-label-sm font-semibold text-on-surface-variant';
  return (
    <div className="hidden overflow-hidden rounded-xl border border-hairline bg-white shadow-sm md:block">
      <table className="w-full table-fixed">
        <thead className="border-b border-hairline bg-surface-container-low">
          <tr>
            <th className={`${header} w-[27%]`}>{tasksPage.columns.title}</th>
            <th className={`${header} w-[17%]`}>{tasksPage.columns.event}</th>
            <th className={`${header} w-[13%]`}>{tasksPage.columns.status}</th>
            <th className={`${header} w-[9%]`}>{tasksPage.columns.priority}</th>
            <th className={`${header} w-[24%]`}>{tasksPage.columns.dueDate}</th>
            <th className={`${header} w-[10%] text-right`}>{tasksPage.columns.assignee}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {tasks.map((task) => (
            <tr key={task.id} className="align-middle">
              <td className="px-4 py-4">
                <TaskTitle task={task} />
              </td>
              <td className="px-4 py-4">
                <EventTag task={task} />
              </td>
              <td className="px-4 py-4">
                <StatusPill status={task.status} />
              </td>
              <td className="px-4 py-4">
                <PriorityLabel task={task} />
              </td>
              <td className="px-4 py-4">
                <DueDate task={task} />
              </td>
              <td className="px-4 py-4 text-right">
                <Assignees task={task} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskCard({ task }: { task: ApiTask }) {
  return (
    <article className="rounded-xl border border-hairline bg-white p-4 shadow-sm">
      <h2 className="mb-2">
        <TaskTitle task={task} />
      </h2>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <StatusPill status={task.status} />
        <PriorityLabel task={task} />
      </div>
      <div className="mb-3">
        <DueDate task={task} />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-hairline pt-3">
        <span className="min-w-0 text-body-sm text-on-surface-variant">
          {task.eventName ?? tasksPage.wholeWedding}
        </span>
        <Assignees task={task} />
      </div>
    </article>
  );
}

function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <section className="rounded-xl border border-dashed border-hairline bg-white px-6 py-12 text-center">
      <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[#faf1e4] text-secondary">
        <Icon name={filtered ? 'filter_alt_off' : 'checklist'} className="size-7" />
      </span>
      <h2 className="mb-1 font-serif text-headline-sm text-navy">
        {filtered ? tasksPage.noResultsTitle : tasksPage.emptyTitle}
      </h2>
      <p className="mb-6 text-body-sm text-on-surface-variant">
        {filtered ? tasksPage.noResultsBody : tasksPage.emptyBody}
      </p>
      {filtered ? (
        <SecondaryButton icon="filter_alt_off" onClick={onClear}>
          {tasksPage.clearFilters}
        </SecondaryButton>
      ) : (
        <PrimaryLink href={`${TASKS_PATH}/new`}>{tasksPage.emptyAdd}</PrimaryLink>
      )}
    </section>
  );
}
