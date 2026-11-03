import type { Metadata } from 'next';
import { PartnerWelcomeContent } from '@/features/partner/components/partner-welcome';

export const metadata: Metadata = { title: 'Welcome' };

/** Connection success after accepting a partner invitation (Stitch "P16 · M16-04"). */
export default function PartnerWelcomePage() {
  return <PartnerWelcomeContent />;
}
