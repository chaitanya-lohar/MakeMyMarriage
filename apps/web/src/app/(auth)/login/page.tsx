import type { Metadata } from 'next';
import { AuthHeading } from '@/features/auth/components/auth-shell';
import { SignInForm, type SignInNotice } from '@/features/auth/components/sign-in-form';
import { signIn } from '@/features/auth/content';

export const metadata: Metadata = { title: 'Sign in' };

const notices: Record<string, SignInNotice> = {
  'reset=success': 'password-updated',
  'session=ended': 'session-ended',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const notice =
    notices[`reset=${String(params.reset)}`] ?? notices[`session=${String(params.session)}`];
  return (
    <>
      <AuthHeading title={signIn.title} subtitle={signIn.subtitle} />
      <SignInForm notice={notice} />
    </>
  );
}
