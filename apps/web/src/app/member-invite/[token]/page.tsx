import type { Metadata } from 'next';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { MemberInvitationPage } from '@/features/members/components/member-invitation-page';

// A private, single-use link: never indexed, and not sent on to other sites.
export const metadata: Metadata = {
  title: 'Your invitation',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/** An organizer invitation (Stitch "P10 · M7", decision 0034), opened from its email. */
export default async function MemberInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <AuthShell>
      <MemberInvitationPage token={token} />
    </AuthShell>
  );
}
