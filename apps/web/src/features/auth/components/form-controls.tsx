'use client';

import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/icon';

const inputClasses =
  'w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 text-body-md text-on-surface transition-all duration-200 placeholder:text-outline focus:border-secondary focus:ring-2 focus:ring-secondary/20 focus:outline-none aria-[invalid=true]:border-error';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string;
  icon?: IconName;
  hint?: string;
  error?: string;
}

/** Labelled input in the design system (Stitch auth screens). */
export function TextField({ label, icon, hint, error, type = 'text', ...input }: TextFieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-label-sm tracking-wider text-on-surface-variant uppercase"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && revealed ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${inputClasses} ${isPassword || icon ? 'pr-11' : ''}`}
          {...input}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="absolute top-3 right-3 rounded p-0.5 text-outline transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-secondary"
          >
            <Icon name={revealed ? 'visibility_off' : 'visibility'} className="size-6" />
          </button>
        ) : (
          icon && (
            <span className="pointer-events-none absolute top-3.5 right-3.5 text-outline-variant">
              <Icon name={icon} className="size-5" />
            </span>
          )
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-label-sm text-error">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1 text-label-sm text-on-surface-variant">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** Full-width midnight-navy submit button with the loading spinner from the design. */
export function SubmitButton({
  children,
  pendingLabel,
  pending,
  arrow = true,
}: {
  children: ReactNode;
  pendingLabel: string;
  pending: boolean;
  arrow?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy px-6 py-3.5 text-title-md text-on-primary shadow-sm transition-all duration-200 hover:bg-[#152042] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
    >
      <span>{pending ? pendingLabel : children}</span>
      {pending ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent"
        />
      ) : (
        arrow && <Icon name="arrow_forward" className="size-5 text-secondary-fixed" />
      )}
    </button>
  );
}

/** Success (sage) or error (rose) message above a form, as in the Stitch screens. */
export function FormFeedback({
  tone,
  children,
}: {
  tone: 'success' | 'error';
  children: ReactNode;
}) {
  const success = tone === 'success';
  return (
    <div
      role={success ? 'status' : 'alert'}
      className={`mb-6 flex items-start gap-2.5 rounded-lg border p-4 text-body-sm ${
        success
          ? 'border-tertiary-fixed-dim bg-tertiary-fixed text-on-tertiary-fixed'
          : 'border-error/30 bg-error-container text-on-error-container'
      }`}
    >
      <Icon
        name={success ? 'check_circle' : 'error'}
        className={`size-5 ${success ? 'text-secondary' : 'text-error'}`}
      />
      <div>{children}</div>
    </div>
  );
}

/** Quiet full-width secondary action with a back arrow ("Back to Sign In"). */
export const backLinkClasses =
  'flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-label-md text-on-surface transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-secondary';

/** A text field's value from submitted form data ('' if missing). */
export function formText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}
