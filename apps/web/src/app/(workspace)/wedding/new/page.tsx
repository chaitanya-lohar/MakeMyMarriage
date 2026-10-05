import type { Metadata } from 'next';
import { CreateWeddingPageContent } from '@/features/weddings/components/wedding-pages';

export const metadata: Metadata = { title: 'Create your wedding' };

export default function CreateWeddingPage() {
  return <CreateWeddingPageContent />;
}
