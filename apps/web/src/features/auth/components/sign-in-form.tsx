'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Icon } from '@/components/ui/icon';
import { api, call } from '@/lib/api';
import { networkError, signIn } from '../content';
import { FormFeedback, formText, SubmitButton, TextField } from './form-controls';

export type SignInNotice = 'password-updated' | 'session-ended';

/** Stitch "Sign In (V1)". */
export function SignInForm({ notice }: { notice?: SignInNotice }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = formText(form, 'email').trim();
    const password = formText(form, 'password');
    if (!email || !password) {
      setError(signIn.missingFields);
      return;
    }

    setPending(true);
    setError(undefined);
    const result = await call(() =>
      api.POST('/api/v1/auth/login', {
        body: { email, password, rememberMe: form.get('rememberMe') === 'on' },
      }),
    );
    if (result.error) {
      setPending(false);
      setError(result.error.status === 0 ? networkError : result.error.message);
      return;
    }
    router.replace('/dashboard');
  }

  return (
    <>
      {error ? (
        <FormFeedback tone="error">{error}</FormFeedback>
      ) : notice === 'password-updated' ? (
        <FormFeedback tone="success">{signIn.passwordUpdated}</FormFeedback>
      ) : (
        notice === 'session-ended' && (
          <FormFeedback tone="error">{signIn.sessionEnded}</FormFeedback>
        )
      )}

      <form className="space-y-5" onSubmit={(event) => void onSubmit(event)} noValidate>
        <TextField
          label={signIn.emailLabel}
          name="email"
          type="email"
          autoComplete="email"
          placeholder={signIn.emailPlaceholder}
          icon="mail"
          required
        />
        <TextField
          label={signIn.passwordLabel}
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder={signIn.passwordPlaceholder}
          required
        />
        <div className="flex items-center justify-between gap-4 pt-1">
          <label className="group flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="rememberMe"
              className="size-4 cursor-pointer rounded border-outline-variant accent-navy"
            />
            <span className="text-body-sm text-on-surface-variant transition-colors group-hover:text-on-surface">
              {signIn.rememberMe}
            </span>
          </label>
          <Link
            href="/forgot-password"
            className="text-body-sm font-medium text-secondary underline-offset-4 transition-colors duration-150 hover:text-on-secondary-container hover:underline"
          >
            {signIn.forgotPassword}
          </Link>
        </div>
        <div className="pt-2">
          <SubmitButton pending={pending} pendingLabel={signIn.submitting}>
            {signIn.submit}
          </SubmitButton>
        </div>
      </form>

      <div className="mt-8 border-t border-outline-variant/30 pt-6 text-center">
        <p className="text-body-md text-on-surface-variant">
          {signIn.newHere}
          <Link
            href="/signup"
            className="group ml-1 inline-flex items-center gap-1 text-title-md text-primary transition-colors duration-150 hover:text-secondary"
          >
            <span>{signIn.createLink}</span>
            <Icon
              name="north_east"
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </p>
      </div>
    </>
  );
}
