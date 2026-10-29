'use client';

import type { components } from '@makemymarriage/api-client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Banner, PrimaryButton, SecondaryButton } from '@/components/ui/form';
import { roleLabels } from '@/features/workspace/content';
import { rememberWedding } from '@/features/workspace/workspace-context';
import { api, call, type ApiUser } from '@/lib/api';
import { memberInvitationPageCopy as copy } from '../content';
import { shortDate } from '../member-model';

type Details = components['schemas']['MemberInvitationDetailsDto'];
type Outcome = 'joined' | 'declined' | 'expired' | 'invalid' | 'already-member';

/** "me***@gmail.com" for an address, as the API masks it (API Design §7.1). */
function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.toLowerCase().split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

const anArticle = (role: string) => (/^[AEIOU]/.test(role) ? `an ${role}` : `a ${role}`);

/**
 * The invitee's page (Stitch "P10 · M7", API Design §7.1), outside the workspace. Signed
 * out: sign in or create an account and come back. Signed in with the invited email:
 * accept (no verification — P10-1). Anyone with the link may decline (0034 R6).
 */
export function MemberInvitationPage({ token }: { token: string }) {
  const router = useRouter();
  const [details, setDetails] = useState<Details | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [accepted, setAccepted] = useState<{ weddingId: string; role: string } | null>(null);
  const [pending, setPending] = useState<'accept' | 'decline' | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [error, setError] = useState<string>();
  const here = `/member-invite/${token}`;

  useEffect(() => {
    let active = true;
    void Promise.all([
      call(() => api.GET('/api/v1/member-invitations/{token}', { params: { path: { token } } })),
      call(() => api.GET('/api/v1/me')),
    ]).then(([invitation, me]) => {
      if (!active) return;
      setLoading(false);
      if (!invitation.data) {
        setOutcome('invalid');
        return;
      }
      setDetails(invitation.data);
      if (invitation.data.status === 'EXPIRED') setOutcome('expired');
      else if (invitation.data.status !== 'PENDING') setOutcome('invalid');
      if (me.data) {
        setUser(me.data.user);
        setMismatch(maskEmail(me.data.user.email) !== invitation.data.emailHint);
      }
    });
    return () => {
      active = false;
    };
  }, [token]);

  async function accept() {
    setPending('accept');
    setError(undefined);
    const result = await call(() =>
      api.POST('/api/v1/member-invitations/{token}/accept', { params: { path: { token } } }),
    );
    setPending(null);
    if (result.data) {
      setAccepted({ weddingId: result.data.weddingId, role: result.data.role });
      setOutcome('joined');
      return;
    }
    const code = result.error.code;
    if (code === 'MEMBER_INVITATION_EMAIL_MISMATCH') setMismatch(true);
    else if (code === 'MEMBER_INVITATION_EXPIRED') setOutcome('expired');
    else if (code === 'MEMBER_ALREADY_ACTIVE') setOutcome('already-member');
    else if (code === 'MEMBER_INVITATION_NOT_PENDING' || code === 'MEMBER_INVITATION_NOT_FOUND') {
      setOutcome('invalid');
    } else if (result.error.status === 401) router.push(`/login?next=${encodeURIComponent(here)}`);
    else setError(copy.failed);
  }

  async function decline() {
    setPending('decline');
    setError(undefined);
    const result = await call(() =>
      api.POST('/api/v1/member-invitations/{token}/decline', { params: { path: { token } } }),
    );
    setPending(null);
    setConfirmDecline(false);
    if (!result.error) setOutcome('declined');
    else if (result.error.code === 'MEMBER_INVITATION_EXPIRED') setOutcome('expired');
    else if (result.error.status === 409 || result.error.status === 404) setOutcome('invalid');
    else setError(copy.failed);
  }

  async function switchAccount() {
    await call(() => api.POST('/api/v1/auth/logout'));
    router.push(`/login?next=${encodeURIComponent(here)}`);
  }

  if (loading) {
    return (
      <p role="status" className="text-body-md text-on-surface-variant">
        {copy.loading}
      </p>
    );
  }

  const role = details ? (roleLabels[details.role] ?? details.role) : '';
  if (outcome) {
    const result = {
      joined: { title: copy.joined(details?.weddingDisplayName ?? '', anArticle(role)) },
      declined: { title: copy.declinedTitle },
      expired: { title: copy.expiredTitle },
      invalid: { title: copy.invalidTitle },
      'already-member': { title: copy.alreadyMember },
    }[outcome];
    return (
      <section className="space-y-6">
        <h1 className="font-serif text-headline-md text-navy">{result.title}</h1>
        {outcome === 'joined' && accepted && user ? (
          <PrimaryButton
            onClick={() => {
              rememberWedding(user.id, accepted.weddingId);
              router.push('/dashboard');
            }}
          >
            {copy.goToWedding}
          </PrimaryButton>
        ) : outcome === 'already-member' ? (
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center rounded-lg bg-navy px-5 text-label-md text-on-primary"
          >
            {copy.goToDashboard}
          </Link>
        ) : (
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-lg bg-navy px-5 text-label-md text-on-primary"
          >
            {copy.goHome}
          </Link>
        )}
      </section>
    );
  }
  if (!details) return null;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-serif text-headline-md text-navy">
          {copy.invitedTo(details.weddingDisplayName)}
        </h1>
        <p className="mt-2 text-body-md text-on-surface-variant">
          {copy.invitedAs(details.invitedByName, anArticle(role))}
        </p>
      </div>
      {details.message && (
        <blockquote className="rounded-lg border-l-4 border-champagne bg-[#faf5ee] p-4 text-body-md text-navy">
          {details.message}
        </blockquote>
      )}
      <p className="text-body-sm text-on-surface-variant">
        {copy.expires(shortDate(details.expiresAt))}
      </p>

      {error && (
        <Banner tone="error" icon="error">
          {error}
        </Banner>
      )}

      {!user ? (
        <div className="space-y-3">
          <p className="text-body-md text-navy">{copy.signInAs(details.emailHint)}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/login?next=${encodeURIComponent(here)}`}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-navy px-5 text-label-md text-on-primary"
            >
              {copy.signIn}
            </Link>
            <Link
              href={`/signup?next=${encodeURIComponent(here)}`}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-champagne bg-white px-5 text-label-md text-navy"
            >
              {copy.createAccount}
            </Link>
          </div>
        </div>
      ) : mismatch ? (
        <div className="space-y-3">
          <Banner tone="info" icon="info">
            {copy.otherAccount(details.emailHint)}
          </Banner>
          <SecondaryButton onClick={() => void switchAccount()}>
            {copy.switchAccount}
          </SecondaryButton>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-body-sm text-on-surface-variant">
            {copy.signedInAs(details.emailHint)}
          </p>
          <PrimaryButton
            pending={pending === 'accept'}
            pendingLabel={copy.accepting}
            disabled={pending !== null}
            onClick={() => void accept()}
          >
            {copy.accept}
          </PrimaryButton>
        </div>
      )}

      <button
        type="button"
        onClick={() => setConfirmDecline(true)}
        className="min-h-11 text-label-md text-on-surface-variant underline hover:text-navy"
      >
        {copy.decline}
      </button>

      {confirmDecline && (
        <ConfirmDialog
          title={copy.declineTitle}
          body={copy.declineBody}
          icon="cancel"
          tone="danger"
          confirmLabel={copy.declineConfirm}
          cancelLabel={copy.cancel}
          pendingLabel={copy.declining}
          pending={pending === 'decline'}
          onCancel={() => setConfirmDecline(false)}
          onConfirm={() => void decline()}
        />
      )}
    </section>
  );
}
