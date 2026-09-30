import type { Metadata } from 'next';
import { PlaceholderPage } from '@/components/layout/placeholder-page';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false },
};

// Route placeholder so marketing links resolve; sign-in is implemented in the Auth phase.
export default function LoginPage() {
  return <PlaceholderPage title="Sign in" />;
}
