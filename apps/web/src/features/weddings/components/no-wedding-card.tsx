'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Banner } from '@/components/ui/form';
import { leftNoticeCopy } from '@/features/partner/content';
import { takeLeftWedding, type LeftWedding } from '@/features/partner/partner-model';
import { CREATE_WEDDING_PATH } from '@/features/workspace/components/shell-parts';
import { useReadyWorkspace } from '@/features/workspace/workspace-context';
import { noWedding } from '../content';

/** Stitch "P3 · S2 No Wedding Yet": the user is never forced into the form (0012, 0016). */
export function NoWeddingCard() {
  const { user, signOut, signingOut } = useReadyWorkspace();
  const firstName = user.displayName.split(/\s+/)[0] ?? '';
  const [left, setLeft] = useState<LeftWedding | null>(null);

  useEffect(() => {
    // Deferred: read once after hydration, then forgotten (Stitch "P16 · M16-06").
    const timeout = window.setTimeout(() => setLeft(takeLeftWedding()));
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <>
      {left && (
        <div className="mx-auto mt-6 max-w-[560px] sm:mt-12">
          <Banner tone="success" icon="check_circle">
            <span className="font-semibold">{leftNoticeCopy.title(left.weddingName)}</span>{' '}
            {leftNoticeCopy.body(left.otherName)}
          </Banner>
        </div>
      )}
      <section className="mx-auto mt-6 max-w-[560px] rounded-xl border border-hairline bg-white p-6 shadow-sm sm:mt-20 sm:p-10">
        <p className="mb-2 text-label-sm text-on-surface-variant uppercase">
          {noWedding.eyebrow.replace('{firstName}', firstName)}
        </p>
        <h1 className="mb-4 font-serif text-headline-md text-navy">{noWedding.title}</h1>
        <p className="mb-8 text-body-md text-on-surface-variant">{noWedding.body}</p>
        <div className="space-y-3">
          <Link
            href={CREATE_WEDDING_PATH}
            className="flex min-h-12 w-full items-center justify-center rounded-lg bg-navy px-6 text-title-md text-on-primary shadow-sm transition-colors hover:bg-[#1e293b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          >
            {noWedding.create}
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            className="flex min-h-12 w-full items-center justify-center rounded-lg border border-champagne bg-white px-6 text-label-md text-navy transition-colors hover:bg-ivory focus-visible:outline-2 focus-visible:outline-secondary disabled:cursor-wait"
          >
            {noWedding.signOut}
          </button>
        </div>
      </section>
    </>
  );
}
