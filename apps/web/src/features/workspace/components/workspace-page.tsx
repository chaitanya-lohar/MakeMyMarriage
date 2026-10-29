'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import type { ApiWedding } from '@/features/weddings/wedding-form-model';
import { accessStates } from '../content';
import { usePermissions, useReadyWorkspace, type WorkspaceNotice } from '../workspace-context';
import { DASHBOARD_PATH } from './shell-parts';

/**
 * Renders a page that needs the user's wedding; without one it returns to the dashboard,
 * which offers to create it (decision 0016). With `permission`, a member who lacks it sees
 * the no-access page instead (Stitch "P10 · M8"); the server refuses the requests anyway.
 */
export function RequireWedding({
  children,
  permission,
}: {
  children: (wedding: ApiWedding) => ReactNode;
  permission?: [module: string, action: string];
}) {
  const router = useRouter();
  const { wedding } = useReadyWorkspace();
  const { can } = usePermissions();
  useEffect(() => {
    if (!wedding) router.replace(DASHBOARD_PATH);
  }, [wedding, router]);
  if (!wedding) return null;
  if (permission && !can(...permission)) return <NoAccess />;
  return children(wedding);
}

/** Shows `children` only when the member holds the permission (Stitch "P10 · M8"). */
export function Can({
  module,
  action,
  children,
}: {
  module: string;
  action: string;
  children: ReactNode;
}) {
  const { can } = usePermissions();
  return can(module, action) ? children : null;
}

/** "You don't have access to this section" inside the workspace (Stitch "P10 · M8"). */
export function NoAccess() {
  return (
    <section
      role="alert"
      className="mx-auto mt-6 max-w-[480px] rounded-xl border border-hairline bg-white p-8 text-center shadow-sm"
    >
      <h1 className="mb-2 font-serif text-headline-sm text-navy">{accessStates.noAccessTitle}</h1>
      <p className="mb-6 text-body-sm text-on-surface-variant">{accessStates.noAccessBody}</p>
      <Link
        href={DASHBOARD_PATH}
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-navy px-6 text-label-md text-on-primary"
      >
        {accessStates.goToDashboard}
      </Link>
    </section>
  );
}

/** A workspace page heading with an optional back link and actions. */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 border-b border-hairline pb-6 sm:mb-8">
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg text-label-md text-on-surface-variant transition-colors hover:text-navy focus-visible:outline-2 focus-visible:outline-secondary"
        >
          <Icon name="arrow_back" className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-serif text-headline-md font-normal break-words text-navy sm:text-headline-lg sm:font-normal">
            {title}
          </h1>
          {subtitle && <div className="mt-1 text-body-md text-on-surface-variant">{subtitle}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-col gap-3 sm:flex-row">{actions}</div>}
      </div>
    </header>
  );
}

/** Shows a one-off workspace notice once, then clears it so a later visit does not repeat it. */
export function useOneOffNotice(expected: Exclude<WorkspaceNotice, null>): [boolean, () => void] {
  const { notice, setNotice } = useReadyWorkspace();
  const [show, setShow] = useState(() => notice === expected);
  useEffect(() => {
    if (notice === expected) setNotice(null);
  }, [notice, expected, setNotice]);
  return [show, () => setShow(false)];
}

/** The navy primary action rendered as a link. */
export function PrimaryLink({
  href,
  children,
  icon = 'add',
}: {
  href: string;
  children: ReactNode;
  icon?: 'add' | 'edit';
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-navy px-5 text-label-md text-on-primary shadow-sm transition-colors hover:bg-[#1e293b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
    >
      <Icon name={icon} className="size-5" />
      {children}
    </Link>
  );
}

/** A skeleton block for loading states. */
export function SkeletonCard({ className = 'h-24' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl border border-hairline bg-white ${className}`} />
  );
}
