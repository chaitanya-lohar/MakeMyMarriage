'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DASHBOARD_PATH } from '@/features/workspace/components/shell-parts';
import { useReadyWorkspace } from '@/features/workspace/workspace-context';
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

  useEffect(() => {
    if (!wedding) router.replace(DASHBOARD_PATH);
  }, [wedding, router]);

  return wedding ? <WeddingDetailsForm key={wedding.id} wedding={wedding} /> : null;
}
