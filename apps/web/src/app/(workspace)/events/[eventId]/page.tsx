import type { Metadata } from 'next';
import { EditEventPageContent } from '@/features/events/components/event-pages';

export const metadata: Metadata = { title: 'Edit event' };

export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <EditEventPageContent eventId={eventId} />;
}
