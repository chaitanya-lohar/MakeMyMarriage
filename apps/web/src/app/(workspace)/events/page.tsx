import type { Metadata } from 'next';
import { EventsPageContent } from '@/features/events/components/event-pages';

export const metadata: Metadata = { title: 'Events' };

export default function EventsPage() {
  return <EventsPageContent />;
}
