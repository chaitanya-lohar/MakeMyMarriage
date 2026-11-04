'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PartnerCard } from '@/features/partner/components/partner-card';
import { rememberLeftWedding } from '@/features/partner/partner-model';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Banner, PrimaryButton, SecondaryButton } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { Toast } from '@/features/tasks/components/task-parts';
import { MEMBERS_PATH, initialsOf } from '@/features/workspace/components/shell-parts';
import {
  PageHeader,
  RequireWedding,
  SkeletonCard,
} from '@/features/workspace/components/workspace-page';
import { roleLabels } from '@/features/workspace/content';
import {
  usePermissions,
  useReadyWorkspace,
  useWorkspace,
} from '@/features/workspace/workspace-context';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import { api, call } from '@/lib/api';
import { confirmCopy, invitationsCopy, membersCopy as copy, ownershipCopy } from '../content';
import {
  INVITATION_STATUSES,
  daysUntil,
  shortDate,
  type ApiInvitation,
  type ApiMember,
} from '../member-model';
import { InviteDialog } from './invite-dialog';
import { OfferForYouCard, OwnerTransferPanel, useTransfers } from './ownership';

export function MembersPageContent() {
  return <RequireWedding>{(wedding) => <MembersPage wedding={wedding} />}</RequireWedding>;
}

type Tab = 'members' | 'invitations';

/**
 * The Members page (Stitch "P10 · M1", "M3"; decision 0035). Every member sees the member
 * directory; details, invitations and actions follow the caller's permissions, and the
 * server checks each action again (API Design §7.1).
 */
function MembersPage({ wedding }: { wedding: ApiWedding }) {
  const router = useRouter();
  const { user } = useReadyWorkspace();
  const { reload: reloadWorkspace } = useWorkspace();
  const { can, isOwner } = usePermissions();
  const [tab, setTab] = useState<Tab>('members');
  const [members, setMembers] = useState<ApiMember[] | null>(null);
  const [removedMembers, setRemovedMembers] = useState<ApiMember[]>([]);
  const [showRemoved, setShowRemoved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [inviting, setInviting] = useState<{ email?: string; reinvite?: boolean } | null>(null);
  const [removing, setRemoving] = useState<ApiMember | null>(null);
  const [removePending, setRemovePending] = useState(false);
  const [removeError, setRemoveError] = useState<string>();
  const [toast, setToast] = useState<string | null>(null);
  const [invitationsVersion, setInvitationsVersion] = useState(0);
  const { transfers, reload: reloadTransfers } = useTransfers(wedding.id);
  const canViewDetails = can('MEMBERS', 'VIEW');

  useEffect(() => {
    let active = true;
    void Promise.all([
      call(() =>
        api.GET('/api/v1/weddings/{weddingId}/members', {
          params: { path: { weddingId: wedding.id } },
        }),
      ),
      showRemoved && canViewDetails
        ? call(() =>
            api.GET('/api/v1/weddings/{weddingId}/members', {
              params: { path: { weddingId: wedding.id }, query: { status: 'REVOKED' } },
            }),
          )
        : Promise.resolve(null),
    ]).then(([active_, revoked]) => {
      if (!active) return;
      if (!active_.data) {
        setFailed(true);
        return;
      }
      setFailed(false);
      setMembers(active_.data);
      setRemovedMembers(revoked?.data ?? []);
    });
    return () => {
      active = false;
    };
  }, [wedding.id, showRemoved, canViewDetails, attempt]);

  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  const me = members?.find((member) => member.userId === user.id);
  const owners = members?.filter((member) => member.isOwner) ?? [];
  const pendingOffer = transfers.find((transfer) => transfer.status === 'PENDING');
  const offerForMe =
    pendingOffer && pendingOffer.toMembershipId === me?.membershipId ? pendingOffer : undefined;

  const canManage = (member: ApiMember) =>
    !member.isOwner &&
    member.membershipId !== me?.membershipId &&
    (isOwner || member.role !== 'ADMIN');

  return (
    <>
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        actions={
          <>
            {can('AUDIT', 'VIEW') && (
              <Link
                href={`${MEMBERS_PATH}/audit`}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-champagne bg-white px-5 text-label-md text-navy"
              >
                <Icon name="history" className="size-5" />
                {copy.auditLink}
              </Link>
            )}
            {can('MEMBERS', 'INVITE') && (
              <PrimaryButton icon="person_add" onClick={() => setInviting({})}>
                {copy.invite}
              </PrimaryButton>
            )}
          </>
        }
      />

      {offerForMe && (
        <OfferForYouCard
          weddingId={wedding.id}
          weddingName={wedding.displayName}
          transfer={offerForMe}
          onDone={(result) => {
            if (result === 'accepted') {
              setToast(ownershipCopy.accepted(wedding.displayName, offerForMe.fromName));
              reloadWorkspace();
            } else {
              if (result === 'stale') setToast(ownershipCopy.stale);
              reloadTransfers();
            }
          }}
        />
      )}

      {isOwner && members && (
        <section className="mb-6 rounded-xl border border-hairline bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-title-md text-navy">{copy.ownershipTitle}</h2>
              <p className="mt-1 text-body-sm text-on-surface-variant">{copy.ownershipBody}</p>
              <p className="mt-2 text-label-md text-navy">{copy.seats(owners.length)}</p>
            </div>
            <div className="sm:max-w-[340px]">
              <OwnerTransferPanel
                weddingId={wedding.id}
                members={members}
                myMembershipId={me?.membershipId ?? null}
                pending={pendingOffer}
                onChanged={() => reloadTransfers()}
              />
            </div>
          </div>
        </section>
      )}

      {isOwner && (
        <PartnerCard
          weddingId={wedding.id}
          weddingName={wedding.displayName}
          onToast={setToast}
          onChanged={() => {
            refresh();
            reloadWorkspace();
          }}
          onLeft={(otherName) => {
            rememberLeftWedding({ weddingName: wedding.displayName, otherName });
            router.replace('/dashboard');
            reloadWorkspace();
          }}
        />
      )}

      {canViewDetails && (
        <div role="tablist" className="mb-5 flex gap-2 border-b border-hairline">
          {(['members', 'invitations'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`-mb-px min-h-11 border-b-2 px-4 text-label-md ${
                tab === value
                  ? 'border-champagne text-navy'
                  : 'border-transparent text-on-surface-variant hover:text-navy'
              }`}
            >
              {value === 'members' ? copy.tabMembers : copy.tabInvitations}
            </button>
          ))}
        </div>
      )}

      {tab === 'invitations' && canViewDetails ? (
        <InvitationsTab
          key={invitationsVersion}
          weddingId={wedding.id}
          onToast={setToast}
          onInviteAgain={(email) => setInviting({ email })}
        />
      ) : failed ? (
        <div className="space-y-4">
          <Banner tone="error" icon="error">
            {copy.loadError}
          </Banner>
          <SecondaryButton icon="refresh" onClick={refresh}>
            {copy.retry}
          </SecondaryButton>
        </div>
      ) : !members ? (
        <div className="space-y-3" aria-busy="true">
          <SkeletonCard className="h-20" />
          <SkeletonCard className="h-20" />
          <SkeletonCard className="h-20" />
        </div>
      ) : (
        <>
          {canViewDetails && (
            <label className="mb-4 flex min-h-11 items-center gap-2 text-body-sm text-navy">
              <input
                type="checkbox"
                checked={showRemoved}
                onChange={(event) => setShowRemoved(event.target.checked)}
              />
              {copy.showRemoved}
            </label>
          )}
          {members.length === 1 && !showRemoved ? (
            <div className="rounded-xl border border-hairline bg-white p-8 text-center">
              <p className="font-serif text-headline-sm text-navy">{copy.emptyTitle}</p>
              <p className="mt-2 text-body-sm text-on-surface-variant">{copy.emptyBody}</p>
              {can('MEMBERS', 'INVITE') && (
                <PrimaryButton className="mt-4" icon="person_add" onClick={() => setInviting({})}>
                  {copy.invite}
                </PrimaryButton>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-white">
              {[...members, ...(showRemoved ? removedMembers : [])].map((member) => {
                const removed = member.status === 'REVOKED';
                return (
                  <li
                    key={member.membershipId}
                    className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center ${removed ? 'opacity-70' : ''}`}
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-full border border-champagne/30 bg-[#faf5ee] text-label-md text-[#7a5e2e]"
                    >
                      {initialsOf(member.displayName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-navy">
                        {member.displayName}
                        {member.membershipId === me?.membershipId && (
                          <span className="text-body-sm text-on-surface-variant">{copy.you}</span>
                        )}
                        {member.hasOverrides && (
                          <Chip tone="champagne" shape="tag">
                            {copy.customPermissions}
                          </Chip>
                        )}
                      </p>
                      {member.email && (
                        <p className="truncate text-body-sm text-on-surface-variant">
                          {member.email}
                        </p>
                      )}
                      {(member.acceptedAt || member.revokedAt) && (
                        <p className="text-body-sm text-on-surface-variant">
                          {removed && member.revokedAt
                            ? member.left
                              ? copy.leftOn(shortDate(member.revokedAt))
                              : copy.removedOn(shortDate(member.revokedAt))
                            : member.acceptedAt
                              ? copy.joinedOn(shortDate(member.acceptedAt))
                              : null}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone={member.isOwner ? 'champagne' : 'neutral'}>
                        {member.isOwner
                          ? copy.owner
                          : member.left
                            ? copy.formerMember
                            : (roleLabels[member.role ?? ''] ?? '')}
                      </Chip>
                      {removed ? (
                        // A former partner is invited again from the Partner card (0039).
                        !member.left &&
                        can('MEMBERS', 'INVITE') &&
                        member.email && (
                          <SecondaryButton
                            onClick={() => setInviting({ email: member.email, reinvite: true })}
                          >
                            {copy.inviteAgain}
                          </SecondaryButton>
                        )
                      ) : (
                        <>
                          {canViewDetails && (
                            <Link
                              href={`${MEMBERS_PATH}/${member.membershipId}`}
                              className="inline-flex min-h-11 items-center rounded-lg px-3 text-label-md text-navy hover:underline"
                            >
                              {copy.viewAndEdit}
                            </Link>
                          )}
                          {can('MEMBERS', 'REMOVE') && canManage(member) && (
                            <button
                              type="button"
                              onClick={() => setRemoving(member)}
                              className="inline-flex min-h-11 items-center rounded-lg px-3 text-label-md text-error hover:underline"
                            >
                              {copy.remove}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {inviting && (
        <InviteDialog
          weddingId={wedding.id}
          initialEmail={inviting.email}
          reinvite={inviting.reinvite}
          onClose={() => setInviting(null)}
          onSent={(message) => {
            setInviting(null);
            setToast(message);
            setInvitationsVersion((value) => value + 1);
          }}
          onResendInstead={() => {
            setInviting(null);
            setTab('invitations');
          }}
        />
      )}

      {removing && (
        <ConfirmDialog
          title={confirmCopy.removeTitle(removing.displayName)}
          body={confirmCopy.removeBody(removing.displayName)}
          icon="person_remove"
          tone="danger"
          confirmLabel={confirmCopy.removeConfirm}
          cancelLabel={confirmCopy.cancel}
          pendingLabel={confirmCopy.removing}
          pending={removePending}
          error={removeError}
          onCancel={() => {
            setRemoving(null);
            setRemoveError(undefined);
          }}
          onConfirm={() => {
            setRemovePending(true);
            void call(() =>
              api.DELETE('/api/v1/weddings/{weddingId}/members/{membershipId}', {
                params: { path: { weddingId: wedding.id, membershipId: removing.membershipId } },
              }),
            ).then((result) => {
              setRemovePending(false);
              if (result.error) {
                setRemoveError(invitationsCopy.actionFailed);
                return;
              }
              setToast(copy.removed(removing.displayName));
              setRemoving(null);
              refresh();
              reloadTransfers();
            });
          }}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  );
}

/** The Invitations tab (Stitch "P10 · M3"), for members with MEMBERS:VIEW. */
function InvitationsTab({
  weddingId,
  onToast,
  onInviteAgain,
}: {
  weddingId: string;
  onToast: (message: string) => void;
  onInviteAgain: (email: string) => void;
}) {
  const { can, isOwner } = usePermissions();
  const [status, setStatus] = useState('PENDING');
  const [rows, setRows] = useState<ApiInvitation[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [confirm, setConfirm] = useState<{ kind: 'resend' | 'revoke'; row: ApiInvitation } | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(
    async (after?: string) => {
      // Called directly, not through call(): the page needs meta.pagination.
      const result = await api.GET('/api/v1/weddings/{weddingId}/members/invitations', {
        params: {
          path: { weddingId },
          query: {
            status: status as ApiInvitation['status'],
            ...(after && { cursor: after }),
          },
        },
      });
      if (!result.data) {
        setFailed(true);
        return;
      }
      setFailed(false);
      const page = result.data.data;
      setRows((old) => (after ? [...(old ?? []), ...page] : page));
      setCursor(result.data.meta.pagination.nextCursor);
    },
    [weddingId, status],
  );

  useEffect(() => {
    // Deferred, as in the vendor list: no state change during the effect itself.
    const timeout = window.setTimeout(() => {
      setRows(null);
      void load();
    });
    return () => window.clearTimeout(timeout);
  }, [load, attempt]);

  const manageable = (row: ApiInvitation) =>
    row.status === 'PENDING' && can('MEMBERS', 'INVITE') && (isOwner || row.role !== 'ADMIN');

  async function act() {
    if (!confirm) return;
    setPending(true);
    setError(undefined);
    const path = { weddingId, invitationId: confirm.row.id };
    const result =
      confirm.kind === 'resend'
        ? await call(() =>
            api.POST('/api/v1/weddings/{weddingId}/members/invitations/{invitationId}/resend', {
              params: { path },
            }),
          )
        : await call(() =>
            api.POST('/api/v1/weddings/{weddingId}/members/invitations/{invitationId}/revoke', {
              params: { path },
            }),
          );
    setPending(false);
    if (result.error) {
      setError(
        result.error.code === 'RATE_LIMITED'
          ? invitationsCopy.resendLimit
          : invitationsCopy.actionFailed,
      );
      return;
    }
    onToast(confirm.kind === 'resend' ? invitationsCopy.resent : invitationsCopy.revoked);
    setConfirm(null);
    setAttempt((value) => value + 1);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2" role="group">
        {INVITATION_STATUSES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
            className={`min-h-11 rounded-full border px-4 text-label-md ${
              status === value ? 'border-navy bg-navy text-on-primary' : 'border-hairline text-navy'
            }`}
          >
            {invitationsCopy.filters[value]}
          </button>
        ))}
      </div>
      {failed ? (
        <div className="space-y-4">
          <Banner tone="error" icon="error">
            {copy.loadError}
          </Banner>
          <SecondaryButton icon="refresh" onClick={() => setAttempt((value) => value + 1)}>
            {copy.retry}
          </SecondaryButton>
        </div>
      ) : !rows ? (
        <div className="space-y-3" aria-busy="true">
          <SkeletonCard className="h-20" />
          <SkeletonCard className="h-20" />
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-hairline bg-white p-8 text-center text-body-md text-navy">
          {status === 'PENDING' ? invitationsCopy.emptyPending : invitationsCopy.empty}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-white">
            {rows.map((row) => {
              const days = daysUntil(row.expiresAt);
              return (
                <li key={row.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-navy">{row.email}</p>
                    <p className="text-body-sm text-on-surface-variant">
                      {shortDate(row.createdAt)}
                      {row.status === 'PENDING' && (
                        <span className={days <= 0 ? 'text-error' : ''}>
                          {' · '}
                          {invitationsCopy.expiresIn(days)}
                        </span>
                      )}
                    </p>
                    {row.status === 'EXPIRED' && (
                      <button
                        type="button"
                        onClick={() => onInviteAgain(row.email)}
                        className="mt-1 text-body-sm text-navy underline"
                      >
                        {invitationsCopy.inviteAgainHint}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="neutral">{roleLabels[row.role] ?? row.role}</Chip>
                    <Chip
                      tone={
                        row.status === 'PENDING'
                          ? 'champagne'
                          : row.status === 'ACCEPTED'
                            ? 'sage'
                            : 'muted'
                      }
                    >
                      {invitationsCopy.filters[row.status] ?? row.status}
                    </Chip>
                    {manageable(row) ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setConfirm({ kind: 'resend', row })}
                          className="inline-flex min-h-11 items-center rounded-lg px-3 text-label-md text-navy hover:underline"
                        >
                          {invitationsCopy.resend}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirm({ kind: 'revoke', row })}
                          className="inline-flex min-h-11 items-center rounded-lg px-3 text-label-md text-error hover:underline"
                        >
                          {invitationsCopy.revoke}
                        </button>
                      </>
                    ) : (
                      row.status === 'PENDING' &&
                      row.role === 'ADMIN' &&
                      !isOwner && (
                        <span className="inline-flex items-center gap-1 text-label-sm text-on-surface-variant">
                          <Icon name="lock" className="size-4" />
                          {invitationsCopy.ownerOnly}
                        </span>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {cursor && (
            <SecondaryButton className="mt-4" onClick={() => void load(cursor)}>
              {copy.loadMore}
            </SecondaryButton>
          )}
        </>
      )}
      {confirm && (
        <ConfirmDialog
          title={
            confirm.kind === 'resend' ? invitationsCopy.resendTitle : invitationsCopy.revokeTitle
          }
          body={confirm.kind === 'resend' ? invitationsCopy.resendBody : invitationsCopy.revokeBody}
          icon={confirm.kind === 'resend' ? 'send' : 'link_off'}
          tone={confirm.kind === 'resend' ? 'primary' : 'danger'}
          confirmLabel={
            confirm.kind === 'resend'
              ? invitationsCopy.resendConfirm
              : invitationsCopy.revokeConfirm
          }
          cancelLabel={invitationsCopy.keep}
          pendingLabel={
            confirm.kind === 'resend' ? invitationsCopy.resending : invitationsCopy.revoking
          }
          pending={pending}
          error={error}
          onCancel={() => {
            setConfirm(null);
            setError(undefined);
          }}
          onConfirm={() => void act()}
        />
      )}
    </>
  );
}
