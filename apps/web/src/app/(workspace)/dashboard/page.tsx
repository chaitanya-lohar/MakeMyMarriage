import type { Metadata } from 'next';
import { SignedInView } from '@/features/auth/components/signed-in-view';

export const metadata: Metadata = { title: 'Your wedding', robots: { index: false } };

// Phase 2 landing page; replaced by the wedding dashboard in the Weddings phase.
export default function DashboardPage() {
  return <SignedInView />;
}
