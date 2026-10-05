'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import type { ApiUser } from '@/lib/api';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import { workspaceNav } from '../content';
import { useWorkspace } from '../workspace-context';
import { NavLinks, UserAvatar, UserSummary, WeddingName, WorkspaceLogo } from './shell-parts';

/**
 * The workspace header below 1024px, with a drawer that holds the navigation and the user
 * (Stitch "Mobile Navigation Drawer — Before/After Wedding").
 */
export function MobileNav({ user, wedding }: { user?: ApiUser; wedding?: ApiWedding | null }) {
  const { signOut, signingOut } = useWorkspace();
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-hairline bg-ivory/90 px-4 backdrop-blur-md lg:hidden">
        <WorkspaceLogo />
        {user && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={workspaceNav.openMenu}
            aria-expanded={open}
            className="flex size-11 items-center justify-center rounded-lg text-navy transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-secondary"
          >
            <Icon name="menu" className="size-6" />
          </button>
        )}
      </header>

      {open && user && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={workspaceNav.menu}
            className="absolute top-0 right-0 bottom-0 flex w-4/5 max-w-[320px] flex-col justify-between overflow-y-auto border-l border-hairline bg-ivory p-6 shadow-2xl"
          >
            <div>
              <div className="mb-6 flex justify-end">
                <button
                  ref={closeButton}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={workspaceNav.closeMenu}
                  className="flex size-11 items-center justify-center rounded-lg text-navy transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-secondary"
                >
                  <Icon name="close" className="size-6" />
                </button>
              </div>
              {wedding && (
                <>
                  <div className="mb-6 border-b border-hairline pb-5">
                    <p className="mb-1 flex items-center gap-1.5 text-label-sm text-secondary uppercase">
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-champagne" />
                      {workspaceNav.yourWedding}
                    </p>
                    <WeddingName name={wedding.displayName} className="text-headline-sm" />
                  </div>
                  <NavLinks onNavigate={() => setOpen(false)} />
                </>
              )}
            </div>
            <div className="mt-8 border-t border-hairline pt-5">
              <div className="mb-4 flex items-center gap-3">
                <UserAvatar user={user} />
                <UserSummary user={user} />
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={signingOut}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-champagne bg-white px-4 text-sm font-medium text-navy transition-colors hover:bg-ivory focus-visible:outline-2 focus-visible:outline-secondary disabled:cursor-wait"
              >
                <Icon name="logout" className="size-5 text-champagne" />
                {signingOut ? workspaceNav.signingOut : workspaceNav.signOut}
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
