'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PrimaryButton } from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { partnerInvitationPageCopy as copy } from '../content';
import { takePartnerWelcome, type PartnerWelcome } from '../partner-model';

/**
 * Connection success (Stitch "P16 · M16-04"), inside the workspace, shown once right after
 * accepting a partner invitation. Opened any other way, it goes to the dashboard.
 */
export function PartnerWelcomeContent() {
  const router = useRouter();
  const [welcome, setWelcome] = useState<PartnerWelcome | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const value = takePartnerWelcome();
      if (value) setWelcome(value);
      else router.replace('/dashboard');
    });
    return () => window.clearTimeout(timeout);
  }, [router]);

  if (!welcome) return null;
  return (
    <section className="mx-auto mt-6 max-w-[560px] rounded-xl border border-hairline bg-white p-6 text-center shadow-sm sm:mt-20 sm:p-10">
      <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[#edf2ee] text-[#2a4a36]">
        <Icon name="favorite" className="size-6" />
      </span>
      <h1 className="font-serif text-headline-md text-navy">
        {copy.successTitle(welcome.weddingName)}
      </h1>
      <p className="mt-3 text-body-md text-on-surface-variant">
        {copy.successBody(welcome.inviterName)}
      </p>
      <PrimaryButton className="mt-8" onClick={() => router.push('/dashboard')}>
        {copy.goToDashboard}
      </PrimaryButton>
    </section>
  );
}
