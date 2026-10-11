/**
 * Events copy (Stitch "P4 · O2", "O3", "O4"; corrections in decision 0021).
 * DRAFT WORDING — awaiting product-owner approval (0019 #7, 0021). Guarded by content.spec.ts.
 */

export const eventTypeLabels = {
  ENGAGEMENT: 'Engagement',
  MEHENDI: 'Mehendi',
  HALDI: 'Haldi',
  SANGEET: 'Sangeet',
  WEDDING: 'Wedding',
  RECEPTION: 'Reception',
  CUSTOM: 'Custom',
} as const;

export const eventsPage = {
  title: 'Events',
  subtitle: 'Manage all ceremonies and celebrations for your wedding.',
  add: 'Add event',
  edit: 'Edit event',
  past: 'Past',
  emptyTitle: 'No events yet',
  emptyBody: 'Add your first event to get started.',
  loadError: "We couldn't load your events. Please try again.",
  retry: 'Try again',
  loading: 'Loading your events…',
  deleted: 'The event has been deleted.',
};

export const eventFields = {
  name: { label: 'Event name', placeholder: 'e.g. Sangeet' },
  type: { label: 'Event type', placeholder: 'Select an event type' },
  date: { label: 'Date', placeholder: 'DD / MM / YYYY', hint: 'Past dates are allowed' },
  startTime: { label: 'Start time (optional, HH:mm)', placeholder: 'HH:mm' },
  endTime: { label: 'End time (optional, HH:mm)', placeholder: 'HH:mm' },
  timesHint: 'An end time needs a start time and must be later the same day.',
  description: {
    label: 'Description (optional)',
    placeholder: 'Add ceremony highlights, schedule notes, or attire cues',
  },
  venueName: { label: 'Venue name (optional)', placeholder: 'e.g. Lakeside Garden' },
  venueAddress: { label: 'Venue address (optional)', placeholder: 'e.g. Amer Road, Jaipur' },
  dressCode: { label: 'Dress code (optional)', placeholder: 'e.g. Festive traditional' },
  notes: {
    label: 'Notes (optional)',
    placeholder: 'Anything you want to remember',
    hint: 'Private — guests never see this',
  },
  atMost: 'at most {max}',
};

export const eventErrors = {
  name: 'Enter the event name.',
  nameTooLong: 'Use 100 characters or fewer.',
  type: 'Choose an event type.',
  date: 'Enter a valid date.',
  time: 'Enter a time as HH:mm.',
  endWithoutStart: 'Add a start time before an end time.',
  endNotAfterStart: 'The end time must be after the start time.',
  tooLong: 'Use {max} characters or fewer.',
};

export const eventForm = {
  addTitle: 'Add event',
  editTitle: 'Edit event',
  subtitle: 'Configure key rituals, timing, and venue arrangements for your celebration.',
  back: 'Back to events',
  save: 'Save event',
  saving: 'Saving…',
  cancel: 'Cancel',
  saved: 'Your changes have been saved.',
  serverError: "We couldn't save the event. Please try again.",
  delete: 'Delete event',
};

/** O4 delete confirmation (decision 0019 #9). */
export const deleteEvent = {
  title: 'Delete this event?',
  body: '{name} will be removed from your events and guest lists. Its RSVP and invitation history is kept.',
  confirm: 'Delete event',
  deleting: 'Deleting…',
  cancel: 'Cancel',
  error: "We couldn't delete the event. Please try again.",
};

/** O4 not available state (decision 0021). */
export const eventNotAvailable = {
  title: "This event isn't available",
  body: 'It may have been removed, or you may not have access to it.',
  back: 'Back to events',
};
