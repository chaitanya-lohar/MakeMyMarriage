import type { Metadata } from 'next';
import { EditGuestPageContent } from '@/features/guests/components/guest-pages';

export const metadata: Metadata = { title: 'Edit guest' };

export default async function EditGuestPage({ params }: { params: Promise<{ guestId: string }> }) {
  const { guestId } = await params;
  return <EditGuestPageContent guestId={guestId} />;
}
