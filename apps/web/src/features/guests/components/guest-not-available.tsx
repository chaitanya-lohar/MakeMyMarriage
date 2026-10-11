import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { GUESTS_PATH } from '@/features/workspace/components/shell-parts';
import { guestNotAvailable } from '../content';

/** The guest is gone or belongs to another wedding (as Stitch "P4 · O4" for events). */
export function GuestNotAvailable() {
  return (
    <section className="mx-auto mt-6 max-w-[520px] rounded-xl border border-hairline bg-white p-8 text-center shadow-sm sm:mt-16 sm:p-10">
      <span className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full border border-champagne/40 bg-[#faf1e4] text-secondary">
        <Icon name="lock" className="size-7" />
      </span>
      <h1 className="mb-3 font-serif text-headline-md text-navy">{guestNotAvailable.title}</h1>
      <p className="mx-auto mb-7 max-w-[340px] text-body-md text-on-surface-variant">
        {guestNotAvailable.body}
      </p>
      <Link
        href={GUESTS_PATH}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-navy px-6 text-label-md text-on-primary transition-colors hover:bg-[#1e293b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      >
        <Icon name="arrow_back" className="size-4" />
        {guestNotAvailable.back}
      </Link>
    </section>
  );
}
