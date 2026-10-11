'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PrimaryButton, QuietButton, SecondaryButton } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { networkError } from '@/features/weddings/content';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import { api, call, type ApiError } from '@/lib/api';
import { invitationPanel, linkRevoked, regenerateLink, revokeLink } from '../content';
import {
  emailStatusLabel,
  failureText,
  firstNameOf,
  formatDateTime,
  whatsappShareUrl,
  type ApiGuest,
  type ApiInvitationHistory,
} from '../guest-model';

type Dialog = 'regenerate' | 'revoke' | null;

/**
 * Stitch "P4 · O8 Invitation Panel" (content from the mobile screen — decision 0021). Offers only
 * the actions that fit the invitation's state (Phase 4 PRD §10.1). The link text is never shown;
 * Copy Link and WhatsApp fetch the current link, which never creates a token (0019).
 */
export function InvitationPanel({
  wedding,
  guest,
  onGuestChanged,
  onError,
}: {
  wedding: ApiWedding;
  guest: ApiGuest;
  onGuestChanged: () => void;
  onError: (error: ApiError) => boolean;
}) {
  const invitation = guest.invitation;
  const path = { weddingId: wedding.id, guestId: guest.id };
  const firstName = firstNameOf(guest.name);
  const [history, setHistory] = useState<ApiInvitationHistory | null>(null);
  // Each action has its own busy flag, so finishing one never re-enables another (review M5).
  // The ref guards against a double click before the state has re-rendered.
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef(new Set<string>());
  // One Idempotency-Key per intended send, kept until the API accepts it, so retrying after a
  // network failure can never queue a second email (review M5).
  const sendKey = useRef<{ kind: 'send' | 'resend'; key: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [regenerated, setRegenerated] = useState(false);

  // The attempts and opens, reloaded whenever the guest (and so the invitation) is refreshed.
  useEffect(() => {
    if (!invitation) return;
    let active = true;
    void call(() =>
      api.GET('/api/v1/weddings/{weddingId}/guests/{guestId}/invitation/deliveries', {
        params: { path: { weddingId: wedding.id, guestId: guest.id } },
      }),
    ).then((result) => {
      if (active && result.data) setHistory(result.data);
    });
    return () => {
      active = false;
    };
  }, [invitation, wedding.id, guest.id]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  function fail(apiError: ApiError) {
    if (onError(apiError)) return;
    // Conflicts and the missing-email case carry a message written for organizers.
    if (apiError.status === 409 || apiError.status === 422) setError(apiError.message);
    else setError(apiError.status === 0 ? networkError : invitationPanel.error);
    onGuestChanged();
  }

  function markBusy(name: string, on: boolean) {
    if (on) inFlight.current.add(name);
    else inFlight.current.delete(name);
    setBusy(new Set(inFlight.current));
  }

  /** Runs one action; returns null if it is already running or failed. */
  async function run<T>(name: string, request: () => Promise<{ data?: T; error?: ApiError }>) {
    if (inFlight.current.has(name)) return null;
    markBusy(name, true);
    setError(null);
    const result = await request();
    markBusy(name, false);
    if (result.error) {
      fail(result.error);
      return null;
    }
    return result.data ?? null;
  }

  async function create() {
    const data = await run('create', () =>
      call(() =>
        api.POST('/api/v1/weddings/{weddingId}/guests/{guestId}/invitation', { params: { path } }),
      ),
    );
    if (data) onGuestChanged();
  }

  const fetchLink = () =>
    call(() =>
      api.GET('/api/v1/weddings/{weddingId}/guests/{guestId}/invitation/link', {
        params: { path },
      }),
    );

  async function copyLink() {
    if (inFlight.current.has('copy')) return;
    markBusy('copy', true);
    setError(null);
    let apiError: ApiError | undefined;
    const link = fetchLink().then((result) => {
      if (result.error) {
        apiError = result.error;
        throw new Error('link unavailable');
      }
      return result.data.invitationUrl;
    });
    try {
      // Safari only allows clipboard writes started inside the click, so the write begins now
      // with the link still on its way (review M7). Elsewhere it falls back to writeText.
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': link.then((url) => new Blob([url], { type: 'text/plain' })),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(await link);
      }
      setToast(invitationPanel.copied);
    } catch {
      if (apiError) fail(apiError);
      else setError(invitationPanel.error);
    } finally {
      markBusy('copy', false);
    }
  }

  async function shareOnWhatsApp() {
    // Opened now, while the click still counts as a user action, so it is not blocked.
    const tab = window.open('', '_blank');
    const data = await run('whatsapp', fetchLink);
    if (!data) {
      tab?.close();
      return;
    }
    const url = whatsappShareUrl(guest.name, wedding.displayName, data.invitationUrl);
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      window.location.href = url;
    }
  }

  async function sendEmail(kind: 'send' | 'resend') {
    if (inFlight.current.has('send') || inFlight.current.has('resend')) return;
    if (sendKey.current?.kind !== kind) sendKey.current = { kind, key: crypto.randomUUID() };
    const { key } = sendKey.current;
    const route =
      kind === 'send'
        ? ('/api/v1/weddings/{weddingId}/guests/{guestId}/invitation/send' as const)
        : ('/api/v1/weddings/{weddingId}/guests/{guestId}/invitation/resend' as const);
    let refused = false;
    const data = await run(kind, async () => {
      const result = await call(() =>
        api.POST(route, { params: { path, header: { 'Idempotency-Key': key } } }),
      );
      // A refusal (revoked link, missing email) means a later click is a new intent.
      refused =
        result.error !== undefined && result.error.status >= 400 && result.error.status < 500;
      return result;
    });
    if (data || refused) sendKey.current = null;
    if (!data) return;
    setToast(invitationPanel.queued);
    // The worker records the attempt shortly; refresh twice to pick it up.
    setTimeout(onGuestChanged, 2500);
    setTimeout(onGuestChanged, 7000);
  }

  async function confirmDialog() {
    const action = dialog;
    const data =
      action === 'regenerate'
        ? await run('regenerate', () =>
            call(() =>
              api.POST('/api/v1/weddings/{weddingId}/guests/{guestId}/invitation/regenerate', {
                params: { path },
              }),
            ),
          )
        : await run('revoke', () =>
            call(() =>
              api.POST('/api/v1/weddings/{weddingId}/guests/{guestId}/invitation/revoke', {
                params: { path },
              }),
            ),
          );
    setDialog(null);
    if (!data) return;
    setRegenerated(action === 'regenerate');
    onGuestChanged();
  }

  const closeDialog = useCallback(() => setDialog(null), []);
  const status = emailStatusLabel(invitation);
  const statusTone = status === 'Sent' ? 'sage' : status === 'Draft' ? 'champagne' : 'neutral';

  return (
    <section className="rounded-xl border border-hairline bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-headline-sm text-navy">{invitationPanel.title}</h2>
        {invitation && (
          <Chip
            tone={statusTone}
            className={`text-label-sm ${status === 'Failed' ? 'text-error' : ''}`}
          >
            {invitationPanel.emailStatus.replace('{status}', status)}
          </Chip>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-4 flex items-start gap-1.5 text-body-sm text-error">
          <Icon name="error" className="mt-0.5 size-4" />
          {error}
        </p>
      )}

      {!invitation && (
        <>
          <p className="mb-4 text-body-md text-on-surface-variant">
            {invitationPanel.none.replace('{name}', firstName)}
          </p>
          <PrimaryButton
            icon="add_link"
            onClick={() => void create()}
            pending={busy.has('create')}
            pendingLabel={invitationPanel.creating}
          >
            {invitationPanel.create}
          </PrimaryButton>
        </>
      )}

      {invitation?.isRevoked && (
        <>
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-error-container/70 px-2 py-1 text-body-sm font-medium text-on-error-container">
            <Icon name="warning" className="size-4" />
            {linkRevoked}
          </p>
          <p className="mb-4 flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2.5 text-body-sm text-outline">
            <Icon name="link_off" className="size-5" />
            {invitationPanel.linkRevoked}
          </p>
          <p className="mb-4 text-body-sm text-on-surface-variant">{invitationPanel.revokedNote}</p>
          <History history={history} />
          <PrimaryButton
            icon="refresh"
            onClick={() => setDialog('regenerate')}
            pending={busy.has('regenerate')}
          >
            {invitationPanel.regenerate}
          </PrimaryButton>
        </>
      )}

      {invitation && !invitation.isRevoked && (
        <>
          <p className="mb-4 flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2.5 text-body-sm font-medium text-navy">
            <Icon name="link" className="size-5 text-secondary" />
            {invitationPanel.linkReady}
          </p>
          {regenerated && invitation.deliveryStatus === 'DRAFT' && (
            <p className="mb-4 rounded-lg bg-[#faf5ee] px-3 py-2.5 text-body-sm text-on-surface">
              {invitationPanel.regenerated}
            </p>
          )}
          {invitation.lastSentAt && (
            <p className="mb-1 text-body-sm text-on-surface-variant">
              {invitationPanel.lastSent.replace('{date}', formatDateTime(invitation.lastSentAt))}
            </p>
          )}
          {invitation.firstOpenedAt && (
            <div className="mb-4">
              <p className="text-body-sm text-on-surface">
                {invitationPanel.firstOpened.replace(
                  '{date}',
                  formatDateTime(invitation.firstOpenedAt),
                )}
              </p>
              <p className="text-body-sm text-on-surface-variant">{invitationPanel.openedNote}</p>
            </div>
          )}
          <History history={history} />

          <div className="space-y-3">
            {guest.email ? (
              invitation.deliveryStatus === 'DRAFT' ? (
                <PrimaryButton
                  icon="send"
                  className="w-full sm:w-auto"
                  onClick={() => void sendEmail('send')}
                  pending={busy.has('send')}
                  pendingLabel={invitationPanel.sending}
                >
                  {invitationPanel.send}
                </PrimaryButton>
              ) : (
                <PrimaryButton
                  icon="forward_to_inbox"
                  className="w-full sm:w-auto"
                  onClick={() => void sendEmail('resend')}
                  pending={busy.has('resend')}
                  pendingLabel={invitationPanel.sending}
                >
                  {invitationPanel.resend}
                </PrimaryButton>
              )
            ) : (
              <p className="text-body-sm text-on-surface-variant">{invitationPanel.needsEmail}</p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
              <SecondaryButton
                icon="chat"
                onClick={() => void shareOnWhatsApp()}
                pending={busy.has('whatsapp')}
              >
                {invitationPanel.whatsapp}
              </SecondaryButton>
              <SecondaryButton
                icon="content_copy"
                onClick={() => void copyLink()}
                pending={busy.has('copy')}
              >
                {invitationPanel.copy}
              </SecondaryButton>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-t border-hairline pt-3">
              <QuietButton icon="refresh" onClick={() => setDialog('regenerate')}>
                {invitationPanel.regenerate}
              </QuietButton>
              <QuietButton icon="block" onClick={() => setDialog('revoke')} tone="danger">
                {invitationPanel.revoke}
              </QuietButton>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div
          role="status"
          className="fixed right-4 bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg bg-navy px-4 py-3 text-body-sm text-on-primary shadow-lg sm:left-auto"
        >
          <Icon name="check_circle" className="size-5 text-champagne" />
          {toast}
        </div>
      )}

      {dialog === 'regenerate' && (
        <ConfirmDialog
          title={
            invitation?.isRevoked
              ? regenerateLink.revokedTitle.replace('{name}', firstName)
              : regenerateLink.title
          }
          body={
            invitation?.isRevoked
              ? regenerateLink.revokedBody
              : regenerateLink.body.replace('{name}', firstName)
          }
          icon="refresh"
          confirmLabel={regenerateLink.confirm}
          cancelLabel={regenerateLink.cancel}
          pendingLabel={regenerateLink.pending}
          tone="primary"
          pending={busy.has('regenerate')}
          onConfirm={() => void confirmDialog()}
          onCancel={closeDialog}
        />
      )}
      {dialog === 'revoke' && (
        <ConfirmDialog
          title={revokeLink.title}
          body={revokeLink.body}
          icon="link_off"
          confirmLabel={revokeLink.confirm}
          cancelLabel={revokeLink.cancel}
          pendingLabel={revokeLink.pending}
          tone="danger"
          pending={busy.has('revoke')}
          onConfirm={() => void confirmDialog()}
          onCancel={closeDialog}
        />
      )}
    </section>
  );
}

/** Email attempts, newest first: sent, or failed with the reason (never "delivered"). */
function History({ history }: { history: ApiInvitationHistory | null }) {
  if (!history || history.deliveries.length === 0) return null;
  const attempts = [...history.deliveries].reverse();
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-label-sm text-on-surface-variant uppercase">
        {invitationPanel.history}
      </h3>
      <ul className="space-y-1.5">
        {attempts.map((attempt) => {
          const failed = attempt.status === 'FAILED';
          const when = formatDateTime(attempt.failedAt ?? attempt.sentAt ?? attempt.createdAt);
          return (
            <li
              key={attempt.attemptNumber}
              className={`flex items-start gap-2 text-body-sm ${failed ? 'text-error' : 'text-on-surface'}`}
            >
              <Icon name={failed ? 'error' : 'check_circle'} className="mt-0.5 size-4" />
              {failed
                ? invitationPanel.attemptFailed
                    .replace('{date}', when)
                    .replace('{reason}', failureText(attempt.failureReason))
                : invitationPanel.attemptSent.replace('{date}', when)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
