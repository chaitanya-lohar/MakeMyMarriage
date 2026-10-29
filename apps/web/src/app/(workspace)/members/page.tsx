import type { Metadata } from 'next';
import { MembersPageContent } from '@/features/members/components/members-page';

export const metadata: Metadata = { title: 'Members' };

export default function MembersPage() {
  return <MembersPageContent />;
}
