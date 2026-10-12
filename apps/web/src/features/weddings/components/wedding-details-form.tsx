'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { DASHBOARD_PATH } from '@/features/workspace/components/shell-parts';
import { SESSION_ENDED_PATH, useReadyWorkspace } from '@/features/workspace/workspace-context';
import { api, call } from '@/lib/api';
import { networkError, weddingDetailsPage } from '../content';
import {
  errorsFromApi,
  formFromWedding,
  toWeddingPayload,
  validateWeddingForm,
  type ApiWedding,
  type WeddingFormErrors,
  type WeddingFormField,
} from '../wedding-form-model';
import { NotAvailable } from './not-available';
import { FormBanner, PrimaryButton, WeddingFormFields } from './wedding-form-fields';

type Banner = 'server' | 'network' | null;

/**
 * Stitch "P3 · S5 Wedding Details". Saving returns to the dashboard, which shows "Your changes
 * have been saved."; Cancel restores the saved values without asking (decision 0016).
 */
export function WeddingDetailsForm({ wedding }: { wedding: ApiWedding }) {
  const router = useRouter();
  const { setWedding, setNotice } = useReadyWorkspace();
  const [values, setValues] = useState(() => formFromWedding(wedding));
  const [errors, setErrors] = useState<WeddingFormErrors>({});
  const [banner, setBanner] = useState<Banner>(null);
  const [pending, setPending] = useState(false);
  const [gone, setGone] = useState(false);

  function change(field: WeddingFormField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function cancel() {
    setValues(formFromWedding(wedding));
    setErrors({});
    setBanner(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBanner(null);
    const found = validateWeddingForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setPending(true);
    const result = await call(() =>
      api.PATCH('/api/v1/weddings/{weddingId}', {
        params: { path: { weddingId: wedding.id } },
        body: toWeddingPayload(values),
      }),
    );
    setPending(false);
    if (result.data) {
      // Saving returns to the dashboard, which confirms the save (product owner, 2026-10-12;
      // amends 0016, which kept the user on this page).
      setWedding(result.data);
      setNotice('wedding-saved');
      router.push(DASHBOARD_PATH);
      return;
    }

    const { status, code, fields } = result.error;
    if (status === 401) router.replace(SESSION_ENDED_PATH);
    else if (status === 404) setGone(true);
    else if (code === 'VALIDATION_FAILED') setErrors(errorsFromApi(fields));
    else setBanner(status === 0 ? 'network' : 'server');
  }

  if (gone) return <NotAvailable />;

  return (
    <div className="max-w-[680px]">
      <h1 className="mb-1 font-serif text-headline-md font-normal text-navy sm:text-headline-lg sm:font-normal">
        {weddingDetailsPage.title}
      </h1>
      <p className="mb-6 text-body-md text-on-surface-variant">{weddingDetailsPage.subtitle}</p>

      <section className="rounded-xl border border-hairline bg-white p-6 shadow-sm sm:p-8">
        {banner === 'server' && (
          <FormBanner tone="error" icon="error">
            {weddingDetailsPage.serverError}
          </FormBanner>
        )}
        {banner === 'network' && (
          <FormBanner tone="error" icon="wifi_off">
            {networkError}
          </FormBanner>
        )}

        <form onSubmit={(event) => void save(event)} noValidate>
          <WeddingFormFields values={values} errors={errors} onChange={change} disabled={pending} />
          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-hairline pt-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={cancel}
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-outline-variant/70 bg-white px-5 text-label-md text-navy transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-secondary disabled:cursor-not-allowed disabled:text-outline"
            >
              {weddingDetailsPage.cancel}
            </button>
            <PrimaryButton pending={pending} pendingLabel={weddingDetailsPage.saving}>
              {weddingDetailsPage.save}
            </PrimaryButton>
          </div>
        </form>
      </section>
    </div>
  );
}
