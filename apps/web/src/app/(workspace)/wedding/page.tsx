import type { Metadata } from 'next';
import { WeddingDetailsPageContent } from '@/features/weddings/components/wedding-pages';

export const metadata: Metadata = { title: 'Wedding details' };

export default function WeddingDetailsPage() {
  return <WeddingDetailsPageContent />;
}
