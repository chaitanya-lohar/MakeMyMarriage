import type { Metadata } from 'next';
import { PlaceholderPage } from '@/components/layout/placeholder-page';

export const metadata: Metadata = {
  title: 'Create your wedding',
  robots: { index: false },
};

// Route placeholder so marketing links resolve; sign-up is implemented in the Auth phase.
export default function SignUpPage() {
  return <PlaceholderPage title="Create your wedding" />;
}
