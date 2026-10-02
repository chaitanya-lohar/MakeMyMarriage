'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Icon } from '@/components/ui/icon';
import { api, call } from '@/lib/api';
import { forgotPassword, networkError } from '../content';
import { backLinkClasses, FormFeedback, formText, SubmitButton, TextField } from './form-controls';

/** Forgot Password view of Stitch "Sign In (V1)". */
export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = formText(new FormData(event.currentTarget), 'email').trim();
    if (!email) {
      setError(forgotPassword.missingEmail);
      return;
    }

    setPending(true);
    setError(undefined);
    const result = await call(() => api.POST('/api/v1/auth/forgot-password', { body: { email } }));
    setPending(false);
    if (result.error) {
      setError(result.error.status === 0 ? networkError : result.error.message);
      return;
    }
    setSent(true);
  }

  return (
    <>
      {error && <FormFeedback tone="error">{error}</FormFeedback>}
      {sent && <FormFeedback tone="success">{forgotPassword.sent}</FormFeedback>}

      <form className="space-y-5" onSubmit={(event) => void onSubmit(event)} noValidate>
        <TextField
          label={forgotPassword.emailLabel}
          name="email"
          type="email"
          autoComplete="email"
          placeholder={forgotPassword.emailPlaceholder}
          icon="mail"
          required
        />
        <div className="space-y-3 pt-2">
          <SubmitButton pending={pending} pendingLabel={forgotPassword.submitting} arrow={false}>
            {forgotPassword.submit}
          </SubmitButton>
          <Link href="/login" className={backLinkClasses}>
            <Icon name="arrow_back" className="size-4" />
            <span>{forgotPassword.back}</span>
          </Link>
        </div>
      </form>
    </>
  );
}
