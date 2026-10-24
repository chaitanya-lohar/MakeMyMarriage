'use client';

import { RequireWedding } from '@/features/workspace/components/workspace-page';
import { AddEventPage, EditEventPage } from './event-form';
import { EventsList } from './events-list';
import { EventVendorBookingShortcut } from '@/features/vendors/components/vendor-pages';

/** `/events` */
export function EventsPageContent() {
  return <RequireWedding>{(wedding) => <EventsList wedding={wedding} />}</RequireWedding>;
}

/** `/events/new` */
export function NewEventPageContent() {
  return <RequireWedding>{(wedding) => <AddEventPage wedding={wedding} />}</RequireWedding>;
}

/** `/events/[eventId]` */
export function EditEventPageContent({ eventId }: { eventId: string }) {
  return (
    <RequireWedding>
      {(wedding) => (
        <>
          <EventVendorBookingShortcut wedding={wedding} eventId={eventId} />
          <EditEventPage key={eventId} wedding={wedding} eventId={eventId} />
        </>
      )}
    </RequireWedding>
  );
}
