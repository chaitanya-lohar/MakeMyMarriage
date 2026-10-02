import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';

export const metadata: Metadata = {
  title: 'Reset password',
  robots: { index: false },
  // The URL carries a one-time token; never leak it to other sites.
  referrer: 'no-referrer',
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={typeof token === 'string' && token ? token : undefined} />;
}
