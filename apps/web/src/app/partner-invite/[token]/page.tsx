import type { Metadata } from 'next';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { PartnerInvitationPage } from '@/features/partner/components/partner-invitation-page';

// A private, single-use link: never indexed, and not sent on to other sites.
export const metadata: Metadata = {
  title: 'Your invitation',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/** A partner invitation (Stitch "P16 · M16-03", decision 0038), opened from its email. */
export default async function PartnerInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <AuthShell>
      <PartnerInvitationPage token={token} />
    </AuthShell>
  );
}
