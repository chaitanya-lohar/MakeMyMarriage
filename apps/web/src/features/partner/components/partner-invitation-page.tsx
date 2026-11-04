'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Banner, PrimaryButton, SecondaryButton } from '@/components/ui/form';
import { MEMBERS_PATH } from '@/features/workspace/components/shell-parts';
import { rememberWedding } from '@/features/workspace/workspace-context';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import { api, call, type ApiUser } from '@/lib/api';
import { partnerInvitationPageCopy as copy } from '../content';
import {
  displayHint,
  rememberPartnerWelcome,
  shortDate,
  type ApiPartnerInvitationDetails,
} from '../partner-model';

type Outcome = 'declined' | 'expired' | 'cancelled' | 'answered' | 'invalid' | 'two-owners';

const linkButton = 'inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-label-md';
const primaryLink = `${linkButton} bg-navy text-on-primary`;
const secondaryLink = `${linkButton} border border-champagne bg-white text-navy`;

/** "aa***@example.com", as the API masks an address. */
function apiHint(email: string): string {
  const [local = '', domain = ''] = email.toLowerCase().split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

function outcomeOf(status: ApiPartnerInvitationDetails['status']): Outcome | null {
  if (status === 'PENDING') return null;
  if (status === 'EXPIRED') return 'expired';
  if (status === 'REVOKED') return 'cancelled';
  return 'answered';
}

/**
 * The partner invitation page (Stitch "P16 · M16-03", API Design §7.2), outside the
 * workspace. Signed out: sign in or create an account and come back. Signed in with the
 * invited email: accept (D4) — unless the account owns a wedding, which it must hand over
 * first (D6). Anyone with the link may decline.
 */
export function PartnerInvitationPage({ token }: { token: string }) {
  const router = useRouter();
  const [details, setDetails] = useState<ApiPartnerInvitationDetails | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [weddings, setWeddings] = useState<ApiWedding[]>([]);
  const [loading, setLoading] = useState(true);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [ownsWedding, setOwnsWedding] = useState(false);
  const [pending, setPending] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string>();
  const here = `/partner-invite/${token}`;

  useEffect(() => {
    let active = true;
    void Promise.all([
      call(() => api.GET('/api/v1/partner-invitations/{token}', { params: { path: { token } } })),
      call(() => api.GET('/api/v1/me')),
    ]).then(async ([invitation, me]) => {
      if (!active) return;
      if (!invitation.data) {
        setLoading(false);
        setOutcome('invalid');
        return;
      }
      setDetails(invitation.data);
      setOutcome(outcomeOf(invitation.data.status));
      if (me.data) {
        setUser(me.data.user);
        setMismatch(apiHint(me.data.user.email) !== invitation.data.emailHint);
        const mine = await call(() => api.GET('/api/v1/weddings'));
        if (!active) return;
        const list = mine.data ?? [];
        setWeddings(list);
        setOwnsWedding(list.some((wedding) => wedding.membership?.isOwner));
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [token]);

  async function accept() {
    setPending('accept');
    setError(undefined);
    const result = await call(() =>
      api.POST('/api/v1/partner-invitations/{token}/accept', { params: { path: { token } } }),
    );
    if (result.data && user && details) {
      rememberWedding(user.id, result.data.weddingId);
      rememberPartnerWelcome({
        weddingName: details.weddingDisplayName,
        inviterName: details.invitedByName,
      });
      router.push('/partner-welcome');
      return;
    }
    setPending(null);
    const failure = result.error;
    if (!failure) return;
    const code = failure.code;
    if (code === 'PARTNER_INVITATION_EMAIL_MISMATCH') setMismatch(true);
    else if (code === 'PARTNER_INVITEE_OWNS_WEDDING') setOwnsWedding(true);
    else if (code === 'PARTNER_INVITATION_EXPIRED') setOutcome('expired');
    else if (code === 'PARTNER_SEAT_UNAVAILABLE' || code === 'PARTNER_ALREADY_CONNECTED') {
      setOutcome('two-owners');
    } else if (code === 'PARTNER_INVITATION_NOT_PENDING') {
      const status = (failure.details as { status?: string } | undefined)?.status;
      setOutcome(status === 'REVOKED' ? 'cancelled' : 'answered');
    } else if (code === 'PARTNER_INVITATION_NOT_FOUND') setOutcome('invalid');
    else if (failure.status === 401) router.push(`/login?next=${encodeURIComponent(here)}`);
    else setError(copy.failed);
  }

  async function decline() {
    setPending('decline');
    setError(undefined);
    const result = await call(() =>
      api.POST('/api/v1/partner-invitations/{token}/decline', { params: { path: { token } } }),
    );
    setPending(null);
    if (!result.error) setOutcome('declined');
    else if (result.error.code === 'PARTNER_INVITATION_EXPIRED') setOutcome('expired');
    else if (result.error.status === 409) setOutcome('answered');
    else if (result.error.status === 404) setOutcome('invalid');
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

  if (outcome) {
    const message = {
      declined: copy.declined,
      expired: copy.expired(details?.invitedByName ?? ''),
      cancelled: copy.cancelled,
      answered: copy.answered,
      invalid: copy.invalid,
      'two-owners': copy.twoOwners,
    }[outcome];
    return (
      <section className="space-y-6">
        <h1 className="font-serif text-headline-md text-navy">{message}</h1>
        <Link href="/" className={primaryLink}>
          {copy.goHome}
        </Link>
      </section>
    );
  }
  if (!details) return null;

  const hint = displayHint(details.emailHint);
  const meta = (
    <p className="text-body-sm text-on-surface-variant">
      {copy.invitationFor(hint, shortDate(details.expiresAt))}
    </p>
  );
  const busy = pending !== null;

  if (user && mismatch) {
    return (
      <section className="space-y-6">
        <h1 className="font-serif text-headline-md text-navy">{copy.otherAccountTitle}</h1>
        <Banner tone="info" icon="info">
          {copy.otherAccount(user.email, hint)}
        </Banner>
        <PrimaryButton onClick={() => void switchAccount()}>{copy.switchAccount}</PrimaryButton>
      </section>
    );
  }

  if (user && ownsWedding) {
    return (
      <section className="space-y-6">
        <h1 className="font-serif text-headline-md text-navy">{copy.ownsTitle}</h1>
        <p className="text-body-md text-on-surface-variant">{copy.ownsBody}</p>
        {error && (
          <Banner tone="error" icon="error">
            {error}
          </Banner>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={MEMBERS_PATH}
            onClick={() => {
              const owned = weddings.find((wedding) => wedding.membership?.isOwner);
              if (owned) rememberWedding(user.id, owned.id);
            }}
            className={primaryLink}
          >
            {copy.goToMyWedding}
          </Link>
          <SecondaryButton
            pending={pending === 'decline'}
            pendingLabel={copy.declining}
            disabled={busy}
            onClick={() => void decline()}
          >
            {copy.decline}
          </SecondaryButton>
        </div>
      </section>
    );
  }

  // An organizer of this wedding (D5). The page knows the wedding only by its name.
  const organizerHere = weddings.some(
    (wedding) =>
      wedding.displayName === details.weddingDisplayName && wedding.membership?.isOwner === false,
  );

  return (
    <section className="space-y-6">
      {user && (
        <p className="text-body-sm text-on-surface-variant">{copy.signedInAs(user.email)}</p>
      )}
      <div>
        <h1 className="font-serif text-headline-md text-navy">
          {copy.invitedTo(details.invitedByName, details.weddingDisplayName)}
        </h1>
        <p className="mt-2 text-body-md text-on-surface-variant">{copy.body}</p>
      </div>
      {user && organizerHere && (
        <Banner tone="info" icon="info">
          {copy.organizerNote}
        </Banner>
      )}
      {meta}
      {error && (
        <Banner tone="error" icon="error">
          {error}
        </Banner>
      )}
      {!user ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={`/login?next=${encodeURIComponent(here)}`} className={primaryLink}>
              {copy.signIn}
            </Link>
            <Link href={`/signup?next=${encodeURIComponent(here)}`} className={secondaryLink}>
              {copy.createAccount}
            </Link>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void decline()}
            className="min-h-11 text-label-md text-on-surface-variant underline hover:text-navy"
          >
            {pending === 'decline' ? copy.declining : copy.declineInvitation}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <PrimaryButton
            pending={pending === 'accept'}
            pendingLabel={copy.accepting}
            disabled={busy}
            onClick={() => void accept()}
          >
            {copy.accept}
          </PrimaryButton>
          <SecondaryButton
            pending={pending === 'decline'}
            pendingLabel={copy.declining}
            disabled={busy}
            onClick={() => void decline()}
          >
            {copy.decline}
          </SecondaryButton>
        </div>
      )}
    </section>
  );
}
