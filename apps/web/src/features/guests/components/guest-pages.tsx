'use client';

import { RequireWedding } from '@/features/workspace/components/workspace-page';
import { GuestDetail } from './guest-detail';
import { AddGuestPage, EditGuestPage } from './guest-form';
import { GuestsList } from './guests-list';

/** `/guests` */
export function GuestsPageContent() {
  return (
    <RequireWedding permission={['GUESTS', 'VIEW']}>
      {(wedding) => <GuestsList wedding={wedding} />}
    </RequireWedding>
  );
}

/** `/guests/new` */
export function NewGuestPageContent() {
  return (
    <RequireWedding permission={['GUESTS', 'CREATE']}>
      {(wedding) => <AddGuestPage wedding={wedding} />}
    </RequireWedding>
  );
}

/** `/guests/[guestId]` */
export function GuestDetailPageContent({ guestId }: { guestId: string }) {
  return (
    <RequireWedding permission={['GUESTS', 'VIEW']}>
      {(wedding) => <GuestDetail key={guestId} wedding={wedding} guestId={guestId} />}
    </RequireWedding>
  );
}

/** `/guests/[guestId]/edit` */
export function EditGuestPageContent({ guestId }: { guestId: string }) {
  return (
    <RequireWedding permission={['GUESTS', 'EDIT']}>
      {(wedding) => <EditGuestPage key={guestId} wedding={wedding} guestId={guestId} />}
    </RequireWedding>
  );
}
