'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './icon';

/** Input, select and textarea styling from the approved forms (Stitch P3 S3/S5, P4 O3/O6). */
export const controlClasses =
  'w-full rounded-lg border border-outline-variant/70 bg-white text-body-md text-navy transition-colors placeholder:text-outline focus:border-secondary focus:ring-2 focus:ring-secondary/20 focus:outline-none disabled:bg-surface-container-low disabled:text-on-surface-variant aria-[invalid=true]:border-error aria-[invalid=true]:bg-error-container/20';

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-body-sm text-error">
      <Icon name="error" className="size-4" />
      {message}
    </p>
  );
}

/** A labelled control with an optional hint (below) and counter or limit (top right). */
export function Field({
  id,
  label,
  error,
  hint,
  aside,
  children,
}: {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label
          htmlFor={id}
          className={`block text-body-sm font-medium ${error ? 'text-error' : 'text-navy'}`}
        >
          {label}
        </label>
        {aside && <span className="text-body-sm text-on-surface-variant">{aside}</span>}
      </div>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-body-sm text-on-surface-variant">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/** `aria-describedby` for a control rendered inside Field. */
export function describedBy(id: string, error?: string, hint?: string): string | undefined {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

/** A message above a form or list: rose for errors, sage for success, neutral for notices. */
export function Banner({
  tone,
  icon,
  children,
}: {
  tone: 'error' | 'success' | 'info';
  icon: IconName;
  children: ReactNode;
}) {
  const classes = {
    error: 'border-error/30 bg-error-container/60 text-on-error-container',
    success: 'border-tertiary-fixed-dim bg-[#eef4f0] text-[#2d5a3f]',
    info: 'border-hairline bg-surface-container-low text-on-surface',
  }[tone];
  const iconClass = { error: 'text-error', success: 'text-[#2d5a3f]', info: 'text-secondary' }[
    tone
  ];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-lg border p-4 text-body-sm ${classes}`}
    >
      <Icon name={icon} className={`size-5 ${iconClass}`} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean;
  pendingLabel?: string;
  icon?: IconName;
};

const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-label-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:cursor-not-allowed';

function Content({ pending, pendingLabel, icon, children }: ButtonProps) {
  return (
    <>
      {pending ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        icon && <Icon name={icon} className="size-5" />
      )}
      {pending && pendingLabel ? pendingLabel : children}
    </>
  );
}

/** Midnight navy — never Stitch's black primary (decision 0015). */
export function PrimaryButton({
  pending,
  pendingLabel,
  icon,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || pending}
      className={`${base} bg-navy text-on-primary shadow-sm hover:bg-[#1e293b] disabled:opacity-80 ${className}`}
    >
      <Content pending={pending} pendingLabel={pendingLabel} icon={icon}>
        {props.children}
      </Content>
    </button>
  );
}

/** White with a champagne border. */
export function SecondaryButton({
  pending,
  pendingLabel,
  icon,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || pending}
      className={`${base} border border-champagne bg-white text-navy hover:bg-ivory disabled:text-outline ${className}`}
    >
      <Content pending={pending} pendingLabel={pendingLabel} icon={icon}>
        {props.children}
      </Content>
    </button>
  );
}

/** Destructive red, for confirmed deletions and revocation. */
export function DangerButton({
  pending,
  pendingLabel,
  icon,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || pending}
      className={`${base} bg-error text-white shadow-sm hover:bg-[#93000a] disabled:opacity-80 ${className}`}
    >
      <Content pending={pending} pendingLabel={pendingLabel} icon={icon}>
        {props.children}
      </Content>
    </button>
  );
}

/** A quiet text-style action, e.g. "Remove from event". */
export function QuietButton({ icon, className = '', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-navy focus-visible:outline-2 focus-visible:outline-secondary disabled:cursor-not-allowed disabled:text-outline ${className}`}
    >
      {icon && <Icon name={icon} className="size-5" />}
      {props.children}
    </button>
  );
}
