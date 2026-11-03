'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Chip } from '@/components/ui/chip';
import {
  Banner,
  DangerButton,
  Field,
  PrimaryButton,
  QuietButton,
  SecondaryButton,
  controlClasses,
  describedBy,
} from '@/components/ui/form';
import { useModal } from '@/components/ui/use-modal';
import { initialsOf } from '@/features/workspace/components/shell-parts';
import { api, call } from '@/lib/api';
import { leaveCopy, partnerCardCopy as copy, partnerInviteCopy } from '../content';
import { maskEmail, shortDate, type ApiPartnerState } from '../partner-model';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The Partner card on the Members page (Stitch "P16 · M16-01", "M16-07" to "M16-09"; decision
 * 0039). Owners only — the API refuses everyone else. Shows the invitation (pending, email not
 * sent, expired) or the connected partner, and the viewer's own "Your access" section.
 */
export function PartnerCard({
  weddingId,
  weddingName,
  onToast,
  onLeft,
  onChanged,
}: {
  weddingId: string;
  weddingName: string;
  onToast: (message: string) => void;
  /** After leaving: the caller no longer has access to this wedding. */
  onLeft: (otherName: string) => void;
  /** The owners changed or an invitation was sent; the page reloads its members. */
  onChanged: () => void;
}) {
  const [state, setState] = useState<ApiPartnerState | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [inviting, setInviting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [pending, setPending] = useState<'resend' | 'cancel' | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void call(() =>
      api.GET('/api/v1/weddings/{weddingId}/partner', { params: { path: { weddingId } } }),
    ).then((result) => {
      if (!active) return;
      if (!result.data) {
        setFailed(true);
        return;
      }
      setFailed(false);
      setState(result.data);
    });
    return () => {
      active = false;
    };
  }, [weddingId, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  async function act(kind: 'resend' | 'cancel', invitationId: string) {
    setPending(kind);
    setError(undefined);
    const path = { weddingId, invitationId };
    const result =
      kind === 'resend'
        ? await call(() =>
            api.POST('/api/v1/weddings/{weddingId}/partner/invitations/{invitationId}/resend', {
              params: { path },
            }),
          )
        : await call(() =>
            api.POST('/api/v1/weddings/{weddingId}/partner/invitations/{invitationId}/revoke', {
              params: { path },
            }),
          );
    setPending(null);
    if (result.error) {
      const code = result.error.code;
      if (code === 'RATE_LIMITED') setError(copy.resendLimit);
      else if (code === 'PARTNER_INVITATION_EXPIRED' || code === 'PARTNER_INVITATION_NOT_PENDING') {
        reload();
      } else setError(copy.failed);
      return;
    }
    const resent = result.data as { emailSent?: boolean } | undefined;
    if (kind === 'resend' && resent?.emailSent === false) setError(copy.notSent);
    else onToast(kind === 'resend' ? copy.resent : copy.cancelled);
    reload();
  }

  const shell = (children: React.ReactNode) => (
    <section
      aria-labelledby="partner-card-title"
      className="mb-6 rounded-xl border border-hairline bg-white p-5 shadow-sm"
    >
      <h2 id="partner-card-title" className="text-title-md text-navy">
        {copy.title}
      </h2>
      {children}
    </section>
  );

  if (failed) {
    return shell(
      <div className="mt-3 space-y-3">
        <Banner tone="error" icon="error">
          {copy.loadError}
        </Banner>
        <SecondaryButton icon="refresh" onClick={reload}>
          {copy.tryAgain}
        </SecondaryButton>
      </div>,
    );
  }
  if (!state) {
    return shell(<div className="mt-3 h-12 animate-pulse rounded-lg bg-surface-container-low" />);
  }

  const { partner, invitation } = state;
  let body: React.ReactNode;
  if (partner) {
    body = (
      <>
        <div className="mt-3 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-champagne/30 bg-[#faf5ee] text-label-md text-[#7a5e2e]"
          >
            {initialsOf(partner.displayName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-medium text-navy">
              {partner.displayName}
              <Chip tone="champagne">{copy.owner}</Chip>
            </p>
            <p className="truncate text-body-sm text-on-surface-variant">
              {partner.email}
              {partner.connectedAt && ` · ${copy.connectedSince(shortDate(partner.connectedAt))}`}
            </p>
          </div>
        </div>
        <div className="mt-5 border-t border-hairline pt-4">
          <h3 className="text-label-md text-navy">{copy.yourAccess}</h3>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            {copy.leaveHelp(partner.displayName)}
          </p>
          <QuietButton tone="danger" className="mt-2 -ml-3" onClick={() => setLeaving(true)}>
            {copy.leave}
          </QuietButton>
        </div>
      </>
    );
  } else if (invitation?.status === 'PENDING') {
    body = (
      <div className="mt-3 space-y-3">
        <div>
          <p className="flex flex-wrap items-center gap-2 font-medium text-navy">
            {copy.sentTo(maskEmail(invitation.inviteeEmail))}
            <Chip tone="champagne">{copy.pending}</Chip>
          </p>
          <p className="text-body-sm text-on-surface-variant">
            {copy.sentExpires(shortDate(invitation.lastSentAt), shortDate(invitation.expiresAt))}
          </p>
        </div>
        {!invitation.emailSent && !error && (
          <Banner tone="info" icon="warning">
            {copy.notSent}
          </Banner>
        )}
        {error && (
          <Banner tone="error" icon="error">
            {error}
          </Banner>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <SecondaryButton
            icon="forward_to_inbox"
            pending={pending === 'resend'}
            pendingLabel={copy.resending}
            disabled={pending !== null}
            onClick={() => void act('resend', invitation.id)}
          >
            {copy.resend}
          </SecondaryButton>
          <QuietButton
            tone="danger"
            disabled={pending !== null}
            onClick={() => void act('cancel', invitation.id)}
          >
            {pending === 'cancel' ? copy.cancelling : copy.cancelInvitation}
          </QuietButton>
          <span className="text-body-sm text-on-surface-variant">
            {copy.resendsLeft(invitation.resendsLeft)}
          </span>
        </div>
      </div>
    );
  } else if (invitation?.status === 'EXPIRED') {
    body = (
      <div className="mt-3 space-y-3">
        <p className="font-medium text-navy">{copy.sentTo(maskEmail(invitation.inviteeEmail))}</p>
        <Banner tone="info" icon="schedule">
          {copy.expired}
        </Banner>
        <PrimaryButton icon="send" onClick={() => setInviting(true)}>
          {copy.sendNew}
        </PrimaryButton>
      </div>
    );
  } else {
    body = (
      <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body-sm text-on-surface-variant sm:max-w-[520px]">{copy.inviteBody}</p>
        <PrimaryButton icon="favorite" onClick={() => setInviting(true)}>
          {copy.invite}
        </PrimaryButton>
      </div>
    );
  }

  return (
    <>
      {shell(body)}
      {inviting && (
        <PartnerInviteDialog
          weddingId={weddingId}
          onClose={() => setInviting(false)}
          onSent={(email, emailSent) => {
            setInviting(false);
            if (emailSent) onToast(copy.sent(maskEmail(email)));
            reload();
            onChanged();
          }}
          onStale={() => {
            setInviting(false);
            reload();
          }}
        />
      )}
      {leaving && partner && (
        <LeaveDialog
          weddingId={weddingId}
          weddingName={weddingName}
          otherName={partner.displayName}
          onClose={() => setLeaving(false)}
          onLeft={() => onLeft(partner.displayName)}
          onStale={() => {
            setLeaving(false);
            reload();
            onChanged();
          }}
        />
      )}
    </>
  );
}

function DialogFrame({
  titleId,
  pending,
  onClose,
  children,
}: {
  titleId: string;
  pending: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useModal(panel, { onClose, canClose: !pending });
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
        className="relative max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-t-2xl border border-hairline bg-white p-6 shadow-2xl sm:rounded-xl"
      >
        {children}
      </div>
    </div>
  );
}

/** Invite your partner (Stitch "P16 · M16-02"): one email field. */
function PartnerInviteDialog({
  weddingId,
  onClose,
  onSent,
  onStale,
}: {
  weddingId: string;
  onClose: () => void;
  onSent: (email: string, emailSent: boolean) => void;
  onStale: () => void;
}) {
  const text = partnerInviteCopy;
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const titleId = useId();

  async function submit() {
    setError(undefined);
    if (!EMAIL.test(email.trim())) {
      setEmailError(text.invalidEmail);
      return;
    }
    setEmailError(undefined);
    setPending(true);
    const result = await call(() =>
      api.POST('/api/v1/weddings/{weddingId}/partner/invitations', {
        params: { path: { weddingId } },
        body: { email: email.trim() },
      }),
    );
    setPending(false);
    if (result.data) {
      onSent(result.data.inviteeEmail, result.data.emailSent);
      return;
    }
    const { code, fields } = result.error;
    if (code === 'RATE_LIMITED') setError(text.rateLimited);
    else if (code === 'PARTNER_ALREADY_CONNECTED') setError(text.twoOwners);
    else if (code === 'PARTNER_INVITATION_ALREADY_PENDING') onStale();
    else if (fields?.email) {
      setEmailError(
        fields.email.some((m) => /own email/.test(m)) ? text.ownEmail : text.invalidEmail,
      );
    } else setError(text.failed);
  }

  return (
    <DialogFrame titleId={titleId} pending={pending} onClose={onClose}>
      <h2 id={titleId} className="font-serif text-headline-sm text-navy">
        {text.title}
      </h2>
      <p className="mt-2 text-body-sm text-on-surface-variant">{text.body}</p>
      <div className="mt-5 space-y-4">
        <Field id="partner-email" label={text.email} error={emailError}>
          <input
            id="partner-email"
            type="email"
            required
            autoComplete="off"
            aria-invalid={emailError ? true : undefined}
            aria-describedby={describedBy('partner-email', emailError)}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submit();
            }}
            className={controlClasses}
          />
        </Field>
        <p className="text-body-sm text-on-surface-variant">{text.note}</p>
        {error && (
          <Banner tone="error" icon="error">
            {error}
          </Banner>
        )}
      </div>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <SecondaryButton onClick={onClose} disabled={pending}>
          {text.cancel}
        </SecondaryButton>
        <PrimaryButton
          icon="send"
          pending={pending}
          pendingLabel={text.sending}
          onClick={() => void submit()}
        >
          {text.send}
        </PrimaryButton>
      </div>
    </DialogFrame>
  );
}

/** Leave confirmation (Stitch "P16 · M16-05"): enabled only once the box is ticked. */
function LeaveDialog({
  weddingId,
  weddingName,
  otherName,
  onClose,
  onLeft,
  onStale,
}: {
  weddingId: string;
  weddingName: string;
  otherName: string;
  onClose: () => void;
  onLeft: () => void;
  onStale: () => void;
}) {
  const [understood, setUnderstood] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const titleId = useId();

  async function leave() {
    setPending(true);
    setError(undefined);
    const result = await call(() =>
      api.POST('/api/v1/weddings/{weddingId}/partner/leave', { params: { path: { weddingId } } }),
    );
    if (!result.error) {
      onLeft();
      return;
    }
    setPending(false);
    if (result.error.code === 'PARTNER_NOT_CONNECTED') onStale();
    else setError(leaveCopy.failed);
  }

  return (
    <DialogFrame titleId={titleId} pending={pending} onClose={onClose}>
      <h2 id={titleId} className="font-serif text-headline-sm text-navy">
        {leaveCopy.title(weddingName)}
      </h2>
      <p className="mt-2 text-body-md text-on-surface-variant">{leaveCopy.body(otherName)}</p>
      <label className="mt-5 flex min-h-11 items-center gap-3 text-body-md text-navy">
        <input
          type="checkbox"
          checked={understood}
          onChange={(event) => setUnderstood(event.target.checked)}
          className="size-5"
        />
        {leaveCopy.understand}
      </label>
      {error && (
        <div className="mt-4">
          <Banner tone="error" icon="error">
            {error}
          </Banner>
        </div>
      )}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <SecondaryButton onClick={onClose} disabled={pending}>
          {leaveCopy.cancel}
        </SecondaryButton>
        <DangerButton
          icon="logout"
          disabled={!understood}
          pending={pending}
          pendingLabel={leaveCopy.leaving}
          onClick={() => void leave()}
        >
          {leaveCopy.leave}
        </DangerButton>
      </div>
    </DialogFrame>
  );
}
