'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Banner, PrimaryButton, SecondaryButton } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { useModal } from '@/components/ui/use-modal';
import { MEMBERS_PATH } from '@/features/workspace/components/shell-parts';
import { useReadyWorkspace } from '@/features/workspace/workspace-context';
import { api, call } from '@/lib/api';
import { ownershipCopy as copy } from '../content';
import type { ApiMember, ApiTransfer } from '../member-model';

/** The wedding's ownership offers the caller may see (API Design §7.1), reloadable. */
export function useTransfers(weddingId: string) {
  const [transfers, setTransfers] = useState<ApiTransfer[]>([]);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void call(() =>
      api.GET('/api/v1/weddings/{weddingId}/ownership-transfers', {
        params: { path: { weddingId } },
      }),
    ).then((result) => {
      if (active && result.data) setTransfers(result.data);
    });
    return () => {
      active = false;
    };
  }, [weddingId, attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { transfers, reload };
}

/**
 * The owner's side (Stitch "P10 · M6"): offering one's own seat in two steps, and the
 * pending offer with Cancel. Shown only to owners.
 */
export function OwnerTransferPanel({
  weddingId,
  members,
  myMembershipId,
  pending,
  onChanged,
}: {
  weddingId: string;
  members: ApiMember[];
  myMembershipId: string | null;
  pending: ApiTransfer | undefined;
  onChanged: (message?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const otherOwner =
    members.find((member) => member.isOwner && member.membershipId !== myMembershipId)
      ?.displayName ?? null;

  if (pending) {
    return (
      <>
        <div className="rounded-xl border border-champagne bg-[#faf5ee] p-4">
          <p className="font-medium text-navy">{copy.pending(pending.toName)}</p>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            {copy.pendingBody(pending.toName)}
          </p>
          {pending.fromMembershipId === myMembershipId && (
            <SecondaryButton className="mt-3" onClick={() => setCancelling(true)}>
              {copy.cancelOffer}
            </SecondaryButton>
          )}
        </div>
        {cancelling && (
          <ConfirmDialog
            title={copy.cancelTitle}
            body={copy.cancelBody(pending.toName)}
            icon="info"
            tone="primary"
            confirmLabel={copy.cancelOffer}
            cancelLabel={copy.keepOffer}
            pendingLabel={copy.cancelling}
            pending={busy}
            error={error}
            onCancel={() => setCancelling(false)}
            onConfirm={() => {
              setBusy(true);
              void call(() =>
                api.POST('/api/v1/weddings/{weddingId}/ownership-transfers/{transferId}/cancel', {
                  params: { path: { weddingId, transferId: pending.id } },
                }),
              ).then((result) => {
                setBusy(false);
                if (result.error && result.error.status !== 409) setError(copy.failed);
                else {
                  setCancelling(false);
                  onChanged();
                }
              });
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <SecondaryButton icon="handshake" onClick={() => setOpen(true)}>
        {copy.transfer}
      </SecondaryButton>
      {open && (
        <TransferDialog
          weddingId={weddingId}
          candidates={members.filter((member) => !member.isOwner)}
          otherOwner={otherOwner}
          onClose={() => setOpen(false)}
          onSent={() => {
            setOpen(false);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function TransferDialog({
  weddingId,
  candidates,
  otherOwner,
  onClose,
  onSent,
}: {
  weddingId: string;
  candidates: ApiMember[];
  otherOwner: string | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [chosen, setChosen] = useState<ApiMember>();
  const [understood, setUnderstood] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModal(panel, { onClose, canClose: !pending });

  async function send() {
    if (!chosen) return;
    setPending(true);
    setError(undefined);
    const result = await call(() =>
      api.POST('/api/v1/weddings/{weddingId}/ownership-transfers', {
        params: { path: { weddingId } },
        body: { toMembershipId: chosen.membershipId },
      }),
    );
    setPending(false);
    if (result.data) onSent();
    else if (result.error.code === 'OWNERSHIP_TRANSFER_ALREADY_PENDING') {
      setError(copy.alreadyPending);
    } else if (result.error.code === 'WEDDING_ALREADY_OWNED') {
      setError(copy.alreadyOwns(chosen.displayName));
    } else setError(copy.failed);
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
        className="relative max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-t-2xl border border-hairline bg-white p-6 shadow-2xl sm:rounded-xl"
      >
        {step === 1 ? (
          <>
            <h2 id={titleId} className="mb-2 font-serif text-headline-sm text-navy">
              {copy.step1Title}
            </h2>
            <p className="mb-4 text-body-sm text-on-surface-variant">
              {copy.step1Body(otherOwner)}
            </p>
            {candidates.length === 0 ? (
              <Banner tone="info" icon="info">
                {copy.noCandidates}
              </Banner>
            ) : (
              <fieldset>
                <legend className="mb-2 text-label-md text-navy">{copy.choose}</legend>
                <div className="space-y-2">
                  {candidates.map((member) => (
                    <label
                      key={member.membershipId}
                      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                        chosen?.membershipId === member.membershipId
                          ? 'border-champagne bg-[#faf5ee]'
                          : 'border-hairline'
                      }`}
                    >
                      <input
                        type="radio"
                        name="transfer-to"
                        checked={chosen?.membershipId === member.membershipId}
                        onChange={() => setChosen(member)}
                      />
                      <span className="text-label-md text-navy">{member.displayName}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <SecondaryButton onClick={onClose}>{copy.cancel}</SecondaryButton>
              <PrimaryButton disabled={!chosen} onClick={() => setStep(2)}>
                {copy.continue}
              </PrimaryButton>
            </div>
          </>
        ) : (
          <>
            <h2 id={titleId} className="mb-2 font-serif text-headline-sm text-navy">
              {copy.step2Title(chosen?.displayName ?? '')}
            </h2>
            <p className="mb-4 text-body-sm text-on-surface-variant">
              {copy.step2Note(chosen?.displayName ?? '', otherOwner)}
            </p>
            <label className="flex min-h-11 items-start gap-3">
              <input
                type="checkbox"
                checked={understood}
                onChange={(event) => setUnderstood(event.target.checked)}
                className="mt-1"
              />
              <span className="text-body-sm text-navy">{copy.understand}</span>
            </label>
            {error && (
              <div className="mt-4">
                <Banner tone="error" icon="error">
                  {error}
                </Banner>
              </div>
            )}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <SecondaryButton onClick={() => setStep(1)} disabled={pending}>
                {copy.back}
              </SecondaryButton>
              <PrimaryButton
                disabled={!understood}
                pending={pending}
                pendingLabel={copy.sending}
                onClick={() => void send()}
              >
                {copy.sendOffer}
              </PrimaryButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** The recipient's review: accept or decline the offered seat (Stitch "P10 · M6"). */
export function ReviewOfferDialog({
  weddingId,
  transfer,
  onClose,
  onDone,
}: {
  weddingId: string;
  transfer: ApiTransfer;
  onClose: () => void;
  onDone: (result: 'accepted' | 'declined' | 'stale') => void;
}) {
  const [pending, setPending] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string>();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModal(panel, { onClose, canClose: pending === null });

  async function answer(kind: 'accept' | 'decline') {
    setPending(kind);
    setError(undefined);
    const path = { weddingId, transferId: transfer.id };
    const result =
      kind === 'accept'
        ? await call(() =>
            api.POST('/api/v1/weddings/{weddingId}/ownership-transfers/{transferId}/accept', {
              params: { path },
            }),
          )
        : await call(() =>
            api.POST('/api/v1/weddings/{weddingId}/ownership-transfers/{transferId}/decline', {
              params: { path },
            }),
          );
    setPending(null);
    if (!result.error) onDone(kind === 'accept' ? 'accepted' : 'declined');
    else if (result.error.status === 409) onDone('stale');
    else setError(copy.failed);
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
        className="relative w-full max-w-[480px] rounded-t-2xl border border-hairline bg-white p-6 shadow-2xl sm:rounded-xl"
      >
        <h2 id={titleId} className="mb-2 font-serif text-headline-sm text-navy">
          {copy.reviewTitle}
        </h2>
        <p className="text-body-sm text-on-surface-variant">{copy.reviewBody(transfer.fromName)}</p>
        {error && (
          <div className="mt-4">
            <Banner tone="error" icon="error">
              {error}
            </Banner>
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <SecondaryButton
            disabled={pending !== null}
            pending={pending === 'decline'}
            pendingLabel={copy.declining}
            onClick={() => void answer('decline')}
          >
            {copy.decline}
          </SecondaryButton>
          <PrimaryButton
            disabled={pending !== null}
            pending={pending === 'accept'}
            pendingLabel={copy.accepting}
            onClick={() => void answer('accept')}
          >
            {copy.accept}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

/** "Ownership offer for you" on the Members page, with Review (0035 #3). */
export function OfferForYouCard({
  weddingId,
  weddingName,
  transfer,
  onDone,
}: {
  weddingId: string;
  weddingName: string;
  transfer: ApiTransfer;
  onDone: (result: 'accepted' | 'declined' | 'stale') => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-champagne bg-[#faf5ee] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Icon name="handshake" className="mt-0.5 size-5 text-secondary" />
        <div>
          <p className="font-medium text-navy">{copy.offerForYou}</p>
          <p className="text-body-sm text-on-surface-variant">
            {copy.offerLine(transfer.fromName, weddingName)}
          </p>
        </div>
      </div>
      <PrimaryButton onClick={() => setOpen(true)}>{copy.review}</PrimaryButton>
      {open && (
        <ReviewOfferDialog
          weddingId={weddingId}
          transfer={transfer}
          onClose={() => setOpen(false)}
          onDone={(result) => {
            setOpen(false);
            onDone(result);
          }}
        />
      )}
    </div>
  );
}

const dismissedKey = (transferId: string) => `mmm.dismissedOffer.${transferId}`;

/**
 * The recipient's banner on the dashboard. Dismissing only hides it, on this device; the
 * offer stays on the Members page (0035 #3).
 */
export function OwnershipOfferBanner() {
  const { wedding, permissions } = useReadyWorkspace();
  const weddingId = wedding?.id ?? '';
  const { transfers } = useTransfers(weddingId);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const offer = transfers.find(
    (transfer) =>
      transfer.status === 'PENDING' &&
      !permissions?.isOwner &&
      !dismissed.includes(transfer.id) &&
      !isDismissed(transfer.id),
  );
  if (!wedding || !offer) return null;
  return (
    <div className="mb-6 rounded-xl border border-champagne bg-[#faf5ee] p-4">
      <p className="font-medium text-navy">{copy.offerLine(offer.fromName, wedding.displayName)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link
          href={MEMBERS_PATH}
          className="inline-flex min-h-11 items-center rounded-lg bg-navy px-5 text-label-md text-on-primary"
        >
          {copy.review}
        </Link>
        <button
          type="button"
          onClick={() => {
            try {
              window.localStorage.setItem(dismissedKey(offer.id), '1');
            } catch {
              // Storage blocked: hidden until the page reloads.
            }
            setDismissed((ids) => [...ids, offer.id]);
          }}
          className="min-h-11 rounded-lg px-3 text-label-md text-navy hover:underline"
        >
          {copy.dismiss}
        </button>
        <span className="text-body-sm text-on-surface-variant">{copy.dismissNote}</span>
      </div>
    </div>
  );
}

function isDismissed(transferId: string): boolean {
  try {
    return window.localStorage.getItem(dismissedKey(transferId)) === '1';
  } catch {
    return false;
  }
}
