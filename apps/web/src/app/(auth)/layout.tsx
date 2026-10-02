import type { ReactNode } from 'react';
import { AuthShell } from '@/features/auth/components/auth-shell';

/** Split auth layout (Stitch "Sign In (V1)" family, decision 0015). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
