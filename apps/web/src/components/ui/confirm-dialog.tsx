'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { DangerButton, PrimaryButton } from './form';
import { Icon, type IconName } from './icon';

/**
 * A confirmation that does nothing until the user confirms (decision 0019 #9). Escape and the
 * backdrop cancel; focus starts on Cancel so a stray Enter never confirms.
 */
export function ConfirmDialog({
  title,
  body,
  icon,
  confirmLabel,
  cancelLabel,
  pendingLabel,
  tone,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: ReactNode;
  icon: IconName;
  confirmLabel: string;
  cancelLabel: string;
  pendingLabel: string;
  tone: 'danger' | 'primary';
  pending: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const cancelButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onCancel();
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onCancel, pending]);

  const Confirm = tone === 'danger' ? DangerButton : PrimaryButton;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-navy/40"
        onClick={() => !pending && onCancel()}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="relative w-full max-w-[440px] rounded-xl border border-hairline bg-white p-6 shadow-2xl"
      >
        <span
          className={`mb-4 flex size-11 items-center justify-center rounded-full ${
            tone === 'danger' ? 'bg-error-container text-error' : 'bg-[#faf1e4] text-secondary'
          }`}
        >
          <Icon name={icon} className="size-6" />
        </span>
        <h2 id={titleId} className="mb-2 font-serif text-headline-sm text-navy">
          {title}
        </h2>
        <div id={bodyId} className="text-body-md text-on-surface-variant">
          {body}
        </div>
        {error && (
          <p role="alert" className="mt-4 flex items-center gap-1.5 text-body-sm text-error">
            <Icon name="error" className="size-4" />
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelButton}
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-outline-variant/70 bg-white px-5 text-label-md text-navy transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-secondary disabled:cursor-not-allowed disabled:text-outline"
          >
            {cancelLabel}
          </button>
          <Confirm onClick={onConfirm} pending={pending} pendingLabel={pendingLabel}>
            {confirmLabel}
          </Confirm>
        </div>
      </div>
    </div>
  );
}
