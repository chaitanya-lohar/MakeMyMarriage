import type { Metadata } from 'next';
import { InvitationPage } from '@/features/invitation/components/invitation-page';

// A private link: never indexed, and the link is not sent on to other sites.
export const metadata: Metadata = {
  title: 'Your invitation',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/** A guest's private invitation (decisions 0007 and 0017): no account needed. */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InvitationPage token={token} />;
}
