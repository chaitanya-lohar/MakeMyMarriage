'use client';

import { useEffect, useState } from 'react';
import { initialsOf } from '@/features/workspace/components/shell-parts';
import { api, call } from '@/lib/api';

/** A member as the pickers show them: the directory form only (API Design §7.1). */
export interface PickableMember {
  userId: string;
  displayName: string;
  isOwner: boolean;
  /** A former member kept on an existing record (0030); never newly chosen. */
  former?: boolean;
}

export const pickerCopy = {
  me: 'Me',
  owner: 'Owner',
  former: 'former member',
  helper: 'Choosing someone does not give them access.',
};

/**
 * The wedding's active members for the assignee and payer pickers (P10-8, Stitch "P10 ·
 * M10"): you first, then owners, then everyone else by name. Null while loading. Being
 * chosen grants nothing; every active member may be chosen.
 */
export function useMemberDirectory(weddingId: string, currentUserId: string) {
  const [members, setMembers] = useState<PickableMember[] | null>(null);
  useEffect(() => {
    let active = true;
    void call(() =>
      api.GET('/api/v1/weddings/{weddingId}/members', {
        params: { path: { weddingId } },
      }),
    ).then((result) => {
      if (!active) return;
      const list = (result.data ?? []).map(({ userId, displayName, isOwner }) => ({
        userId,
        displayName,
        isOwner,
      }));
      list.sort(
        (a, b) =>
          Number(b.userId === currentUserId) - Number(a.userId === currentUserId) ||
          Number(b.isOwner) - Number(a.isOwner) ||
          a.displayName.localeCompare(b.displayName, 'en-IN'),
      );
      setMembers(list);
    });
    return () => {
      active = false;
    };
  }, [weddingId, currentUserId]);
  return members;
}

function Row({
  member,
  currentUserId,
  control,
}: {
  member: PickableMember;
  currentUserId: string;
  control: React.ReactNode;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-container-low">
      {control}
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-champagne/30 bg-[#faf5ee] text-label-sm text-[#7a5e2e]"
      >
        {initialsOf(member.displayName)}
      </span>
      <span className="min-w-0 flex-1 truncate text-body-md text-navy">
        {member.displayName}
        {member.userId === currentUserId && ` (${pickerCopy.me})`}
        {member.former && ` (${pickerCopy.former})`}
      </span>
      {member.isOwner && (
        <span className="rounded-full border border-hairline px-2 py-0.5 text-label-sm text-navy">
          {pickerCopy.owner}
        </span>
      )}
    </label>
  );
}

/** Several members, e.g. task assignees; each at most once (0026 #13). */
export function MultiMemberPicker({
  name,
  members,
  currentUserId,
  selected,
  onChange,
  disabled,
}: {
  name: string;
  members: PickableMember[];
  currentUserId: string;
  selected: string[];
  onChange: (userIds: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="max-h-64 divide-y divide-hairline overflow-y-auto rounded-lg border border-outline-variant/70 bg-white">
        {members.map((member) => (
          <Row
            key={member.userId}
            member={member}
            currentUserId={currentUserId}
            control={
              <input
                type="checkbox"
                name={name}
                className="size-5 accent-navy"
                checked={selected.includes(member.userId)}
                disabled={disabled || (member.former && !selected.includes(member.userId))}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, member.userId]
                      : selected.filter((id) => id !== member.userId),
                  )
                }
              />
            }
          />
        ))}
      </div>
      <p className="mt-1.5 text-body-sm text-on-surface-variant">{pickerCopy.helper}</p>
    </div>
  );
}
