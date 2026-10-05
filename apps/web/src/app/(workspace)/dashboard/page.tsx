import type { Metadata } from 'next';
import { DashboardPageContent } from '@/features/weddings/components/wedding-pages';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return <DashboardPageContent />;
}
