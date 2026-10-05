import type { Metadata } from 'next';
import { AuthHeading } from '@/features/auth/components/auth-shell';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';
import { SignedInRedirect } from '@/features/auth/components/signed-in-redirect';
import { forgotPassword } from '@/features/auth/content';

export const metadata: Metadata = { title: 'Forgot password', robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading
        icon="lock_reset"
        title={forgotPassword.title}
        subtitle={forgotPassword.subtitle}
      />
      <ForgotPasswordForm />
      <SignedInRedirect />
    </>
  );
}
