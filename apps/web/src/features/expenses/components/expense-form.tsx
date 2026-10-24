'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { Banner, controlClasses, describedBy, Field, PrimaryButton } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import type { ApiEvent } from '@/features/events/event-model';
import type { ApiVendor } from '@/features/vendors/vendor-model';
import { networkError } from '@/features/weddings/content';
import { todayIn } from '@/features/weddings/dates';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import { EXPENSES_PATH } from '@/features/workspace/components/shell-parts';
import { PageHeader, SkeletonCard } from '@/features/workspace/components/workspace-page';
import { SESSION_ENDED_PATH, useReadyWorkspace } from '@/features/workspace/workspace-context';
import { api, call } from '@/lib/api';
import { categoryLabels, expenseFields, expenseForm, expensesPage } from '../content';
import {
  emptyExpenseForm,
  EXPENSE_CATEGORIES,
  ExpenseLimits,
  expenseErrorsFromApi,
  formFromExpense,
  toExpenseChanges,
  toNewExpensePayload,
  validateExpenseForm,
  type ApiExpense,
  type ExpenseFormErrors,
  type ExpenseFormValues,
} from '../expense-model';
import { ExpenseNotAvailable } from './expense-parts';

type BannerState = 'server' | 'network' | 'amount' | 'eventGone' | null;

/** `/expenses/new`: Stitch "P8 · E3"; from an event's shortcut the event is preselected (E8). */
export function AddExpensePage({ wedding, eventId }: { wedding: ApiWedding; eventId?: string }) {
  return <ExpenseForm wedding={wedding} expense={null} presetEventId={eventId} />;
}

/** `/expenses/[expenseId]/edit`: the same form, filled in. */
export function EditExpensePage({
  wedding,
  expenseId,
}: {
  wedding: ApiWedding;
  expenseId: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'gone' }
    | { status: 'error' }
    | { status: 'ready'; expense: ApiExpense }
  >({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void call(() =>
      api.GET('/api/v1/weddings/{weddingId}/expenses/{expenseId}', {
        params: { path: { weddingId: wedding.id, expenseId } },
      }),
    ).then((result) => {
      if (!active) return;
      if (result.data) setState({ status: 'ready', expense: result.data });
      else if (result.error.status === 401) router.replace(SESSION_ENDED_PATH);
      else if (result.error.status === 404) setState({ status: 'gone' });
      else setState({ status: 'error' });
    });
    return () => {
      active = false;
    };
  }, [wedding.id, expenseId, attempt, router]);

  if (state.status === 'gone') return <ExpenseNotAvailable />;
  if (state.status === 'error') {
    return (
      <div className="space-y-4">
        <Banner tone="error" icon="error">
          {expensesPage.loadError}
        </Banner>
        <PrimaryButton icon="refresh" onClick={() => setAttempt((value) => value + 1)}>
          {expensesPage.retry}
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
  return <ExpenseForm key={state.expense.id} wedding={wedding} expense={state.expense} />;
}

function ExpenseForm({
  wedding,
  expense,
  presetEventId,
}: {
  wedding: ApiWedding;
  expense: ApiExpense | null;
  presetEventId?: string;
}) {
  const router = useRouter();
  const { setNotice } = useReadyWorkspace();
  // null while the events load; the select is disabled until then.
  const [events, setEvents] = useState<ApiEvent[] | null>(null);
  const [vendors, setVendors] = useState<ApiVendor[] | null>(null);
  const [values, setValues] = useState<ExpenseFormValues>(() =>
    expense
      ? formFromExpense(expense)
      : emptyExpenseForm(todayIn(wedding.timezone), presetEventId ?? ''),
  );
  const [errors, setErrors] = useState<ExpenseFormErrors>({});
  const [banner, setBanner] = useState<BannerState>(null);
  const [pending, setPending] = useState(false);
  const [gone, setGone] = useState(false);
  // An event deleted while the form was open; it leaves the select (review P8, low).
  const [deletedEventId, setDeletedEventId] = useState<string | null>(null);
  // Set synchronously, so a quick second submit is ignored before the button re-renders.
  const submitting = useRef(false);
  const linkedEventId = expense?.eventId ?? null;

  useEffect(() => {
    let active = true;
    void (async () => {
      const all: ApiVendor[] = [];
      let cursor: string | null = null;
      do {
        const result = await api.GET('/api/v1/weddings/{weddingId}/vendors', {
          params: {
            path: { weddingId: wedding.id },
            query: { limit: 25, ...(cursor ? { cursor } : {}) },
          },
        });
        if (result.error || !result.data) break;
        const page = result.data as unknown as {
          data: ApiVendor[];
          meta: { pagination: { nextCursor: string | null } };
        };
        all.push(...page.data);
        cursor = page.meta.pagination.nextCursor;
      } while (cursor);
      if (active) setVendors(all);
    })();
    return () => {
      active = false;
    };
  }, [wedding.id]);

  useEffect(() => {
    void call(() =>
      api.GET('/api/v1/weddings/{weddingId}/events', {
        params: { path: { weddingId: wedding.id } },
      }),
    ).then((result) => {
      if (!result.data) {
        setEvents([]);
        // Without the list the select can show only "Whole wedding" (and an edited expense's own
        // event), so a preset event is dropped: what is sent is what is shown (review P8-M4).
        setValues((current) =>
          current.eventId && current.eventId !== linkedEventId
            ? { ...current, eventId: '' }
            : current,
        );
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
  }, [wedding.id, linkedEventId]);

  function change<K extends keyof ExpenseFormValues>(field: K, value: ExpenseFormValues[K]) {
    setValues((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: undefined }));
    if (field === 'amount' && banner === 'amount') setBanner(null);
  }

  function setSaving(value: boolean) {
    submitting.current = value;
    setPending(value);
  }

  async function save(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (submitting.current) return;
    setBanner(null);
    const found = validateExpenseForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    const result = expense
      ? await call(() =>
          api.PATCH('/api/v1/weddings/{weddingId}/expenses/{expenseId}', {
            params: { path: { weddingId: wedding.id, expenseId: expense.id } },
            body: toExpenseChanges(values, expense),
          }),
        )
      : await call(() =>
          api.POST('/api/v1/weddings/{weddingId}/expenses', {
            params: { path: { weddingId: wedding.id } },
            body: toNewExpensePayload(values),
          }),
        );
    if (result.data) {
      // Stay busy until the page changes. Both open the expense, where payments are added.
      setNotice('expense-saved');
      router.push(`${EXPENSES_PATH}/${result.data.id}`);
      return;
    }
    setSaving(false);
    const { status, code, message, fields } = result.error;
    if (status === 401) router.replace(SESSION_ENDED_PATH);
    else if (code === 'AMOUNT_BELOW_PAID') {
      // E3 validation: the amount can't go below what is already paid (0028 #10).
      setErrors((previous) => ({ ...previous, amount: message }));
      setBanner('amount');
    } else if (code === 'EVENT_NOT_FOUND') {
      // The chosen event was deleted meanwhile: say so, drop it, and fall back to the whole
      // wedding for the member to check and save again.
      setDeletedEventId(values.eventId);
      setEvents((current) => current?.filter((event) => event.id !== values.eventId) ?? current);
      change('eventId', '');
      setBanner('eventGone');
    } else if (code === 'EXPENSE_NOT_FOUND' || code === 'WEDDING_NOT_FOUND') setGone(true);
    else if (code === 'VALIDATION_FAILED') setErrors(expenseErrorsFromApi(fields));
    else setBanner(status === 0 ? 'network' : 'server');
  }

  if (gone) return <ExpenseNotAvailable />;
  const cancelHref = expense ? `${EXPENSES_PATH}/${expense.id}` : EXPENSES_PATH;

  return (
    <div className="max-w-[720px]">
      <PageHeader
        title={expense ? expenseForm.editTitle : expenseForm.addTitle}
        subtitle={expense ? expenseForm.editSubtitle : expenseForm.addSubtitle}
        back={{ href: cancelHref, label: expenseForm.back }}
      />

      <section className="rounded-xl border border-hairline bg-white p-6 shadow-sm sm:p-8">
        <div className="space-y-4 empty:hidden">
          {banner === 'amount' && (
            <Banner tone="error" icon="error">
              <p className="font-semibold">{expenseForm.checkAmount}</p>
              <p>{errors.amount}</p>
            </Banner>
          )}
          {banner === 'server' && (
            <Banner tone="error" icon="error">
              {expenseForm.serverError}
            </Banner>
          )}
          {banner === 'eventGone' && (
            <Banner tone="error" icon="error">
              {expenseForm.eventGone}
            </Banner>
          )}
          {banner === 'network' && (
            <Banner tone="error" icon="wifi_off">
              {networkError}
            </Banner>
          )}
        </div>

        <form onSubmit={(formEvent) => void save(formEvent)} noValidate className="mt-6 first:mt-0">
          <ExpenseFields
            values={values}
            errors={errors}
            events={events}
            vendors={vendors}
            linkedVendor={
              expense?.vendorId
                ? { id: expense.vendorId, name: expense.vendorName, deleted: expense.vendorDeleted }
                : null
            }
            linkedEvent={
              expense?.eventId && expense.eventId !== deletedEventId
                ? { id: expense.eventId, name: expense.eventName }
                : null
            }
            fromEvent={Boolean(presetEventId) && values.eventId === presetEventId}
            onChange={change}
            disabled={pending}
          />
          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-end">
            {!expense && (
              <p className="flex items-center gap-1.5 text-body-sm text-on-surface-variant sm:mr-auto">
                <Icon name="info" className="size-4" />
                {expenseForm.addPaymentsNote}
              </p>
            )}
            <Link
              href={cancelHref}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-outline-variant/70 bg-white px-5 text-label-md text-navy transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-secondary"
            >
              {expenseForm.cancel}
            </Link>
            <PrimaryButton type="submit" pending={pending} pendingLabel={expenseForm.saving}>
              {expenseForm.save}
            </PrimaryButton>
          </div>
        </form>
      </section>
    </div>
  );
}

const counter = (value: string, max: number) =>
  `${value.trim().length.toLocaleString('en-IN')} / ${max.toLocaleString('en-IN')}`;

const required = (label: string) => (
  <>
    {label}
    <span className="text-error"> *</span>
  </>
);

/** The E3 fields, in the approved order. */
function ExpenseFields({
  values,
  errors,
  events,
  vendors,
  linkedVendor,
  linkedEvent,
  fromEvent,
  onChange,
  disabled,
}: {
  values: ExpenseFormValues;
  errors: ExpenseFormErrors;
  /** Null while loading. */
  events: ApiEvent[] | null;
  vendors: ApiVendor[] | null;
  linkedVendor: { id: string; name: string | null; deleted: boolean } | null;
  /** The expense's event as loaded, shown even if the events list fails or lacks it. */
  linkedEvent: { id: string; name: string | null } | null;
  /** True while the event preset from an event's shortcut is still chosen. */
  fromEvent: boolean;
  onChange: <K extends keyof ExpenseFormValues>(field: K, value: ExpenseFormValues[K]) => void;
  disabled: boolean;
}) {
  const ids = {
    title: useId(),
    amount: useId(),
    category: useId(),
    expenseDate: useId(),
    event: useId(),
    vendor: useId(),
    notes: useId(),
  };
  const select = `${controlClasses} min-h-11 appearance-none py-2.5 pr-10 pl-3`;
  const chevron = (
    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-outline">
      <Icon name="keyboard_arrow_down" className="size-5" />
    </span>
  );
  const eventHint = fromEvent ? expenseFields.event.fromEventHint : undefined;

  return (
    <div className="space-y-5">
      <Field
        id={ids.title}
        label={required(expenseFields.title.label)}
        error={errors.title}
        aside={counter(values.title, ExpenseLimits.title)}
      >
        <input
          id={ids.title}
          name="title"
          value={values.title}
          onChange={(changeEvent) => onChange('title', changeEvent.target.value)}
          placeholder={expenseFields.title.placeholder}
          disabled={disabled}
          autoComplete="off"
          aria-required
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={describedBy(ids.title, errors.title)}
          className={`${controlClasses} min-h-11 px-3 py-2.5`}
        />
      </Field>

      <Field
        id={ids.amount}
        label={required(expenseFields.amount.label)}
        error={errors.amount}
        hint={expenseFields.amount.hint}
      >
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-body-md text-on-surface-variant"
          >
            ₹
          </span>
          <input
            id={ids.amount}
            name="amount"
            inputMode="decimal"
            value={values.amount}
            onChange={(changeEvent) => onChange('amount', changeEvent.target.value)}
            placeholder="0"
            disabled={disabled}
            autoComplete="off"
            aria-required
            aria-invalid={errors.amount ? true : undefined}
            aria-describedby={describedBy(ids.amount, errors.amount, expenseFields.amount.hint)}
            className={`${controlClasses} min-h-11 py-2.5 pr-3 pl-8 tabular-nums`}
          />
        </div>
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id={ids.category}
          label={required(expenseFields.category.label)}
          error={errors.category}
        >
          <div className="relative">
            <select
              id={ids.category}
              name="category"
              value={values.category}
              onChange={(changeEvent) =>
                onChange('category', changeEvent.target.value as ExpenseFormValues['category'])
              }
              disabled={disabled}
              aria-required
              aria-invalid={errors.category ? true : undefined}
              aria-describedby={describedBy(ids.category, errors.category)}
              className={select}
            >
              <option value="" disabled>
                {expenseFields.category.placeholder}
              </option>
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {categoryLabels[category]}
                </option>
              ))}
            </select>
            {chevron}
          </div>
        </Field>

        <Field
          id={ids.expenseDate}
          label={required(expenseFields.expenseDate.label)}
          error={errors.expenseDate}
        >
          <input
            id={ids.expenseDate}
            name="expenseDate"
            type="date"
            value={values.expenseDate}
            onChange={(changeEvent) => onChange('expenseDate', changeEvent.target.value)}
            disabled={disabled}
            aria-required
            aria-invalid={errors.expenseDate ? true : undefined}
            aria-describedby={describedBy(ids.expenseDate, errors.expenseDate)}
            className={`${controlClasses} min-h-11 px-3 py-2.5`}
          />
        </Field>
      </div>

      <Field
        id={ids.event}
        label={expenseFields.event.label}
        error={errors.eventId}
        hint={eventHint}
      >
        <div className="relative">
          <select
            id={ids.event}
            name="eventId"
            value={values.eventId}
            onChange={(changeEvent) => onChange('eventId', changeEvent.target.value)}
            disabled={disabled || events === null}
            aria-describedby={describedBy(ids.event, errors.eventId, eventHint)}
            className={select}
          >
            <option value="">{expensesPage.wholeWedding}</option>
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

      <Field id={ids.vendor} label={expenseFields.vendor.label}>
        <div className="relative">
          <select
            id={ids.vendor}
            name="vendorId"
            value={values.vendorId}
            onChange={(changeEvent) => onChange('vendorId', changeEvent.target.value)}
            disabled={disabled || vendors === null}
            className={select}
          >
            <option value="">{expenseFields.vendor.none}</option>
            {linkedVendor && !(vendors ?? []).some((vendor) => vendor.id === linkedVendor.id) && (
              <option value={linkedVendor.id}>
                {linkedVendor.name ?? linkedVendor.id}
                {linkedVendor.deleted ? ' (deleted)' : ''}
              </option>
            )}
            {(vendors ?? []).map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
          {chevron}
        </div>
      </Field>

      <Field
        id={ids.notes}
        label={expenseFields.notes.label}
        error={errors.notes}
        aside={counter(values.notes, ExpenseLimits.notes)}
      >
        <textarea
          id={ids.notes}
          name="notes"
          rows={3}
          value={values.notes}
          onChange={(changeEvent) => onChange('notes', changeEvent.target.value)}
          placeholder={expenseFields.notes.placeholder}
          disabled={disabled}
          aria-invalid={errors.notes ? true : undefined}
          aria-describedby={describedBy(ids.notes, errors.notes)}
          className={`${controlClasses} resize-y p-3 leading-relaxed`}
        />
      </Field>
    </div>
  );
}
