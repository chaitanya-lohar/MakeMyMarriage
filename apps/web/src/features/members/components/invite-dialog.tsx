'use client';

import { useId, useRef, useState } from 'react';
import {
  Banner,
  Field,
  PrimaryButton,
  SecondaryButton,
  controlClasses,
  describedBy,
} from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { useModal } from '@/components/ui/use-modal';
import { roleLabels } from '@/features/workspace/content';
import { usePermissions } from '@/features/workspace/workspace-context';
import { api, call } from '@/lib/api';
import { inviteCopy as copy, roleDescriptions } from '../content';
import { ASSIGNABLE_ROLES, overridesFrom, type AssignableRole } from '../member-model';
import { PermissionsTable } from './permissions-table';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invite member (Stitch "P10 · M2", API Design §7.1): email, role, an optional message and
 * optional custom permissions. A non-owner cannot pick Admin or allow what they do not hold
 * (P10-4); the server refuses both anyway.
 */
export function InviteDialog({
  weddingId,
  initialEmail = '',
  reinvite = false,
  onClose,
  onSent,
  onResendInstead,
}: {
  weddingId: string;
  initialEmail?: string;
  reinvite?: boolean;
  onClose: () => void;
  onSent: (message: string) => void;
  onResendInstead: () => void;
}) {
  const { isOwner, can } = usePermissions();
  const [email, setEmail] = useState(initialEmail);
  const [role, setRole] = useState<AssignableRole>('ORGANIZER');
  const [message, setMessage] = useState('');
  const [customize, setCustomize] = useState(false);
  const [choices, setChoices] = useState(new Map<string, 'ALLOW' | 'DENY'>());
  const [emailError, setEmailError] = useState<string>();
  const [error, setError] = useState<{ text: string; resend?: boolean }>();
  const [pending, setPending] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModal(panel, { onClose, canClose: !pending });

  async function submit() {
    setError(undefined);
    if (!EMAIL.test(email.trim())) {
      setEmailError(copy.invalidEmail);
      return;
    }
    setEmailError(undefined);
    setPending(true);
    const result = await call(() =>
      api.POST('/api/v1/weddings/{weddingId}/members/invitations', {
        params: { path: { weddingId } },
        body: {
          email: email.trim(),
          role,
          ...(message.trim() && { message: message.trim() }),
          ...(choices.size > 0 && { permissionOverrides: overridesFrom(choices) }),
        },
      }),
    );
    setPending(false);
    if (result.data) {
      onSent(result.data.emailSent ? copy.sent(result.data.email) : copy.notSent);
      return;
    }
    const code = result.error.code;
    if (code === 'MEMBER_ALREADY_ACTIVE') setEmailError(copy.alreadyMember);
    else if (code === 'MEMBER_INVITATION_ALREADY_PENDING') {
      setError({ text: copy.alreadyPending, resend: true });
    } else if (code === 'RATE_LIMITED') setError({ text: copy.rateLimited });
    else if (result.error.fields?.email) setEmailError(copy.invalidEmail);
    else setError({ text: copy.failed });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-navy/40"
        onClick={() => !pending && onClose()}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[92vh] w-full max-w-[580px] overflow-y-auto rounded-t-2xl border border-hairline bg-white p-6 shadow-2xl sm:rounded-xl"
      >
        <h2 id={titleId} className="mb-5 font-serif text-headline-sm text-navy">
          {copy.title}
        </h2>
        <div className="space-y-5">
          {reinvite && (
            <Banner tone="info" icon="info">
              {copy.reinviteNote}
            </Banner>
          )}
          <Field id="invite-email" label={copy.email} error={emailError}>
            <input
              id="invite-email"
              type="email"
              required
              autoComplete="off"
              aria-invalid={emailError ? true : undefined}
              aria-describedby={describedBy('invite-email', emailError)}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={controlClasses}
            />
          </Field>

          <fieldset>
            <legend className="mb-2 text-label-md text-navy">{copy.role}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {ASSIGNABLE_ROLES.map((option) => {
                const locked = option === 'ADMIN' && !isOwner;
                return (
                  <label
                    key={option}
                    className={`flex min-h-11 cursor-pointer gap-3 rounded-lg border p-3 ${
                      role === option ? 'border-champagne bg-[#faf5ee]' : 'border-hairline'
                    } ${locked ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <input
                      type="radio"
                      name="invite-role"
                      value={option}
                      checked={role === option}
                      disabled={locked}
                      onChange={() => setRole(option)}
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-label-md text-navy">
                        {roleLabels[option]}
                        {locked && <Icon name="lock" className="size-4" />}
                      </span>
                      <span className="block text-body-sm text-on-surface-variant">
                        {locked ? copy.adminOwnerOnly : roleDescriptions[option]}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-body-sm text-on-surface-variant">{copy.expiresNote}</p>
          </fieldset>

          <Field id="invite-message" label={copy.message} aside={copy.messageCount(message.length)}>
            <textarea
              id="invite-message"
              rows={3}
              maxLength={500}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className={controlClasses}
            />
          </Field>

          <div>
            <button
              type="button"
              aria-expanded={customize}
              onClick={() => setCustomize((value) => !value)}
              className="flex min-h-11 items-center gap-2 text-label-md text-navy"
            >
              <Icon
                name="keyboard_arrow_down"
                className={`size-5 transition-transform ${customize ? 'rotate-180' : ''}`}
              />
              {copy.customize}
            </button>
            {customize && (
              <div className="mt-3">
                <PermissionsTable
                  choices={choices}
                  onChange={setChoices}
                  canAllow={(module, action) => isOwner || can(module, action)}
                />
              </div>
            )}
          </div>

          {error && (
            <Banner tone="error" icon="error">
              {error.text}
              {error.resend && (
                <button
                  type="button"
                  onClick={onResendInstead}
                  className="ml-2 font-semibold underline"
                >
                  {copy.resendInstead}
                </button>
              )}
            </Banner>
          )}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <SecondaryButton onClick={onClose} disabled={pending}>
            {copy.cancel}
          </SecondaryButton>
          <PrimaryButton
            icon="send"
            pending={pending}
            pendingLabel={copy.sending}
            onClick={() => void submit()}
          >
            {copy.send}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
