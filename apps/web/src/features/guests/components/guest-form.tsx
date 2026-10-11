'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Banner, controlClasses, describedBy, Field, PrimaryButton } from '@/components/ui/form';
import { networkError } from '@/features/weddings/content';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import { GUESTS_PATH } from '@/features/workspace/components/shell-parts';
import { PageHeader, SkeletonCard } from '@/features/workspace/components/workspace-page';
import { SESSION_ENDED_PATH } from '@/features/workspace/workspace-context';
import { api, call } from '@/lib/api';
import { guestDetail, guestFields, guestForm } from '../content';
import {
  emptyGuestForm,
  errorsFromApi,
  formFromGuest,
  GuestLimits,
  toGuestPayload,
  validateGuestForm,
  type ApiGuest,
  type GuestFormErrors,
  type GuestFormField,
  type GuestFormValues,
} from '../guest-model';
import { GuestNotAvailable } from './guest-not-available';

/** `/guests/new`: Stitch "P4 · O6 Guest Form". */
export function AddGuestPage({ wedding }: { wedding: ApiWedding }) {
  return <GuestForm wedding={wedding} guest={null} />;
}

/** `/guests/[guestId]/edit`. */
export function EditGuestPage({ wedding, guestId }: { wedding: ApiWedding; guestId: string }) {
  const router = useRouter();
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'gone' }
    | { status: 'error' }
    | { status: 'ready'; guest: ApiGuest }
  >({ status: 'loading' });

  useEffect(() => {
    let active = true;
    void call(() =>
      api.GET('/api/v1/weddings/{weddingId}/guests/{guestId}', {
        params: { path: { weddingId: wedding.id, guestId } },
      }),
    ).then((result) => {
      if (!active) return;
      if (result.data) setState({ status: 'ready', guest: result.data });
      else if (result.error.status === 401) router.replace(SESSION_ENDED_PATH);
      else if (result.error.status === 404) setState({ status: 'gone' });
      else setState({ status: 'error' });
    });
    return () => {
      active = false;
    };
  }, [wedding.id, guestId, router]);

  if (state.status === 'gone') return <GuestNotAvailable />;
  if (state.status === 'error') {
    return (
      <Banner tone="error" icon="error">
        {guestDetail.loadError}
      </Banner>
    );
  }
  if (state.status === 'loading') {
    return (
      <div className="space-y-4" aria-busy="true">
        <SkeletonCard className="h-16" />
        <SkeletonCard className="h-80" />
      </div>
    );
  }
  return <GuestForm wedding={wedding} guest={state.guest} />;
}

type Banner = 'server' | 'network' | null;

function GuestForm({ wedding, guest }: { wedding: ApiWedding; guest: ApiGuest | null }) {
  const router = useRouter();
  const [saved, setSaved] = useState(guest);
  const [values, setValues] = useState<GuestFormValues>(() =>
    guest ? formFromGuest(guest) : emptyGuestForm,
  );
  const [errors, setErrors] = useState<GuestFormErrors>({});
  const [banner, setBanner] = useState<Banner>(null);
  const [duplicates, setDuplicates] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [gone, setGone] = useState(false);

  function change(field: GuestFormField, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBanner(null);
    const found = validateGuestForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setPending(true);
    const body = toGuestPayload(values);
    const result = saved
      ? await call(() =>
          api.PATCH('/api/v1/weddings/{weddingId}/guests/{guestId}', {
            params: { path: { weddingId: wedding.id, guestId: saved.id } },
            body,
          }),
        )
      : await call(() =>
          api.POST('/api/v1/weddings/{weddingId}/guests', {
            params: { path: { weddingId: wedding.id } },
            body,
          }),
        );
    setPending(false);

    if (result.data) {
      const { guest: stored, duplicateMobileGuests } = result.data;
      if (duplicateMobileGuests.length === 0) {
        router.push(`${GUESTS_PATH}/${stored.id}`);
        return;
      }
      // Saved, with a warning only (0017 #13): stay so the organizer can check.
      setSaved(stored);
      setValues(formFromGuest(stored));
      setDuplicates(duplicateMobileGuests.map((other) => other.name));
      return;
    }
    const { status, code, fields } = result.error;
    if (status === 401) router.replace(SESSION_ENDED_PATH);
    else if (status === 404) setGone(true);
    else if (code === 'VALIDATION_FAILED') setErrors(errorsFromApi(fields));
    else setBanner(status === 0 ? 'network' : 'server');
  }

  if (gone) return <GuestNotAvailable />;
  const back = saved
    ? { href: `${GUESTS_PATH}/${saved.id}`, label: guestForm.backToGuest }
    : { href: GUESTS_PATH, label: guestForm.back };

  return (
    <div className="max-w-[680px]">
      <PageHeader
        title={guest ? guestForm.editTitle : guestForm.addTitle}
        subtitle={guestForm.subtitle}
        back={back}
      />

      <section className="rounded-xl border border-hairline bg-white p-6 shadow-sm sm:p-8">
        <div className="space-y-4 empty:hidden">
          {duplicates.length > 0 && saved && (
            <Banner tone="info" icon="info">
              <p>{guestForm.duplicate.replace('{names}', duplicates.join(', '))}</p>
              <Link
                href={`${GUESTS_PATH}/${saved.id}`}
                className="mt-2 inline-flex min-h-11 items-center font-semibold text-navy underline underline-offset-2"
              >
                {guestForm.viewGuest}
              </Link>
            </Banner>
          )}
          {banner === 'server' && (
            <Banner tone="error" icon="error">
              {guestForm.serverError}
            </Banner>
          )}
          {banner === 'network' && (
            <Banner tone="error" icon="wifi_off">
              {networkError}
            </Banner>
          )}
        </div>

        <form onSubmit={(event) => void save(event)} noValidate className="mt-6 first:mt-0">
          <div className="space-y-5">
            <GuestTextField
              field="name"
              required
              values={values}
              errors={errors}
              onChange={change}
              disabled={pending}
            />
            <GuestTextField
              field="mobile"
              required
              inputMode="tel"
              values={values}
              errors={errors}
              onChange={change}
              disabled={pending}
            />
            <GuestTextField
              field="email"
              inputMode="email"
              values={values}
              errors={errors}
              onChange={change}
              disabled={pending}
            />
            <GuestTextField
              field="relation"
              values={values}
              errors={errors}
              onChange={change}
              disabled={pending}
            />
            <NotesField values={values} errors={errors} onChange={change} disabled={pending} />
          </div>
          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-hairline pt-6 sm:flex-row sm:justify-end">
            <Link
              href={back.href}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-outline-variant/70 bg-white px-5 text-label-md text-navy transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-secondary"
            >
              {guestForm.cancel}
            </Link>
            <PrimaryButton
              type="submit"
              pending={pending}
              pendingLabel={guestForm.saving}
              icon="arrow_forward"
            >
              {guestForm.save}
            </PrimaryButton>
          </div>
        </form>
      </section>
    </div>
  );
}

interface FieldProps {
  values: GuestFormValues;
  errors: GuestFormErrors;
  onChange: (field: GuestFormField, value: string) => void;
  disabled: boolean;
}

const limits: Partial<Record<GuestFormField, number>> = {
  name: GuestLimits.name,
  email: GuestLimits.email,
  relation: GuestLimits.relation,
};

function GuestTextField({
  field,
  required,
  inputMode,
  ...props
}: FieldProps & {
  field: 'name' | 'mobile' | 'email' | 'relation';
  required?: boolean;
  inputMode?: 'tel' | 'email';
}) {
  const id = useId();
  const copy = guestFields[field];
  const hint = 'hint' in copy ? copy.hint : undefined;
  const error = props.errors[field];
  const max = limits[field];
  return (
    <Field
      id={id}
      label={
        <>
          {copy.label}
          {required && <span className="text-error"> *</span>}
        </>
      }
      error={error}
      hint={hint}
      aside={max ? guestFields.atMost.replace('{max}', String(max)) : undefined}
    >
      <input
        id={id}
        name={field}
        type={field === 'email' ? 'email' : 'text'}
        inputMode={inputMode}
        autoComplete="off"
        value={props.values[field]}
        onChange={(event) => props.onChange(field, event.target.value)}
        placeholder={copy.placeholder}
        disabled={props.disabled}
        aria-required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${controlClasses} min-h-11 px-3 py-2.5`}
      />
    </Field>
  );
}

function NotesField(props: FieldProps) {
  const id = useId();
  const error = props.errors.notes;
  const length = props.values.notes.trim().length;
  return (
    <Field
      id={id}
      label={guestFields.notes.label}
      error={error}
      hint={guestFields.notes.hint}
      aside={`${length.toLocaleString('en-IN')} / ${GuestLimits.notes.toLocaleString('en-IN')}`}
    >
      <textarea
        id={id}
        name="notes"
        rows={3}
        value={props.values.notes}
        onChange={(event) => props.onChange('notes', event.target.value)}
        placeholder={guestFields.notes.placeholder}
        disabled={props.disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, guestFields.notes.hint)}
        className={`${controlClasses} resize-y p-3 leading-relaxed`}
      />
    </Field>
  );
}
