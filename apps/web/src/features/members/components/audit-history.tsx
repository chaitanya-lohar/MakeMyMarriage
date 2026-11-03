'use client';

import { useCallback, useEffect, useState } from 'react';
import { Chip } from '@/components/ui/chip';
import { Banner, SecondaryButton, controlClasses } from '@/components/ui/form';
import { MEMBERS_PATH } from '@/features/workspace/components/shell-parts';
import {
  PageHeader,
  RequireWedding,
  SkeletonCard,
} from '@/features/workspace/components/workspace-page';
import { roleLabels } from '@/features/workspace/content';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import { api, call } from '@/lib/api';
import { auditCopy as copy } from '../content';
import { dateTime, type ApiAuditEntry, type ApiMember } from '../member-model';

export function AuditPageContent() {
  return (
    <RequireWedding permission={['AUDIT', 'VIEW']}>
      {(wedding) => <AuditHistory wedding={wedding} />}
    </RequireWedding>
  );
}

/** The areas of Stitch "P10 · M9", each with the audit resource types it covers. */
const AREAS: { label: string; resourceType?: string; actions?: string[] }[] = [
  { label: 'Members', resourceType: 'wedding_membership' },
  { label: 'Invitations to members', resourceType: 'member_invitation' },
  { label: 'Ownership', resourceType: 'ownership_transfer' },
  { label: 'Partner', resourceType: 'partner_connection' },
  { label: 'Guest invitations', resourceType: 'guest_invitation' },
  { label: 'Guests', resourceType: 'guest_event' },
  { label: 'Tasks', resourceType: 'task' },
  { label: 'Expenses', resourceType: 'expense' },
  { label: 'Payments', resourceType: 'expense_payment' },
  { label: 'Vendors', resourceType: 'vendor' },
  { label: 'Bookings', resourceType: 'vendor_booking' },
];

/** A plain sentence for an entry (Stitch "P10 · M9"); falls back to a readable action name. */
function describe(entry: ApiAuditEntry): string {
  const actor = entry.actorName ?? copy.someone;
  const m = entry.metadata as Record<string, unknown>;
  const role = (value: unknown) => roleLabels[String(value)] ?? String(value);
  switch (entry.action) {
    case 'MEMBER_ROLE_CHANGED':
      return `${actor} changed a member's role from ${role(m.oldRole)} to ${role(m.newRole)}`;
    case 'MEMBER_PERMISSIONS_CHANGED':
      return `${actor} changed a member's custom permissions`;
    case 'MEMBER_REMOVED':
      return `${actor} removed a member`;
    case 'MEMBER_REACTIVATED':
      return `${actor} rejoined the wedding`;
    case 'MEMBER_INVITATION_CREATED':
      return `${actor} invited ${String(m.email)} as ${role(m.role)}`;
    case 'MEMBER_INVITATION_RESENT':
      return `${actor} resent the invitation to ${String(m.email)}`;
    case 'MEMBER_INVITATION_REVOKED':
      return `${actor} revoked the invitation to ${String(m.email)}`;
    case 'MEMBER_INVITATION_ACCEPTED':
      return `${actor} accepted an invitation as ${role(m.role)}`;
    case 'MEMBER_INVITATION_DECLINED':
      return `The invitation to ${String(m.email)} was declined`;
    case 'MEMBER_INVITATION_EXPIRED':
      return `The invitation to ${String(m.email)} expired`;
    case 'OWNERSHIP_TRANSFER_OFFERED':
      return `${actor} offered their ownership`;
    case 'OWNERSHIP_TRANSFER_DECLINED':
      return `${actor} declined an ownership offer`;
    case 'OWNERSHIP_TRANSFER_CANCELLED':
      return 'An ownership offer was cancelled';
    case 'OWNERSHIP_TRANSFERRED':
      return `${actor} accepted ownership`;
    // Phase 16 (decision 0038); wording draft (0039).
    case 'PARTNER_INVITATION_CREATED':
      return `${actor} invited ${String(m.email)} as their partner`;
    case 'PARTNER_INVITATION_RESENT':
      return `${actor} resent the partner invitation to ${String(m.email)}`;
    case 'PARTNER_INVITATION_REVOKED':
      return `${actor} cancelled the partner invitation to ${String(m.email)}`;
    case 'PARTNER_INVITATION_ACCEPTED':
      return `${actor} accepted the partner invitation`;
    case 'PARTNER_INVITATION_DECLINED':
      return `The partner invitation to ${String(m.email)} was declined`;
    case 'PARTNER_INVITATION_EXPIRED':
      return `The partner invitation to ${String(m.email)} expired`;
    case 'PARTNER_CONNECTED':
      return `${actor} became an owner of the wedding`;
    case 'PARTNER_DISCONNECTED':
      return `${actor} left the wedding`;
    case 'MEMBER_PROMOTED_TO_OWNER':
      return `${actor} became an owner; their custom permissions no longer apply`;
    case 'PERMISSION_DENIED':
      return `${actor} was refused an action they are not allowed to take`;
    default: {
      const words = entry.action.toLowerCase().replaceAll('_', ' ');
      return `${actor}: ${words}`;
    }
  }
}

function areaOf(entry: ApiAuditEntry): string {
  return (
    AREAS.find((area) => area.resourceType === entry.resourceType)?.label ?? entry.resourceType
  );
}

/** The audit history (Stitch "P10 · M9", API Design §7.1): read-only, for AUDIT:VIEW. */
function AuditHistory({ wedding }: { wedding: ApiWedding }) {
  const [area, setArea] = useState('');
  const [person, setPerson] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<ApiAuditEntry[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [people, setPeople] = useState<ApiMember[]>([]);

  useEffect(() => {
    void call(() =>
      api.GET('/api/v1/weddings/{weddingId}/members', {
        params: { path: { weddingId: wedding.id } },
      }),
    ).then((result) => {
      if (result.data) setPeople(result.data);
    });
  }, [wedding.id]);

  const load = useCallback(
    async (after?: string) => {
      // Called directly, not through call(): the page needs meta.pagination.
      const result = await api.GET('/api/v1/weddings/{weddingId}/audit-logs', {
        params: {
          path: { weddingId: wedding.id },
          query: {
            ...(area && { resourceType: area }),
            ...(person && { actorUserId: person }),
            ...(from && { from }),
            ...(to && { to }),
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
    [wedding.id, area, person, from, to],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setRows(null);
      void load();
    });
    return () => window.clearTimeout(timeout);
  }, [load, attempt]);

  const back = { href: MEMBERS_PATH, label: copy.back };

  return (
    <>
      <PageHeader title={copy.title} subtitle={copy.subtitle} back={back} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select
          aria-label={copy.area}
          className={controlClasses}
          value={area}
          onChange={(event) => setArea(event.target.value)}
        >
          <option value="">{copy.allAreas}</option>
          {AREAS.map((option) => (
            <option key={option.label} value={option.resourceType}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          aria-label={copy.person}
          className={controlClasses}
          value={person}
          onChange={(event) => setPerson(event.target.value)}
        >
          <option value="">{copy.everyone}</option>
          {people.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.displayName}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label={copy.from}
          className={controlClasses}
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        <input
          type="date"
          aria-label={copy.to}
          className={controlClasses}
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
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
          <SkeletonCard className="h-16" />
          <SkeletonCard className="h-16" />
          <SkeletonCard className="h-16" />
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-hairline bg-white p-8 text-center text-navy">
          {copy.empty}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-white">
            {rows.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                <p className="shrink-0 text-body-sm text-on-surface-variant sm:w-48">
                  {dateTime(entry.createdAt)}
                </p>
                <p className="min-w-0 flex-1 text-body-md text-navy">{describe(entry)}</p>
                <Chip tone="neutral" shape="tag">
                  {areaOf(entry)}
                </Chip>
              </li>
            ))}
          </ul>
          {cursor && (
            <SecondaryButton className="mt-4" onClick={() => void load(cursor)}>
              {copy.loadMore}
            </SecondaryButton>
          )}
        </>
      )}
    </>
  );
}
