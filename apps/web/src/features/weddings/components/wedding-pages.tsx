'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DASHBOARD_PATH } from '@/features/workspace/components/shell-parts';
import { NoAccess } from '@/features/workspace/components/workspace-page';
import { usePermissions, useReadyWorkspace } from '@/features/workspace/workspace-context';
import { CreateWeddingForm } from './create-wedding-form';
import { DashboardView } from './dashboard-view';
import { NoWeddingCard } from './no-wedding-card';
import { WeddingDetailsForm } from './wedding-details-form';

/** `/dashboard`: the wedding, or "No wedding yet" (decision 0016). */
export function DashboardPageContent() {
  const { wedding } = useReadyWorkspace();
  return wedding ? <DashboardView wedding={wedding} /> : <NoWeddingCard />;
}

/** `/wedding/new`. */
export function CreateWeddingPageContent() {
  return <CreateWeddingForm />;
}

/** `/wedding`: wedding details, or back to the dashboard while there is no wedding. */
export function WeddingDetailsPageContent() {
  const router = useRouter();
  const { wedding } = useReadyWorkspace();
  const { can } = usePermissions();

  useEffect(() => {
    if (!wedding) router.replace(DASHBOARD_PATH);
  }, [wedding, router]);

  if (!wedding) return null;
  // Editing the wedding needs WEDDING_SETTINGS:EDIT, owner-only by default (Stitch "P10 · M8").
  if (!can('WEDDING_SETTINGS', 'EDIT')) return <NoAccess />;
  return <WeddingDetailsForm key={wedding.id} wedding={wedding} />;
}
