'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Banner,
  controlClasses,
  describedBy,
  Field,
  PrimaryButton,
  QuietButton,
} from '@/components/ui/form';
import { Icon, type IconName } from '@/components/ui/icon';
import { networkError } from '@/features/weddings/content';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import { EVENTS_PATH } from '@/features/workspace/components/shell-parts';
import { PageHeader, SkeletonCard } from '@/features/workspace/components/workspace-page';
import { SESSION_ENDED_PATH, useReadyWorkspace } from '@/features/workspace/workspace-context';
import { api, call } from '@/lib/api';
import {
  deleteEvent,
  eventFields,
  eventForm,
  eventNotAvailable,
  eventsPage,
  eventTypeLabels,
} from '../content';
import {
  EVENT_TYPES,
  EventLimits,
  emptyEventForm,
  errorsFromApi,
  formFromEvent,
  toEventPayload,
  validateEventForm,
  type ApiEvent,
  type EventFormErrors,
  type EventFormField,
  type EventFormValues,
} from '../event-model';

type Banner = 'saved' | 'server' | 'network' | null;

/** `/events/new`: Stitch "P4 · O3 Event Form". */
export function AddEventPage({ wedding }: { wedding: ApiWedding }) {
  return <EventForm wedding={wedding} event={null} />;
}

/** `/events/[eventId]`: the same form, filled in, with Delete (O4). */
export function EditEventPage({ wedding, eventId }: { wedding: ApiWedding; eventId: string }) {
  const router = useRouter();
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'gone' }
    | { status: 'error' }
    | { status: 'ready'; event: ApiEvent }
  >({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void call(() =>
      api.GET('/api/v1/weddings/{weddingId}/events/{eventId}', {
        params: { path: { weddingId: wedding.id, eventId } },
      }),
    ).then((result) => {
      if (!active) return;
      if (result.data) setState({ status: 'ready', event: result.data });
      else if (result.error.status === 401) router.replace(SESSION_ENDED_PATH);
      else if (result.error.status === 404) setState({ status: 'gone' });
      else setState({ status: 'error' });
    });
    return () => {
      active = false;
    };
  }, [wedding.id, eventId, attempt, router]);

  if (state.status === 'gone') return <EventNotAvailable />;
  if (state.status === 'error') {
    return (
      <div className="space-y-4">
        <Banner tone="error" icon="error">
          {eventForm.serverError}
        </Banner>
        <PrimaryButton icon="refresh" onClick={() => setAttempt((value) => value + 1)}>
          {eventsPage.retry}
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
  return <EventForm key={state.event.id} wedding={wedding} event={state.event} />;
}

function EventForm({ wedding, event }: { wedding: ApiWedding; event: ApiEvent | null }) {
  const router = useRouter();
  const { setNotice } = useReadyWorkspace();
  const [current, setCurrent] = useState(event);
  const [values, setValues] = useState<EventFormValues>(() =>
    event ? formFromEvent(event) : emptyEventForm,
  );
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [banner, setBanner] = useState<Banner>(null);
  const [pending, setPending] = useState(false);
  // Set synchronously, so a second submit is ignored even before the button re-renders as
  // disabled — e.g. a quick second Enter (review M8).
  const submitting = useRef(false);

  function setSaving(value: boolean) {
    submitting.current = value;
    setPending(value);
  }
  const [gone, setGone] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();

  function change(field: EventFormField, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: undefined }));
    if (banner === 'saved') setBanner(null);
  }

  async function save(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (submitting.current) return;
    setBanner(null);
    const found = validateEventForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    const body = toEventPayload(values);
    const result = current
      ? await call(() =>
          api.PATCH('/api/v1/weddings/{weddingId}/events/{eventId}', {
            params: { path: { weddingId: wedding.id, eventId: current.id } },
            body,
          }),
        )
      : await call(() =>
          api.POST('/api/v1/weddings/{weddingId}/events', {
            params: { path: { weddingId: wedding.id } },
            body,
          }),
        );
    if (result.data) {
      if (!current) {
        // Stay busy until the page changes, so a quick second submit cannot create a
        // duplicate event (review M8).
        router.push(EVENTS_PATH);
        return;
      }
      setSaving(false);
      setCurrent(result.data);
      setValues(formFromEvent(result.data));
      setBanner('saved');
      return;
    }
    setSaving(false);
    const { status, code, fields } = result.error;
    if (status === 401) router.replace(SESSION_ENDED_PATH);
    else if (status === 404) setGone(true);
    else if (code === 'VALIDATION_FAILED') setErrors(errorsFromApi(fields));
    else setBanner(status === 0 ? 'network' : 'server');
  }

  const cancelDelete = useCallback(() => {
    setConfirming(false);
    setDeleteError(undefined);
  }, []);

  async function confirmDelete() {
    if (!current) return;
    setDeleting(true);
    setDeleteError(undefined);
    const result = await call(() =>
      api.DELETE('/api/v1/weddings/{weddingId}/events/{eventId}', {
        params: { path: { weddingId: wedding.id, eventId: current.id } },
      }),
    );
    setDeleting(false);
    if (!result.error || result.error.status === 404) {
      setNotice('event-deleted');
      router.push(EVENTS_PATH);
    } else if (result.error.status === 401) {
      router.replace(SESSION_ENDED_PATH);
    } else {
      setDeleteError(result.error.status === 0 ? networkError : deleteEvent.error);
    }
  }

  if (gone) return <EventNotAvailable />;

  return (
    <div className="max-w-[720px]">
      <PageHeader
        title={current ? eventForm.editTitle : eventForm.addTitle}
        subtitle={eventForm.subtitle}
        back={{ href: EVENTS_PATH, label: eventForm.back }}
      />

      <section className="rounded-xl border border-hairline bg-white p-6 shadow-sm sm:p-8">
        <div className="space-y-4 empty:hidden">
          {banner === 'saved' && (
            <Banner tone="success" icon="check_circle">
              {eventForm.saved}
            </Banner>
          )}
          {banner === 'server' && (
            <Banner tone="error" icon="error">
              {eventForm.serverError}
            </Banner>
          )}
          {banner === 'network' && (
            <Banner tone="error" icon="wifi_off">
              {networkError}
            </Banner>
          )}
        </div>

        <form onSubmit={(formEvent) => void save(formEvent)} noValidate className="mt-6 first:mt-0">
          <EventFields values={values} errors={errors} onChange={change} disabled={pending} />
          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {current && (
                <QuietButton
                  icon="delete"
                  onClick={() => setConfirming(true)}
                  disabled={pending}
                  tone="danger"
                >
                  {eventForm.delete}
                </QuietButton>
              )}
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Link
                href={EVENTS_PATH}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-outline-variant/70 bg-white px-5 text-label-md text-navy transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-secondary"
              >
                {eventForm.cancel}
              </Link>
              <PrimaryButton
                type="submit"
                pending={pending}
                pendingLabel={eventForm.saving}
                icon="arrow_forward"
              >
                {eventForm.save}
              </PrimaryButton>
            </div>
          </div>
        </form>
      </section>

      {confirming && current && (
        <ConfirmDialog
          title={deleteEvent.title}
          body={deleteEvent.body.replace('{name}', current.name)}
          icon="calendar_today"
          confirmLabel={deleteEvent.confirm}
          cancelLabel={deleteEvent.cancel}
          pendingLabel={deleteEvent.deleting}
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

interface FieldsProps {
  values: EventFormValues;
  errors: EventFormErrors;
  onChange: (field: EventFormField, value: string) => void;
  disabled: boolean;
}

const limitLabel = (max: number) => eventFields.atMost.replace('{max}', String(max));
const counter = (value: string, max: number) =>
  `${value.trim().length.toLocaleString('en-IN')} / ${max.toLocaleString('en-IN')}`;

function TextField({
  field,
  label,
  placeholder,
  icon,
  hint,
  aside,
  required,
  inputMode,
  type = 'text',
  props,
}: {
  field: Exclude<EventFormField, 'type' | 'description' | 'notes'>;
  label: string;
  placeholder: string;
  icon?: IconName;
  hint?: string;
  aside?: string;
  required?: boolean;
  inputMode?: 'numeric';
  /** "date" opens the browser's calendar; it still accepts typing, and allows past dates. */
  type?: 'text' | 'date';
  props: FieldsProps;
}) {
  const id = useId();
  const error = props.errors[field];
  return (
    <Field
      id={id}
      label={
        <>
          {label}
          {required && <span className="text-error"> *</span>}
        </>
      }
      error={error}
      hint={hint}
      aside={aside}
    >
      <div className="relative">
        <input
          id={id}
          name={field}
          type={type}
          inputMode={inputMode}
          autoComplete="off"
          value={props.values[field]}
          onChange={(changeEvent) => props.onChange(field, changeEvent.target.value)}
          placeholder={placeholder}
          disabled={props.disabled}
          aria-required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={`${controlClasses} min-h-11 py-2.5 pl-3 ${icon ? 'pr-10' : 'pr-3'}`}
        />
        {icon && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-outline">
            <Icon name={icon} className="size-5" />
          </span>
        )}
      </div>
    </Field>
  );
}

function TextAreaField({
  field,
  label,
  placeholder,
  max,
  hint,
  props,
}: {
  field: 'description' | 'notes';
  label: string;
  placeholder: string;
  max: number;
  hint?: string;
  props: FieldsProps;
}) {
  const id = useId();
  const error = props.errors[field];
  const value = props.values[field];
  return (
    <Field id={id} label={label} error={error} hint={hint} aside={counter(value, max)}>
      <textarea
        id={id}
        name={field}
        rows={3}
        value={value}
        onChange={(changeEvent) => props.onChange(field, changeEvent.target.value)}
        placeholder={placeholder}
        disabled={props.disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${controlClasses} resize-y p-3 leading-relaxed`}
      />
    </Field>
  );
}

/** The O3 fields, in the approved order. */
function EventFields(props: FieldsProps) {
  const typeId = useId();
  const typeError = props.errors.type;
  return (
    <div className="space-y-5">
      <TextField
        field="name"
        label={eventFields.name.label}
        placeholder={eventFields.name.placeholder}
        aside={counter(props.values.name, EventLimits.name)}
        required
        props={props}
      />

      <Field
        id={typeId}
        label={
          <>
            {eventFields.type.label}
            <span className="text-error"> *</span>
          </>
        }
        error={typeError}
      >
        <div className="relative">
          <select
            id={typeId}
            name="type"
            value={props.values.type}
            onChange={(changeEvent) => props.onChange('type', changeEvent.target.value)}
            disabled={props.disabled}
            aria-required
            aria-invalid={typeError ? true : undefined}
            aria-describedby={describedBy(typeId, typeError)}
            className={`${controlClasses} min-h-11 appearance-none py-2.5 pr-10 pl-3`}
          >
            <option value="">{eventFields.type.placeholder}</option>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {eventTypeLabels[type]}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-outline">
            <Icon name="keyboard_arrow_down" className="size-5" />
          </span>
        </div>
      </Field>

      <TextField
        field="date"
        label={eventFields.date.label}
        placeholder={eventFields.date.placeholder}
        hint={eventFields.date.hint}
        type="date"
        required
        props={props}
      />

      <div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            field="startTime"
            label={eventFields.startTime.label}
            placeholder={eventFields.startTime.placeholder}
            icon="schedule"
            inputMode="numeric"
            props={props}
          />
          <TextField
            field="endTime"
            label={eventFields.endTime.label}
            placeholder={eventFields.endTime.placeholder}
            icon="schedule"
            inputMode="numeric"
            props={props}
          />
        </div>
        <p className="mt-1.5 text-body-sm text-on-surface-variant">{eventFields.timesHint}</p>
      </div>

      <TextAreaField
        field="description"
        label={eventFields.description.label}
        placeholder={eventFields.description.placeholder}
        max={EventLimits.description}
        props={props}
      />
      <TextField
        field="venueName"
        label={eventFields.venueName.label}
        placeholder={eventFields.venueName.placeholder}
        aside={limitLabel(EventLimits.venueName)}
        props={props}
      />
      <TextField
        field="venueAddress"
        label={eventFields.venueAddress.label}
        placeholder={eventFields.venueAddress.placeholder}
        aside={limitLabel(EventLimits.venueAddress)}
        props={props}
      />
      <TextField
        field="dressCode"
        label={eventFields.dressCode.label}
        placeholder={eventFields.dressCode.placeholder}
        aside={limitLabel(EventLimits.dressCode)}
        props={props}
      />
      <TextAreaField
        field="notes"
        label={eventFields.notes.label}
        placeholder={eventFields.notes.placeholder}
        hint={eventFields.notes.hint}
        max={EventLimits.notes}
        props={props}
      />
    </div>
  );
}

/** Stitch "P4 · O4" event-not-available state (decision 0021). */
export function EventNotAvailable() {
  return (
    <section className="mx-auto mt-6 max-w-[520px] rounded-xl border border-hairline bg-white p-8 text-center shadow-sm sm:mt-16 sm:p-10">
      <span className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full border border-champagne/40 bg-[#faf1e4] text-secondary">
        <Icon name="lock" className="size-7" />
      </span>
      <h1 className="mb-3 font-serif text-headline-md text-navy">{eventNotAvailable.title}</h1>
      <p className="mx-auto mb-7 max-w-[340px] text-body-md text-on-surface-variant">
        {eventNotAvailable.body}
      </p>
      <Link
        href={EVENTS_PATH}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-navy px-6 text-label-md text-on-primary transition-colors hover:bg-[#1e293b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      >
        <Icon name="arrow_back" className="size-4" />
        {eventNotAvailable.back}
      </Link>
    </section>
  );
}
