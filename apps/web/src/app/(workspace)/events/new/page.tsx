import type { Metadata } from 'next';
import { NewEventPageContent } from '@/features/events/components/event-pages';

export const metadata: Metadata = { title: 'Add event' };

export default function NewEventPage() {
  return <NewEventPageContent />;
}
