import type { Metadata } from 'next';
import { AuthHeading } from '@/features/auth/components/auth-shell';
import { SignUpForm } from '@/features/auth/components/sign-up-form';
import { signUp } from '@/features/auth/content';

export const metadata: Metadata = { title: 'Create your account' };

export default function SignUpPage() {
  return (
    <>
      <AuthHeading title={signUp.title} subtitle={signUp.subtitle} />
      <SignUpForm />
    </>
  );
}
