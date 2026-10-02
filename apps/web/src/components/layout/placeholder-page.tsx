import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Minimal page for a route that exists before its feature does: /signup and /login until
 * the Auth phase, /privacy and /terms until their legal text is provided (decision 0014).
 */
export function PlaceholderPage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
      <h1 className="font-serif text-headline-lg-mobile text-on-surface md:text-headline-lg">
        {title}
      </h1>
      {children && <div className="mt-4 text-body-md text-on-surface-variant">{children}</div>}
      <Link
        href="/"
        className="mt-8 text-label-md text-secondary underline-offset-4 transition-colors hover:underline"
      >
        Back to home
      </Link>
    </div>
  );
}
