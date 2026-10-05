'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import type { ApiUser } from '@/lib/api';
import { workspaceNav } from '../content';
import { useWorkspace } from '../workspace-context';
import { UserAvatar, UserSummary } from './shell-parts';

/** The sidebar's user block; it opens a menu with Sign out (Stitch "Desktop User Menu"). */
export function UserMenu({ user }: { user: ApiUser }) {
  const { signOut, signingOut } = useWorkspace();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={container} className="relative m-3 mb-6">
      {open && (
        <div
          id={menuId}
          className="absolute right-0 bottom-full left-0 mb-2 rounded-xl border border-hairline bg-white p-2 shadow-lg"
        >
          <div className="flex items-center gap-3 border-b border-hairline px-2 pt-1 pb-3">
            <UserAvatar user={user} size="size-9" />
            <UserSummary user={user} />
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-navy focus-visible:outline-2 focus-visible:outline-secondary disabled:cursor-wait"
          >
            <Icon name="logout" className="size-5" />
            {signingOut ? workspaceNav.signingOut : workspaceNav.signOut}
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${workspaceNav.accountMenu}: ${user.displayName}`}
        className="flex w-full items-center gap-3 rounded-xl border border-hairline bg-white/70 p-4 shadow-sm transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-secondary"
      >
        <UserAvatar user={user} />
        <UserSummary user={user} />
      </button>
    </div>
  );
}
