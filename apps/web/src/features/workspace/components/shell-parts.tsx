'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { legalLinks } from '@/components/layout/site-links';
import { Icon, type IconName } from '@/components/ui/icon';
import { Logo } from '@/components/ui/logo';
import type { ApiUser } from '@/lib/api';
import { workspaceFooter, workspaceNav } from '../content';

export const DASHBOARD_PATH = '/dashboard';
export const CREATE_WEDDING_PATH = '/wedding/new';
export const WEDDING_DETAILS_PATH = '/wedding';

/** The workspace navigation: only Dashboard and Wedding details in Phase 3 (0016). */
const navItems: { href: string; label: string; icon: IconName }[] = [
  { href: DASHBOARD_PATH, label: workspaceNav.dashboard, icon: 'space_dashboard' },
  { href: WEDDING_DETAILS_PATH, label: workspaceNav.weddingDetails, icon: 'edit_note' },
];

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** The approved logo, linking to the home page as elsewhere on the site (approved 2026-10-07). */
export function WorkspaceLogo({ className = 'h-10 w-auto' }: { className?: string }) {
  return (
    <Link
      href="/"
      className="flex items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary"
    >
      <Logo className={className} />
    </Link>
  );
}

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Workspace" className="space-y-1">
      {navItems.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-label-md transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-secondary ${
              active
                ? 'bg-[#f4efe6] font-semibold text-navy'
                : 'font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-navy'
            }`}
          >
            {active && (
              <span
                aria-hidden="true"
                className="absolute top-1.5 bottom-1.5 left-0 w-1 rounded-r-full bg-champagne"
              />
            )}
            <Icon name={item.icon} className="size-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** The couple's name, at most two lines and then an ellipsis (0016). */
export function WeddingName({ name, className = '' }: { name: string; className?: string }) {
  return (
    <p className={`line-clamp-2 font-serif leading-snug text-navy ${className}`} title={name}>
      {name}
    </p>
  );
}

export function UserAvatar({ user, size = 'size-10' }: { user: ApiUser; size?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`${size} flex shrink-0 items-center justify-center rounded-full border border-champagne/30 bg-[#faf5ee] text-title-md text-[#7a5e2e]`}
    >
      {initialsOf(user.displayName)}
    </span>
  );
}

export function UserSummary({ user }: { user: ApiUser }) {
  return (
    <span className="min-w-0 flex-1 text-left">
      <span className="block truncate text-sm font-medium text-navy">{user.displayName}</span>
      <span className="block truncate text-xs text-on-surface-variant">{user.email}</span>
    </span>
  );
}

export function WorkspaceFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-[960px] flex-col items-center justify-between gap-2 border-t border-hairline px-4 pt-6 pb-6 text-xs text-on-surface-variant sm:flex-row sm:px-8">
      <p>{workspaceFooter.copyright}</p>
      <div className="flex items-center gap-2">
        {legalLinks.map((link, index) => (
          <span key={link.href} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden="true">·</span>}
            <Link
              href={link.href}
              className="inline-flex min-h-11 items-center px-1 transition-colors hover:text-navy focus-visible:outline-2 focus-visible:outline-secondary"
            >
              {link.label}
            </Link>
          </span>
        ))}
      </div>
    </footer>
  );
}
