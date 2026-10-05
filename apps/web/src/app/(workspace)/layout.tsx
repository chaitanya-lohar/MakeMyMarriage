import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { WorkspaceShell } from '@/features/workspace/components/workspace-shell';
import { WorkspaceProvider } from '@/features/workspace/workspace-context';

export const metadata: Metadata = { robots: { index: false } };

/** The signed-in wedding workspace (decisions 0007 and 0016). */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <WorkspaceShell>{children}</WorkspaceShell>
    </WorkspaceProvider>
  );
}
