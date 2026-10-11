import type { Metadata } from 'next';
import { NewGuestPageContent } from '@/features/guests/components/guest-pages';

export const metadata: Metadata = { title: 'Add guest' };

export default function NewGuestPage() {
  return <NewGuestPageContent />;
}
