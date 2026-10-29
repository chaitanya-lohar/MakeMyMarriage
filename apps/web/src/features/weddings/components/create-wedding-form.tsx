'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Icon } from '@/components/ui/icon';
import { DASHBOARD_PATH } from '@/features/workspace/components/shell-parts';
import { SESSION_ENDED_PATH, useWorkspace } from '@/features/workspace/workspace-context';
import { api, call } from '@/lib/api';
import { createWedding, networkError } from '../content';
import {
  emptyWeddingForm,
  errorsFromApi,
  toWeddingPayload,
  validateWeddingForm,
  type WeddingFormErrors,
  type WeddingFormField,
} from '../wedding-form-model';
import { FormBanner, PrimaryButton, WeddingFormFields } from './wedding-form-fields';

type Problem = 'server' | 'network' | 'already-owned' | null;

/** Stitch "P3 · S3 Create Wedding" and its submission states (decision 0016). */
export function CreateWeddingForm() {
  const router = useRouter();
  const { weddingCreated, setNotice, reload } = useWorkspace();
  const [values, setValues] = useState(emptyWeddingForm);
  const [errors, setErrors] = useState<WeddingFormErrors>({});
  const [problem, setProblem] = useState<Problem>(null);
  const [pending, setPending] = useState(false);

  function change(field: WeddingFormField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem(null);
    const found = validateWeddingForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setPending(true);
    const result = await call(() =>
      api.POST('/api/v1/weddings', { body: toWeddingPayload(values) }),
    );
    if (result.data) {
      setNotice('wedding-created');
      weddingCreated(result.data);
      router.push(DASHBOARD_PATH);
      return;
    }

    setPending(false);
    const { status, code, fields } = result.error;
    if (status === 401) router.replace(SESSION_ENDED_PATH);
    else if (code === 'WEDDING_ALREADY_OWNED') setProblem('already-owned');
    else if (code === 'VALIDATION_FAILED') setErrors(errorsFromApi(fields));
    else setProblem(status === 0 ? 'network' : 'server');
  }

  function goToDashboard() {
    // The wedding was created elsewhere; load it before showing the dashboard.
    reload();
    router.push(DASHBOARD_PATH);
  }

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <Link
        href={DASHBOARD_PATH}
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-label-sm text-on-surface-variant transition-colors hover:text-navy focus-visible:outline-2 focus-visible:outline-secondary"
      >
        <Icon name="arrow_back" className="size-4" />
        {createWedding.back}
      </Link>

      <section className="rounded-xl border border-hairline bg-white p-6 shadow-sm sm:p-8">
        <h1 className="mb-2 font-serif text-headline-md text-navy">{createWedding.title}</h1>
        <p className="mb-8 text-body-sm text-on-surface-variant">{createWedding.subtitle}</p>

        {problem === 'server' && (
          <FormBanner tone="error" icon="error">
            {createWedding.serverError}
          </FormBanner>
        )}
        {problem === 'network' && (
          <FormBanner tone="error" icon="wifi_off">
            {networkError}
          </FormBanner>
        )}
        {problem === 'already-owned' && (
          <div
            role="alert"
            className="mb-6 flex flex-col gap-3 rounded-lg bg-navy p-4 text-white sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-2.5">
              <Icon name="info" className="mt-0.5 size-5 text-secondary-fixed" />
              <div>
                <p className="text-sm font-semibold">{createWedding.alreadyOwnedTitle}</p>
                <p className="text-xs text-white/80">{createWedding.alreadyOwnedBody}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={goToDashboard}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-secondary-fixed px-4 text-xs font-semibold text-navy transition-colors hover:bg-secondary-fixed-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {createWedding.goToDashboard}
              <Icon name="arrow_forward" className="size-4" />
            </button>
          </div>
        )}

        <form onSubmit={(event) => void submit(event)} noValidate>
          <WeddingFormFields values={values} errors={errors} onChange={change} disabled={pending} />
          <div className="flex justify-end pt-8">
            <PrimaryButton
              pending={pending}
              pendingLabel={createWedding.submitting}
              className="w-full sm:w-auto"
            >
              {createWedding.submit}
            </PrimaryButton>
          </div>
        </form>
      </section>
    </div>
  );
}
