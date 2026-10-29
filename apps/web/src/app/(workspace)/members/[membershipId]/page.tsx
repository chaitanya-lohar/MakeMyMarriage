import type { Metadata } from 'next';
import { MemberPageContent } from '@/features/members/components/member-detail';

export const metadata: Metadata = { title: 'Member' };

export default async function MemberPage({
  params,
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const { membershipId } = await params;
  return <MemberPageContent membershipId={membershipId} />;
}
