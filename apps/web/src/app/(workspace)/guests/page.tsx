import type { Metadata } from 'next';
import { GuestsPageContent } from '@/features/guests/components/guest-pages';

export const metadata: Metadata = { title: 'Guests & RSVP' };

export default function GuestsPage() {
  return <GuestsPageContent />;
}
