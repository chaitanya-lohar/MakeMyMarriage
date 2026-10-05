'use client';

import type { ReactNode } from 'react';
import type { ApiUser } from '@/lib/api';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import { loadError, loading } from '../content';
import { useWorkspace } from '../workspace-context';
import { MobileNav } from './mobile-nav';
import { NavLinks, WeddingName, WorkspaceFooter, WorkspaceLogo } from './shell-parts';
import { UserMenu } from './user-menu';

/**
 * The signed-in workspace layout (decision 0016): a 264px sidebar from 1024px up, a header
 * with a drawer below it. Before a wedding exists the sidebar shows only the logo and the
 * user. Pages render once the user and wedding have loaded.
 */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { state, reload } = useWorkspace();
  if (state.status === 'loading') return <LoadingShell />;

  const user = state.status === 'ready' ? state.user : undefined;
  const wedding = state.status === 'ready' ? state.wedding : null;

  return (
    <div className="flex min-h-screen bg-ivory text-navy">
      <Sidebar user={user} wedding={wedding} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav user={user} wedding={wedding} />
        <main className="mx-auto w-full max-w-[960px] flex-1 px-4 pt-5 pb-10 sm:px-8 lg:py-10">
          {state.status === 'ready' ? children : <LoadError onRetry={reload} />}
        </main>
        <WorkspaceFooter />
      </div>
    </div>
  );
}

function Sidebar({ user, wedding }: { user?: ApiUser; wedding: ApiWedding | null }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col justify-between border-r border-hairline bg-ivory lg:flex">
      <div>
        <div className="flex h-20 items-center border-b border-hairline/70 px-5">
          <WorkspaceLogo className="h-12 w-auto" />
        </div>
        {wedding && (
          <>
            <div className="mt-4 border-b border-hairline/70 px-6 pb-4">
              <WeddingName name={wedding.displayName} className="text-base" />
            </div>
            <div className="mt-6 px-3">
              <NavLinks />
            </div>
          </>
        )}
      </div>
      {user && <UserMenu user={user} />}
    </aside>
  );
}

/** Stitch "P3 · S1 Workspace Shell — Loading". */
function LoadingShell() {
  const bar = 'animate-pulse rounded bg-[#efece6]';
  return (
    <div className="flex min-h-screen bg-ivory" aria-busy="true">
      <span className="sr-only" role="status">
        {loading.label}
      </span>
      <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col justify-between border-r border-hairline px-6 py-6 lg:flex">
        <div className="flex flex-col gap-9">
          <WorkspaceLogo />
          <div className="space-y-2">
            <div className={`h-6 w-[180px] ${bar}`} />
            <div className={`h-3 w-[100px] ${bar}`} />
          </div>
          <div className="space-y-4">
            <div className={`h-4 w-[150px] ${bar}`} />
            <div className={`h-4 w-[150px] ${bar}`} />
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-hairline pt-6">
          <div className={`size-9 rounded-full ${bar}`} />
          <div className="space-y-1.5">
            <div className={`h-3 w-24 ${bar}`} />
            <div className={`h-2.5 w-32 ${bar}`} />
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center border-b border-hairline px-4 lg:hidden">
          <WorkspaceLogo />
        </header>
        <div className="mx-auto w-full max-w-[960px] flex-1 space-y-6 px-4 pt-5 sm:px-8 lg:py-10">
          <div className="space-y-3 pb-6">
            <div className={`h-3 w-[100px] ${bar}`} />
            <div className={`h-9 w-full max-w-[380px] ${bar}`} />
            <div className={`h-4 w-full max-w-[260px] ${bar}`} />
          </div>
          <div className="h-48 animate-pulse rounded-xl border border-hairline bg-white" />
          <div className="h-64 animate-pulse rounded-xl border border-hairline bg-white" />
        </div>
      </div>
    </div>
  );
}

/** Loading failed (Stitch "P3 · S5", couldn't-load state). */
function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      role="alert"
      className="mx-auto mt-10 max-w-[480px] rounded-xl border border-hairline bg-white p-8 text-center shadow-sm"
    >
      <h1 className="mb-2 font-serif text-headline-sm text-navy">{loadError.title}</h1>
      <p className="mb-6 text-body-sm text-on-surface-variant">{loadError.body}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-navy px-6 text-label-md text-on-primary transition-colors hover:bg-[#1e293b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      >
        {loadError.retry}
      </button>
    </section>
  );
}
