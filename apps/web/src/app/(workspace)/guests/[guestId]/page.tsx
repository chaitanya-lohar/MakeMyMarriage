import type { Metadata } from 'next';
import { GuestDetailPageContent } from '@/features/guests/components/guest-pages';

export const metadata: Metadata = { title: 'Guest' };

export default async function GuestPage({ params }: { params: Promise<{ guestId: string }> }) {
  const { guestId } = await params;
  return <GuestDetailPageContent guestId={guestId} />;
}
