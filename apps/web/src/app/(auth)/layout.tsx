import type { ReactNode } from 'react';
import { LogoLink } from '@/components/ui/logo';

/** Shell for authentication pages. The pages themselves are built in the Auth phase. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-outline-variant/30 bg-surface">
        <div className="mx-auto flex h-20 max-w-7xl items-center px-4 sm:px-6 md:px-12">
          <LogoLink className="h-9 w-auto sm:h-10" />
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
