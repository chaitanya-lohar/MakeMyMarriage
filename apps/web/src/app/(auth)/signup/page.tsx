import type { Metadata } from 'next';
import { AuthHeading } from '@/features/auth/components/auth-shell';
import { SignUpForm } from '@/features/auth/components/sign-up-form';
import { SignedInRedirect } from '@/features/auth/components/signed-in-redirect';
import { signUp } from '@/features/auth/content';
import { nextPath } from '@/features/auth/next-path';

export const metadata: Metadata = { title: 'Create your account' };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = nextPath((await searchParams).next);
  return (
    <>
      <AuthHeading title={signUp.title} subtitle={signUp.subtitle} />
      <SignUpForm next={next} />
      <SignedInRedirect next={next} />
    </>
  );
}
