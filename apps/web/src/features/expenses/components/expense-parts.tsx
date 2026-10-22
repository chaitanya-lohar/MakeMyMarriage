'use client';

import Link from 'next/link';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { EXPENSES_PATH } from '@/features/workspace/components/shell-parts';
import { expenseNotAvailable, expensesPage, paymentStatusLabels } from '../content';
import type { PaymentStatus } from '../expense-model';
import { formatRupees } from '../money';

/** The calculated status: Pending champagne, Partially paid navy outline, Paid sage (0029). */
export function StatusTag({ status }: { status: PaymentStatus }) {
  if (status === 'PARTIALLY_PAID') {
    return (
      <span className="inline-flex items-center rounded-full border border-navy px-2.5 py-0.5 text-label-sm font-semibold whitespace-nowrap text-navy">
        {paymentStatusLabels[status]}
      </span>
    );
  }
  return (
    <Chip tone={status === 'PAID' ? 'sage' : 'champagne'} className="text-label-sm">
      {paymentStatusLabels[status]}
    </Chip>
  );
}

/** Total, Paid and Pending as three plain figures (Stitch "P8 · E1", "E4", "E7"). */
export function MoneyFigures({
  figures,
  caption,
  size = 'lg',
}: {
  figures: { label: string; minor: number; tone?: 'pending' }[];
  caption?: string;
  size?: 'lg' | 'md';
}) {
  // Amounts never break inside a number; they get smaller on narrow screens instead.
  const value =
    size === 'lg'
      ? 'font-serif text-title-lg sm:text-headline-sm lg:text-headline-md'
      : 'font-sans text-body-md font-semibold';
  return (
    <div>
      <dl className="grid grid-cols-3 divide-x divide-hairline">
        {figures.map((figure) => (
          <div key={figure.label} className="min-w-0 px-3 first:pl-0 last:pr-0 sm:px-5">
            <dt className="text-label-sm font-semibold tracking-wide text-on-surface-variant uppercase">
              {figure.label}
            </dt>
            <dd
              className={`mt-1 whitespace-nowrap tabular-nums ${value} ${
                figure.tone === 'pending' ? 'text-secondary' : 'text-navy'
              }`}
            >
              {formatRupees(figure.minor)}
            </dd>
          </div>
        ))}
      </dl>
      {caption && (
        <p className="mt-3 border-t border-hairline pt-2 text-body-sm text-on-surface-variant italic">
          {caption}
        </p>
      )}
    </div>
  );
}

/** The event name, or "Whole wedding". */
export function EventLabel({ eventName }: { eventName: string | null }) {
  return <>{eventName ?? expensesPage.wholeWedding}</>;
}

/** A deleted expense, or one in another wedding (API: 404), as for tasks. */
export function ExpenseNotAvailable() {
  return (
    <section className="mx-auto mt-6 max-w-[520px] rounded-xl border border-hairline bg-white p-8 text-center shadow-sm sm:mt-16 sm:p-10">
      <span className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full border border-champagne/40 bg-[#faf1e4] text-secondary">
        <Icon name="lock" className="size-7" />
      </span>
      <h1 className="mb-3 font-serif text-headline-md text-navy">{expenseNotAvailable.title}</h1>
      <p className="mx-auto mb-7 max-w-[340px] text-body-md text-on-surface-variant">
        {expenseNotAvailable.body}
      </p>
      <Link
        href={EXPENSES_PATH}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-navy px-6 text-label-md text-on-primary transition-colors hover:bg-[#1e293b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      >
        <Icon name="arrow_back" className="size-4" />
        {expenseNotAvailable.back}
      </Link>
    </section>
  );
}
