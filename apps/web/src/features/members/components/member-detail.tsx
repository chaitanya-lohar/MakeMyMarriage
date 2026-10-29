'use client';

import { useCallback, useEffect, useState } from 'react';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Banner, PrimaryButton, SecondaryButton } from '@/components/ui/form';
import { Toast } from '@/features/tasks/components/task-parts';
import { MEMBERS_PATH } from '@/features/workspace/components/shell-parts';
import {
  PageHeader,
  RequireWedding,
  SkeletonCard,
} from '@/features/workspace/components/workspace-page';
import { roleLabels } from '@/features/workspace/content';
import { usePermissions, useReadyWorkspace } from '@/features/workspace/workspace-context';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import { api, call } from '@/lib/api';
import { confirmCopy, memberDetailCopy as copy, roleDescriptions } from '../content';
import {
  ASSIGNABLE_ROLES,
  overrideMap,
  overridesFrom,
  shortDate,
  type ApiMember,
  type ApiMemberPermissions,
  type AssignableRole,
} from '../member-model';
import { PermissionsTable } from './permissions-table';

export function MemberPageContent({ membershipId }: { membershipId: string }) {
  return (
    <RequireWedding>
      {(wedding) => <MemberDetail wedding={wedding} membershipId={membershipId} />}
    </RequireWedding>
  );
}

/**
 * A member's role and permissions (Stitch "P10 · M4", "M5"; API Design §7.1). Owners' pages
 * have no controls; nobody changes their own access; only owners manage admins (P10-4). A
 * role change keeps the member's custom permissions (0035 #2).
 */
function MemberDetail({ wedding, membershipId }: { wedding: ApiWedding; membershipId: string }) {
  const { user } = useReadyWorkspace();
  const { can, isOwner } = usePermissions();
  const [member, setMember] = useState<ApiMember | null>(null);
  const [permissions, setPermissions] = useState<ApiMemberPermissions | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [role, setRole] = useState<AssignableRole>('VIEWER');
  const [choices, setChoices] = useState(new Map<string, 'ALLOW' | 'DENY'>());
  const [confirmRole, setConfirmRole] = useState(false);
  const [saving, setSaving] = useState<'role' | 'permissions' | null>(null);
  const [error, setError] = useState<string>();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      call(() =>
        api.GET('/api/v1/weddings/{weddingId}/members', {
          params: { path: { weddingId: wedding.id } },
        }),
      ),
      call(() =>
        api.GET('/api/v1/weddings/{weddingId}/members/{membershipId}/permissions', {
          params: { path: { weddingId: wedding.id, membershipId } },
        }),
      ),
    ]).then(([list, granted]) => {
      if (!active) return;
      if (granted.error?.status === 404) {
        setState('missing');
        return;
      }
      const found = list.data?.find((candidate) => candidate.membershipId === membershipId);
      if (!found || !granted.data) {
        setState(found || list.data ? 'missing' : 'error');
        return;
      }
      setMember(found);
      setPermissions(granted.data);
      setRole((found.role as AssignableRole) ?? 'VIEWER');
      setChoices(overrideMap(granted.data.overrides));
      setState('ready');
    });
    return () => {
      active = false;
    };
  }, [wedding.id, membershipId, attempt]);

  const save = useCallback(
    async (body: {
      role?: AssignableRole;
      permissionOverrides?: ReturnType<typeof overridesFrom>;
    }) => {
      if (!member) return;
      setSaving(body.role ? 'role' : 'permissions');
      setError(undefined);
      const result = await call(() =>
        api.PATCH('/api/v1/weddings/{weddingId}/members/{membershipId}', {
          params: { path: { weddingId: wedding.id, membershipId } },
          body,
        }),
      );
      setSaving(null);
      setConfirmRole(false);
      if (result.error) {
        const reason = result.error.details.reason;
        setError(reason === 'GRANT_EXCEEDS_CALLER' ? copy.grantExceeds : copy.failed);
        return;
      }
      setToast(
        body.role
          ? copy.roleSaved(member.displayName, roleLabels[body.role] ?? body.role)
          : copy.saved(member.displayName),
      );
      setAttempt((value) => value + 1);
    },
    [member, wedding.id, membershipId],
  );

  const back = { href: MEMBERS_PATH, label: copy.back };
  if (state === 'loading') {
    return (
      <div className="space-y-4" aria-busy="true">
        <SkeletonCard className="h-28" />
        <SkeletonCard className="h-64" />
      </div>
    );
  }
  if (state !== 'ready' || !member || !permissions) {
    return (
      <>
        <PageHeader title={copy.notFound} back={back} />
        {state === 'error' && (
          <SecondaryButton icon="refresh" onClick={() => setAttempt((value) => value + 1)}>
            {copy.failed}
          </SecondaryButton>
        )}
      </>
    );
  }

  const isSelf = member.userId === user.id;
  const lockReason = member.isOwner
    ? copy.ownerPage
    : isSelf
      ? copy.yourself
      : !isOwner && member.role === 'ADMIN'
        ? copy.manageAdmins
        : null;
  const canChangeRole = !lockReason && can('MEMBERS', 'CHANGE_ROLE');
  const canEditPermissions = !lockReason && can('MEMBERS', 'EDIT_PERMISSIONS');
  const roleName = roleLabels[member.role ?? ''] ?? '';

  return (
    <>
      <PageHeader
        title={member.displayName}
        back={back}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Chip tone={member.isOwner ? 'champagne' : 'neutral'}>{roleName}</Chip>
            {member.email && <span>{member.email}</span>}
            {member.acceptedAt && <span>· {copy.joined(shortDate(member.acceptedAt))}</span>}
          </span>
        }
      />

      {lockReason && (
        <div className="mb-6">
          <Banner tone="info" icon="lock">
            {lockReason}
          </Banner>
        </div>
      )}
      {error && (
        <div className="mb-6">
          <Banner tone="error" icon="error">
            {error}
          </Banner>
        </div>
      )}

      {!member.isOwner && (
        <section className="mb-6 rounded-xl border border-hairline bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-title-md text-navy">{copy.role}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {ASSIGNABLE_ROLES.map((option) => {
              const locked = !canChangeRole || (option === 'ADMIN' && !isOwner);
              return (
                <label
                  key={option}
                  className={`flex min-h-11 gap-3 rounded-lg border p-3 ${
                    role === option ? 'border-champagne bg-[#faf5ee]' : 'border-hairline'
                  } ${locked ? 'opacity-60' : 'cursor-pointer'}`}
                >
                  <input
                    type="radio"
                    name="member-role"
                    checked={role === option}
                    disabled={locked}
                    onChange={() => setRole(option)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-label-md text-navy">{roleLabels[option]}</span>
                    <span className="block text-body-sm text-on-surface-variant">
                      {roleDescriptions[option]}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {canChangeRole && (
            <div className="mt-4 flex flex-col items-start gap-1">
              <PrimaryButton disabled={role === member.role} onClick={() => setConfirmRole(true)}>
                {copy.saveRole}
              </PrimaryButton>
              <p className="text-body-sm text-on-surface-variant">{copy.roleKeepsOverrides}</p>
            </div>
          )}
        </section>
      )}

      {!member.isOwner && (
        <section className="rounded-xl border border-hairline bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-title-md text-navy">{copy.permissions}</h2>
          <p className="mb-4 text-body-sm text-on-surface-variant">
            {copy.overrides(permissions.overrides.length)}
          </p>
          <PermissionsTable
            choices={choices}
            onChange={setChoices}
            effective={permissions.permissions}
            readOnly={!canEditPermissions}
            canAllow={(module, action) => isOwner || can(module, action)}
          />
          {canEditPermissions && (
            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <SecondaryButton
                disabled={saving !== null}
                onClick={() => void save({ permissionOverrides: [] })}
              >
                {copy.reset}
              </SecondaryButton>
              <PrimaryButton
                pending={saving === 'permissions'}
                pendingLabel={copy.saving}
                onClick={() => void save({ permissionOverrides: overridesFrom(choices) })}
              >
                {copy.savePermissions}
              </PrimaryButton>
            </div>
          )}
        </section>
      )}

      {confirmRole && (
        <ConfirmDialog
          title={confirmCopy.roleTitle(member.displayName, roleLabels[role] ?? role)}
          body={confirmCopy.roleKeeps(member.displayName)}
          icon="manage_accounts"
          tone="primary"
          confirmLabel={confirmCopy.roleConfirm}
          cancelLabel={confirmCopy.cancel}
          pendingLabel={copy.saving}
          pending={saving === 'role'}
          onCancel={() => setConfirmRole(false)}
          onConfirm={() => void save({ role })}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  );
}
