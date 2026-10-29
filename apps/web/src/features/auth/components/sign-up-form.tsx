'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Icon } from '@/components/ui/icon';
import { api, call } from '@/lib/api';
import { invalidEmail, networkError, signUp } from '../content';
import { isInvalidEmailError, isValidEmail } from '../validation';
import { FormFeedback, formText, SubmitButton, TextField } from './form-controls';

const MIN_PASSWORD_LENGTH = 8;

type FieldErrors = Partial<Record<'email' | 'password' | 'confirmPassword', string>>;

/** Stitch "Sign Up". */
export function SignUpForm({ next = '/dashboard' }: { next?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const displayName = formText(form, 'displayName').trim();
    const email = formText(form, 'email').trim();
    const password = formText(form, 'password');
    const confirmPassword = formText(form, 'confirmPassword');

    if (!displayName || !email || !password || !confirmPassword) {
      setFieldErrors({});
      setError(signUp.missingFields);
      return;
    }
    const nextFieldErrors: FieldErrors = {};
    if (!isValidEmail(email)) nextFieldErrors.email = invalidEmail;
    if (password.length < MIN_PASSWORD_LENGTH) nextFieldErrors.password = signUp.passwordTooShort;
    if (password !== confirmPassword) nextFieldErrors.confirmPassword = signUp.passwordsDiffer;
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      setError(undefined);
      return;
    }

    setPending(true);
    setError(undefined);
    const result = await call(() =>
      api.POST('/api/v1/auth/register', { body: { displayName, email, password } }),
    );
    if (result.error) {
      setPending(false);
      if (isInvalidEmailError(result.error)) {
        setFieldErrors({ email: invalidEmail });
        return;
      }
      setError(result.error.status === 0 ? networkError : result.error.message);
      return;
    }
    router.replace(next);
  }

  return (
    <>
      {error && <FormFeedback tone="error">{error}</FormFeedback>}

      <form className="space-y-5" onSubmit={(event) => void onSubmit(event)} noValidate>
        <TextField
          label={signUp.nameLabel}
          name="displayName"
          autoComplete="name"
          placeholder={signUp.namePlaceholder}
          icon="person"
          maxLength={100}
          required
        />
        <TextField
          label={signUp.emailLabel}
          name="email"
          type="email"
          autoComplete="email"
          placeholder={signUp.emailPlaceholder}
          icon="mail"
          error={fieldErrors.email}
          required
        />
        <TextField
          label={signUp.passwordLabel}
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder={signUp.passwordPlaceholder}
          hint={signUp.passwordHint}
          error={fieldErrors.password}
          maxLength={128}
          required
        />
        <TextField
          label={signUp.confirmLabel}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder={signUp.confirmPlaceholder}
          error={fieldErrors.confirmPassword}
          maxLength={128}
          required
        />
        <div className="pt-2">
          <SubmitButton pending={pending} pendingLabel={signUp.submitting}>
            {signUp.submit}
          </SubmitButton>
        </div>
      </form>

      <div className="mt-8 border-t border-outline-variant/30 pt-6 text-center">
        <p className="text-body-md text-on-surface-variant">
          {signUp.haveAccount}
          <Link
            href="/login"
            className="group ml-1 inline-flex items-center gap-1 text-title-md text-primary transition-colors duration-150 hover:text-secondary"
          >
            <span>{signUp.signInLink}</span>
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
