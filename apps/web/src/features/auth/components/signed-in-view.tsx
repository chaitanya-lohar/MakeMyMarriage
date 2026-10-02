'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { legalLinks } from '@/components/layout/site-links';
import { LogoLink } from '@/components/ui/logo';
import { api, call, type ApiUser } from '@/lib/api';
import { authFooter, signedIn } from '../content';

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Stitch "Signed In (Phase 2 placeholder)": the landing page after sign-in or sign-up,
 * until the Weddings phase replaces it (decision 0015).
 */
export function SignedInView() {
  const router = useRouter();
  const [user, setUser] = useState<ApiUser>();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    void call(() => api.GET('/api/v1/me')).then((result) => {
      if (!active) return;
      if (result.data) setUser(result.data.user);
      // Not signed in, or the session could not be refreshed.
      else if (result.error.status === 401) router.replace('/login?session=ended');
    });
    return () => {
      active = false;
    };
  }, [router]);

  async function signOut() {
    setSigningOut(true);
    await call(() => api.POST('/api/v1/auth/logout'));
    router.replace('/login');
  }

  const firstName = user?.displayName.split(/\s+/)[0] ?? '';

  return (
    <div className="flex min-h-screen flex-col justify-between bg-ivory text-navy">
      <header className="w-full border-b border-hairline/80 bg-ivory px-6 py-4 sm:px-12">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <LogoLink className="h-8 w-auto md:h-9" />
          {user && (
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="flex size-8 items-center justify-center rounded-full border border-[#e2d4bf] bg-[#f5ede2] text-xs font-semibold tracking-wider text-navy"
                >
                  {initialsOf(user.displayName)}
                </span>
                <span className="hidden text-sm font-medium text-navy sm:inline-block">
                  {user.displayName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={signingOut}
                className="rounded-lg border border-champagne bg-white px-4 py-2 text-xs font-medium text-navy transition-colors duration-150 hover:border-[#b5966b] hover:bg-ivory focus-visible:outline-2 focus-visible:outline-champagne disabled:cursor-wait sm:text-sm"
              >
                {signingOut ? signedIn.signingOut : signedIn.signOut}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6 md:py-24">
        <div className="w-full max-w-[560px]" aria-busy={!user}>
          {user && (
            <div className="relative overflow-hidden rounded-lg border border-hairline bg-white p-8 text-center shadow-[0_4px_24px_rgba(10,17,40,0.03)] sm:p-12">
              <p className="mb-4 text-[11px] font-semibold tracking-[0.2em] text-champagne uppercase sm:text-xs">
                {signedIn.eyebrow}
              </p>
              <h1 className="mb-5 font-serif text-3xl leading-snug font-normal tracking-tight text-navy sm:text-4xl">
                {signedIn.greeting}, {firstName}
              </h1>
              <p className="mx-auto mb-8 max-w-[440px] text-sm leading-relaxed text-on-surface-variant sm:text-base">
                {signedIn.body}
              </p>
              <div className="mx-auto mb-6 h-px w-12 bg-hairline" />
              <p className="text-xs text-on-surface-variant sm:text-sm">
                {signedIn.signedInAs} <span className="font-medium text-navy">{user.email}</span>
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="w-full border-t border-hairline/80 bg-ivory px-6 py-6 sm:px-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-on-surface-variant sm:flex-row">
          <p>{authFooter.copyright}</p>
          <div className="flex items-center gap-6">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors duration-150 hover:text-navy"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
