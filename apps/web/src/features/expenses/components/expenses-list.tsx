'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Banner, controlClasses, PrimaryButton, SecondaryButton } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { useModal } from '@/components/ui/use-modal';
import type { ApiEvent } from '@/features/events/event-model';
import { Toast } from '@/features/tasks/components/task-parts';
import { NotAvailable } from '@/features/weddings/components/not-available';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import { EXPENSES_PATH } from '@/features/workspace/components/shell-parts';
import {
  PageHeader,
  PrimaryLink,
  SkeletonCard,
  useOneOffNotice,
} from '@/features/workspace/components/workspace-page';
import { SESSION_ENDED_PATH } from '@/features/workspace/workspace-context';
import { api, call, toApiError, type ApiError } from '@/lib/api';
import { categoryLabels, expensesPage, paymentStatusLabels } from '../content';
import {
  EXPENSE_CATEGORIES,
  formatShortDate,
  PAYMENT_STATUSES,
  type ApiExpense,
  type ExpenseCategory,
  type PaymentStatus,
} from '../expense-model';
import { formatRupees } from '../money';
import { EventLabel, MoneyFigures, StatusTag } from './expense-parts';

const PAGE_SIZE = 25;
/** The "Whole wedding" choice of the event filter (API: `eventId=none`). */
const WHOLE_WEDDING = 'none';

interface Filters {
  search: string;
  category: ExpenseCategory | '';
  eventId: string;
  paymentStatus: PaymentStatus | '';
}

const noFilters: Filters = { search: '', category: '', eventId: '', paymentStatus: '' };

const isFiltered = (filters: Filters) =>
  Boolean(filters.search || filters.category || filters.eventId || filters.paymentStatus);

interface Totals {
  totalMinor: number;
  paidMinor: number;
  pendingMinor: number;
}

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'gone' }
  | { status: 'ready'; expenses: ApiExpense[]; nextCursor: string | null; totals: Totals };

/** One page of expenses for the current filters, with the totals for all of them. */
async function fetchPage(
  weddingId: string,
  filters: Filters,
  cursor?: string,
): Promise<
  { expenses: ApiExpense[]; nextCursor: string | null; totals: Totals } | { error: ApiError }
> {
  try {
    const { data, error, response } = await api.GET('/api/v1/weddings/{weddingId}/expenses', {
      params: {
        path: { weddingId },
        query: {
          limit: PAGE_SIZE,
          ...(filters.search ? { search: filters.search } : {}),
          ...(filters.category ? { category: filters.category } : {}),
          ...(filters.eventId ? { eventId: filters.eventId } : {}),
          ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
          ...(cursor ? { cursor } : {}),
        },
      },
    });
    if (error !== undefined || !response.ok || !data) {
      return { error: toApiError(error, response.status) };
    }
    return {
      expenses: data.data,
      nextCursor: data.meta.pagination.nextCursor,
      totals: data.meta.totals,
    };
  } catch {
    return { error: toApiError(undefined, 0) };
  }
}

/** `/expenses`: Stitch "P8 · E1 Expenses List" and "P8 · E2 Expenses States" (decision 0029). */
export function ExpensesList({ wedding }: { wedding: ApiWedding }) {
  const router = useRouter();
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [showDeleted, dismissDeleted] = useOneOffNotice('expense-deleted');
  // Bumped whenever the list reloads, so a slower Load more from earlier filters is ignored.
  const listVersion = useRef(0);

  function applyFilters(next: Filters) {
    setLoadMoreFailed(false);
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
      if ('expenses' in result) {
        setLoadMoreFailed(false);
        setState({ status: 'ready', ...result });
      } else if (result.error.status === 401) router.replace(SESSION_ENDED_PATH);
      else if (result.error.code === 'WEDDING_NOT_FOUND') setState({ status: 'gone' });
      else if (result.error.code === 'EVENT_NOT_FOUND' && filters.eventId) {
        // The chosen event was deleted meanwhile: clear that filter once.
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
    setLoadMoreFailed(false);
    const result = await fetchPage(wedding.id, filters, state.nextCursor);
    setLoadingMore(false);
    if (version !== listVersion.current) return;
    if ('expenses' in result) {
      setState((current) =>
        current.status === 'ready'
          ? {
              status: 'ready',
              expenses: [...current.expenses, ...result.expenses],
              nextCursor: result.nextCursor,
              totals: result.totals,
            }
          : current,
      );
    } else if (result.error.status === 401) router.replace(SESSION_ENDED_PATH);
    else if (result.error.code === 'EVENT_NOT_FOUND' && filters.eventId) {
      // The filtered event was deleted meanwhile; every retry would fail, so the list reloads
      // without that filter (review P8, low).
      applyFilters({ ...filters, eventId: '' });
    }
    // Keep what is already loaded; the retry asks for the same page again.
    else setLoadMoreFailed(true);
  }

  function clearFilters() {
    setSearch('');
    applyFilters(noFilters);
  }

  if (state.status === 'gone') return <NotAvailable />;
  const filtered = isFiltered(filters);
  // The empty state hides the totals and filters: there is nothing yet (Stitch E2, state 1).
  const empty = state.status === 'ready' && state.expenses.length === 0 && !filtered;

  return (
    <div>
      <PageHeader
        title={expensesPage.title}
        actions={<PrimaryLink href={`${EXPENSES_PATH}/new`}>{expensesPage.add}</PrimaryLink>}
      />

      {state.status === 'ready' && !empty && (
        <section className="mb-5 rounded-xl border border-hairline bg-white p-5 shadow-sm sm:p-6">
          <MoneyFigures
            caption={expensesPage.totals.caption}
            figures={[
              { label: expensesPage.totals.total, minor: state.totals.totalMinor },
              { label: expensesPage.totals.paid, minor: state.totals.paidMinor },
              {
                label: expensesPage.totals.pending,
                minor: state.totals.pendingMinor,
                tone: 'pending',
              },
            ]}
          />
        </section>
      )}

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
            {expensesPage.loading}
          </span>
          <SkeletonCard className="h-24" />
          {Array.from({ length: 5 }, (_, index) => (
            <SkeletonCard key={index} className="h-16" />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <div className="space-y-4">
          <Banner tone="error" icon="error">
            {expensesPage.loadError}
          </Banner>
          <SecondaryButton
            icon="refresh"
            onClick={() => {
              setState({ status: 'loading' });
              setAttempt((value) => value + 1);
            }}
          >
            {expensesPage.retry}
          </SecondaryButton>
        </div>
      )}

      {state.status === 'ready' && state.expenses.length === 0 && (
        <EmptyState filtered={filtered} onClear={clearFilters} />
      )}

      {state.status === 'ready' && state.expenses.length > 0 && (
        <>
          <ExpenseTable expenses={state.expenses} />
          <ul className="space-y-3 md:hidden">
            {state.expenses.map((expense) => (
              <li key={expense.id}>
                <ExpenseCard expense={expense} />
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-col items-center gap-2">
            {loadMoreFailed && (
              <div className="w-full">
                <Banner tone="error" icon="error">
                  {expensesPage.loadMoreError}
                </Banner>
              </div>
            )}
            {state.nextCursor && (
              <SecondaryButton
                onClick={() => void loadMore()}
                pending={loadingMore}
                pendingLabel={expensesPage.loadingMore}
                icon="keyboard_arrow_down"
              >
                {expensesPage.loadMore}
              </SecondaryButton>
            )}
            <p className="text-body-sm text-on-surface-variant">
              {state.expenses.length === 1
                ? expensesPage.showing.one
                : expensesPage.showing.other.replace(
                    '{count}',
                    state.expenses.length.toLocaleString('en-IN'),
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

      {showDeleted && <Toast message={expensesPage.deleted} onClose={dismissDeleted} />}
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
  const activeCount = [filters.category, filters.eventId, filters.paymentStatus].filter(
    Boolean,
  ).length;

  return (
    <div className="mb-5 space-y-3 rounded-xl border border-hairline bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row-reverse">
        <label className="relative flex-1">
          <span className="sr-only">{expensesPage.search}</span>
          <Icon
            name="search"
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-outline"
          />
          <input
            type="search"
            value={search}
            onChange={(changeEvent) => onSearch(changeEvent.target.value)}
            placeholder={expensesPage.search}
            maxLength={150}
            className={`${controlClasses} min-h-11 py-2.5 pr-3 pl-10`}
          />
        </label>
        <div className="hidden gap-3 md:flex">
          <FilterSelect
            label={expensesPage.categoryFilter}
            value={filters.category}
            onChange={(value) => onChange({ ...filters, category: value as ExpenseCategory | '' })}
            options={[
              { value: '', label: expensesPage.allCategories },
              ...EXPENSE_CATEGORIES.map((category) => ({
                value: category,
                label: categoryLabels[category],
              })),
            ]}
          />
          <FilterSelect
            label={expensesPage.eventFilter}
            value={filters.eventId}
            onChange={(eventId) => onChange({ ...filters, eventId })}
            options={[
              { value: '', label: expensesPage.allEvents },
              { value: WHOLE_WEDDING, label: expensesPage.wholeWedding },
              ...events.map((event) => ({ value: event.id, label: event.name })),
            ]}
          />
          <FilterSelect
            label={expensesPage.statusFilter}
            value={filters.paymentStatus}
            onChange={(value) =>
              onChange({ ...filters, paymentStatus: value as PaymentStatus | '' })
            }
            options={[
              { value: '', label: expensesPage.allStatuses },
              ...PAYMENT_STATUSES.map((status) => ({
                value: status,
                label: paymentStatusLabels[status],
              })),
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 empty:hidden md:empty:hidden">
        <button
          type="button"
          onClick={onOpenSheet}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-outline-variant/70 bg-white px-4 text-label-md text-navy md:hidden"
        >
          <Icon name="tune" className="size-5" />
          {expensesPage.filters}
          {activeCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-navy text-[0.6875rem] text-on-primary">
              {activeCount}
            </span>
          )}
        </button>
        {isFiltered(filters) && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto inline-flex min-h-11 items-center rounded-lg px-2 text-label-md text-on-surface-variant hover:text-navy focus-visible:outline-2 focus-visible:outline-secondary"
          >
            {expensesPage.clearFilters}
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="relative md:w-48">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(changeEvent) => onChange(changeEvent.target.value)}
        className={`${controlClasses} min-h-11 appearance-none py-2.5 pr-10 pl-3`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
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

/** The mobile "Filters" bottom sheet (Stitch "P8 · E2", state 5). */
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
  const panel = useRef<HTMLDivElement>(null);
  // Focus moves in and stays in; Escape closes and focus returns to Filters (review P7-M4).
  useModal(panel, { onClose });

  const optionClass = (selected: boolean) =>
    `inline-flex min-h-11 items-center rounded-full border px-4 text-label-md ${
      selected
        ? 'border-navy bg-navy text-on-primary'
        : 'border-outline-variant/70 bg-white text-navy'
    }`;

  const group = (
    legend: string,
    options: { value: string; label: string }[],
    selected: string,
    choose: (value: string) => void,
  ) => (
    <fieldset className="mb-5">
      <legend className="mb-2 text-label-md text-navy">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value || 'all'}
            type="button"
            aria-pressed={selected === option.value}
            onClick={() => choose(option.value)}
            className={optionClass(selected === option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end md:hidden">
      <div aria-hidden="true" className="absolute inset-0 bg-navy/40" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={expensesPage.filters}
        className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-headline-sm text-navy">{expensesPage.filters}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-11 items-center justify-center rounded-lg text-on-surface-variant"
          >
            <Icon name="close" className="size-5" />
          </button>
        </div>

        {group(
          expensesPage.categoryFilter,
          [
            { value: '', label: expensesPage.allCategories },
            ...EXPENSE_CATEGORIES.map((category) => ({
              value: category,
              label: categoryLabels[category],
            })),
          ],
          draft.category,
          (value) => setDraft({ ...draft, category: value as ExpenseCategory | '' }),
        )}
        {group(
          expensesPage.eventFilter,
          [
            { value: '', label: expensesPage.allEvents },
            { value: WHOLE_WEDDING, label: expensesPage.wholeWedding },
            ...events.map((event) => ({ value: event.id, label: event.name })),
          ],
          draft.eventId,
          (eventId) => setDraft({ ...draft, eventId }),
        )}
        {group(
          expensesPage.statusFilter,
          [
            { value: '', label: expensesPage.allStatuses },
            ...PAYMENT_STATUSES.map((status) => ({
              value: status,
              label: paymentStatusLabels[status],
            })),
          ],
          draft.paymentStatus,
          (value) => setDraft({ ...draft, paymentStatus: value as PaymentStatus | '' }),
        )}

        <div className="flex gap-3">
          <SecondaryButton
            className="flex-1"
            onClick={() => setDraft({ ...noFilters, search: draft.search })}
          >
            {expensesPage.clearFilters}
          </SecondaryButton>
          <PrimaryButton className="flex-1" onClick={() => onApply(draft)}>
            {expensesPage.apply}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function ExpenseTitle({ expense }: { expense: ApiExpense }) {
  return (
    <Link
      href={`${EXPENSES_PATH}/${expense.id}`}
      className="rounded font-medium break-words text-navy hover:underline focus-visible:outline-2 focus-visible:outline-secondary"
    >
      {expense.title}
    </Link>
  );
}

function ExpenseTable({ expenses }: { expenses: ApiExpense[] }) {
  const header = 'px-3 py-3 text-left text-label-sm font-semibold text-on-surface-variant';
  const money = 'px-3 py-4 text-right tabular-nums whitespace-nowrap';
  return (
    <div className="hidden overflow-hidden rounded-xl border border-hairline bg-white shadow-sm md:block">
      <table className="w-full table-fixed">
        <thead className="border-b border-hairline bg-surface-container-low">
          <tr>
            <th className={`${header} w-[17%] pl-4`}>{expensesPage.columns.title}</th>
            <th className={`${header} w-[13%]`}>{expensesPage.columns.category}</th>
            <th className={`${header} w-[11%]`}>{expensesPage.columns.event}</th>
            <th className={`${header} w-[11%] text-right`}>{expensesPage.columns.amount}</th>
            <th className={`${header} w-[10%] text-right`}>{expensesPage.columns.paid}</th>
            <th className={`${header} w-[11%] text-right`}>{expensesPage.columns.pending}</th>
            <th className={`${header} w-[14%] text-center`}>{expensesPage.columns.status}</th>
            <th className={`${header} w-[13%] pr-4 text-right`}>{expensesPage.columns.date}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline text-body-sm">
          {expenses.map((expense) => (
            <tr key={expense.id} className="align-middle">
              <td className="py-4 pr-3 pl-4">
                <ExpenseTitle expense={expense} />
              </td>
              <td className="px-3 py-4 text-on-surface-variant">
                {categoryLabels[expense.category]}
              </td>
              <td className="px-3 py-4 break-words text-on-surface-variant">
                <EventLabel eventName={expense.eventName} />
              </td>
              <td className={`${money} font-semibold text-navy`}>
                {formatRupees(expense.amountMinor)}
              </td>
              <td className={`${money} text-navy`}>{formatRupees(expense.paidMinor)}</td>
              <td className={`${money} text-on-surface-variant`}>
                {formatRupees(expense.pendingMinor)}
              </td>
              <td className="px-3 py-4 text-center">
                <StatusTag status={expense.paymentStatus} />
              </td>
              <td className="py-4 pr-4 pl-3 text-right whitespace-nowrap text-on-surface-variant">
                {formatShortDate(expense.expenseDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A mobile card; each label stays with its amount (0029 correction for E1 mobile). */
function ExpenseCard({ expense }: { expense: ApiExpense }) {
  const pairs = [
    [expensesPage.columns.amount, expense.amountMinor],
    [expensesPage.columns.paid, expense.paidMinor],
    [expensesPage.columns.pending, expense.pendingMinor],
  ] as const;
  return (
    <article className="rounded-xl border border-hairline bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-start justify-between gap-3">
        <h2 className="min-w-0">
          <ExpenseTitle expense={expense} />
        </h2>
        <StatusTag status={expense.paymentStatus} />
      </div>
      <p className="mb-3 text-body-sm text-on-surface-variant">
        {categoryLabels[expense.category]} · <EventLabel eventName={expense.eventName} />
      </p>
      <dl className="grid grid-cols-3 gap-2 border-t border-hairline pt-3">
        {pairs.map(([label, minor]) => (
          <div key={label} className="min-w-0">
            <dt className="text-label-sm text-on-surface-variant">{label}</dt>
            <dd className="text-body-sm font-semibold break-words text-navy tabular-nums">
              {formatRupees(minor)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-right text-body-sm text-on-surface-variant">
        {formatShortDate(expense.expenseDate)}
      </p>
    </article>
  );
}

function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <section className="rounded-xl border border-dashed border-hairline bg-white px-6 py-12 text-center">
      <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[#faf1e4] text-secondary">
        <Icon name={filtered ? 'filter_alt_off' : 'receipt_long'} className="size-7" />
      </span>
      <h2 className="mb-1 font-serif text-headline-sm text-navy">
        {filtered ? expensesPage.noResultsTitle : expensesPage.emptyTitle}
      </h2>
      <p className="mb-6 text-body-sm text-on-surface-variant">
        {filtered ? expensesPage.noResultsBody : expensesPage.emptyBody}
      </p>
      {filtered ? (
        <SecondaryButton icon="filter_alt_off" onClick={onClear}>
          {expensesPage.clearFilters}
        </SecondaryButton>
      ) : (
        <PrimaryLink href={`${EXPENSES_PATH}/new`}>{expensesPage.add}</PrimaryLink>
      )}
    </section>
  );
}
