'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Icon } from '@/components/ui/icon';
import { api, call } from '@/lib/api';
import { networkError, resetLinkExpired, resetPassword } from '../content';
import { AuthHeading } from './auth-shell';
import { backLinkClasses, FormFeedback, formText, SubmitButton, TextField } from './form-controls';

const MIN_PASSWORD_LENGTH = 8;

type FieldErrors = Partial<Record<'password' | 'confirmPassword', string>>;

/** Stitch "Reset Link Expired". */
function ResetLinkExpired() {
  return (
    <>
      <AuthHeading title={resetLinkExpired.title} subtitle={resetLinkExpired.subtitle} />
      <FormFeedback tone="error">{resetLinkExpired.banner}</FormFeedback>
      <div className="space-y-3">
        <Link
          href="/forgot-password"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy px-6 py-3.5 text-title-md text-on-primary shadow-sm transition-all duration-200 hover:bg-[#152042] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          <span>{resetLinkExpired.requestNew}</span>
          <Icon name="arrow_forward" className="size-5 text-secondary-fixed" />
        </Link>
        <Link href="/login" className={backLinkClasses}>
          <Icon name="arrow_back" className="size-4" />
          <span>{resetLinkExpired.back}</span>
        </Link>
      </div>
    </>
  );
}

/**
 * Stitch "Reset Password". On success the user goes straight to Sign In, which shows the
 * "password updated" banner (decision 0015). An unusable link shows "Reset Link Expired".
 */
export function ResetPasswordForm({ token }: { token: string | undefined }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [linkInvalid, setLinkInvalid] = useState(!token);

  if (linkInvalid || !token) return <ResetLinkExpired />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = formText(form, 'password');
    const confirmPassword = formText(form, 'confirmPassword');

    const nextFieldErrors: FieldErrors = {};
    if (password.length < MIN_PASSWORD_LENGTH) {
      nextFieldErrors.password = resetPassword.passwordTooShort;
    }
    if (password !== confirmPassword)
      nextFieldErrors.confirmPassword = resetPassword.passwordsDiffer;
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;

    setPending(true);
    setError(undefined);
    const result = await call(() =>
      api.POST('/api/v1/auth/reset-password', { body: { token: token as string, password } }),
    );
    if (result.error) {
      setPending(false);
      if (result.error.code === 'RESET_TOKEN_INVALID') {
        setLinkInvalid(true);
        return;
      }
      setError(result.error.status === 0 ? networkError : result.error.message);
      return;
    }
    router.replace('/login?reset=success');
  }

  return (
    <>
      <AuthHeading title={resetPassword.title} subtitle={resetPassword.subtitle} />
      {error && <FormFeedback tone="error">{error}</FormFeedback>}
      <form className="space-y-5" onSubmit={(event) => void onSubmit(event)} noValidate>
        <TextField
          label={resetPassword.passwordLabel}
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder={resetPassword.passwordPlaceholder}
          hint={resetPassword.passwordHint}
          error={fieldErrors.password}
          maxLength={128}
          required
        />
        <TextField
          label={resetPassword.confirmLabel}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder={resetPassword.confirmPlaceholder}
          error={fieldErrors.confirmPassword}
          maxLength={128}
          required
        />
        <div className="space-y-3 pt-2">
          <SubmitButton pending={pending} pendingLabel={resetPassword.submitting}>
            {resetPassword.submit}
          </SubmitButton>
          <Link href="/login" className={backLinkClasses}>
            <Icon name="arrow_back" className="size-4" />
            <span>{resetPassword.back}</span>
          </Link>
        </div>
      </form>
    </>
  );
}
