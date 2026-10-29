'use client';

import { Can, RequireWedding } from '@/features/workspace/components/workspace-page';
import { AddEventPage, EditEventPage } from './event-form';
import { EventsList } from './events-list';
import { EventVendorBookingShortcut } from '@/features/vendors/components/vendor-pages';

/** `/events` */
export function EventsPageContent() {
  return (
    <RequireWedding permission={['EVENTS', 'VIEW']}>
      {(wedding) => <EventsList wedding={wedding} />}
    </RequireWedding>
  );
}

/** `/events/new` */
export function NewEventPageContent() {
  return (
    <RequireWedding permission={['EVENTS', 'CREATE']}>
      {(wedding) => <AddEventPage wedding={wedding} />}
    </RequireWedding>
  );
}

/** `/events/[eventId]` */
export function EditEventPageContent({ eventId }: { eventId: string }) {
  return (
    <RequireWedding permission={['EVENTS', 'VIEW']}>
      {(wedding) => (
        <>
          <Can module="VENDORS" action="CREATE">
            <EventVendorBookingShortcut wedding={wedding} eventId={eventId} />
          </Can>
          <EditEventPage key={eventId} wedding={wedding} eventId={eventId} />
        </>
      )}
    </RequireWedding>
  );
}
