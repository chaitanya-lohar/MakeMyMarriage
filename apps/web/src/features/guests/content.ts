/**
 * Guests, RSVP and invitation copy (Stitch "P4 · O5"–"O9"; corrections in decision 0021).
 * DRAFT WORDING — awaiting product-owner approval (0019 #7, 0021). Guarded by content.spec.ts.
 */

export const guestsPage = {
  title: 'Guests & RSVP',
  subtitle: 'Manage guests, invitations, and track RSVP responses.',
  add: 'Add guest',
  search: 'Search by name or mobile',
  eventFilter: 'Event',
  allEvents: 'All events',
  rsvpFilter: 'RSVP',
  allRsvps: 'All',
  columns: {
    guest: 'Guest & Mobile',
    relation: 'Relation',
    emailStatus: 'Email status',
    linkState: 'Link state',
    actions: 'Actions',
  },
  view: 'View guest',
  lastSent: 'Last sent {date}',
  loadMore: 'Load more',
  loadingMore: 'Loading…',
  emptyTitle: 'No guests yet',
  emptyBody: 'Start your guest list by adding family and friends.',
  noResultsTitle: 'No guests match your search',
  noResultsBody: 'Try adjusting your search or filters.',
  clearFilters: 'Clear filters',
  loadError: "We couldn't load your guests. Please try again.",
  retry: 'Try again',
  loading: 'Loading your guests…',
  deleted: 'The guest has been deleted.',
};

export const rsvpLabels = {
  PENDING: 'Pending',
  ATTENDING: 'Attending',
  DECLINED: 'Declined',
  MAYBE: 'Maybe',
} as const;

/** Email delivery labels (0019 #8). Delivered is never shown in Phase 4. */
export const emailStatusLabels = {
  NONE: 'None',
  DRAFT: 'Draft',
  SENT: 'Sent',
  FAILED: 'Failed',
} as const;

export const linkRevoked = 'Revoked — this link no longer works';

export const guestFields = {
  name: { label: 'Name', placeholder: 'e.g. Raju Sharma' },
  mobile: {
    label: 'Mobile number',
    placeholder: 'e.g. +91 98765 43210',
    hint: '7–15 digits; you can include + and spaces',
  },
  email: {
    label: 'Email (optional)',
    placeholder: 'e.g. raju.sharma@example.com',
    hint: 'Needed to send the invitation by email',
  },
  relation: { label: 'Relation (optional)', placeholder: 'e.g. Uncle, College Friend, Cousin' },
  notes: {
    label: 'Notes (optional)',
    placeholder: 'Anything you want to remember',
    hint: 'Private — guests never see this',
  },
  atMost: 'at most {max}',
};

export const guestErrors = {
  name: "Enter the guest's name.",
  nameTooLong: 'Use 100 characters or fewer.',
  mobile: 'Enter a valid mobile number.',
  email: 'Enter a valid email address.',
  tooLong: 'Use {max} characters or fewer.',
};

export const guestForm = {
  addTitle: 'Add guest',
  editTitle: 'Edit guest',
  subtitle: 'Add someone to your guest list.',
  back: 'Back to guests',
  backToGuest: 'Back to guest',
  save: 'Save guest',
  saving: 'Saving…',
  cancel: 'Cancel',
  serverError: "We couldn't save the guest. Please try again.",
  /** Shown after saving, as information — never a block (0017 #13). */
  duplicate:
    'Saved. Another guest in your list has the same mobile number: {names}. Please check this isn’t a duplicate.',
  viewGuest: 'View guest',
};

export const guestDetail = {
  back: 'Back to guests',
  edit: 'Edit guest',
  delete: 'Delete guest',
  eventsTitle: 'Events and RSVP',
  chooseEvent: 'Choose an event',
  addToEvent: 'Add to event',
  adding: 'Adding…',
  editRsvp: 'Edit RSVP',
  removeFromEvent: 'Remove from event',
  noEventsTitle: '{name} isn’t invited to any events yet',
  noEventsBody: 'Add {name} to an event to include it on their invitation.',
  allEventsAdded: 'This guest is on every event.',
  noEventsToAdd: 'Add an event first to invite guests to it.',
  loadError: "We couldn't load this guest. Please try again.",
  actionError: 'Something went wrong. Please try again.',
};

export const rsvpEditor = {
  title: 'Edit RSVP — {event}',
  response: 'Response',
  people: 'Number of people (including {name})',
  fewer: 'Fewer people',
  more: 'More people',
  atLeastOne: 'Enter at least 1 person.',
  resetNote: 'Organizers can reset an RSVP to Pending.',
  save: 'Save RSVP',
  saving: 'Saving…',
  cancel: 'Cancel',
};

/** Confirmations (decision 0019 #9). */
export const removeFromEvent = {
  title: 'Remove {name} from {event}?',
  body: '{name} will no longer be invited to {event}. Their RSVP history is kept.',
  confirm: 'Remove',
  removing: 'Removing…',
  cancel: 'Cancel',
};

export const deleteGuest = {
  title: 'Delete {name}?',
  body: '{firstName} will be removed from your guest list and their invitation link will stop working. Their RSVP and invitation history is kept.',
  confirm: 'Delete guest',
  deleting: 'Deleting…',
  cancel: 'Cancel',
  error: "We couldn't delete the guest. Please try again.",
};

export const guestNotAvailable = {
  title: "This guest isn't available",
  body: 'They may have been removed, or you may not have access to them.',
  back: 'Back to guests',
};

/** Stitch "P4 · O8" — the content reference is the mobile screen (decision 0021). */
export const invitationPanel = {
  title: 'Invitation',
  emailStatus: 'Email status: {status}',
  none: 'Create a private invitation link for {name}. One link covers all their events.',
  create: 'Create invitation',
  creating: 'Creating…',
  linkReady: 'Invitation link ready',
  linkRevoked: 'Link revoked',
  copy: 'Copy link',
  whatsapp: 'Share on WhatsApp',
  send: 'Send email',
  resend: 'Resend email',
  sending: 'Queuing…',
  regenerate: 'Regenerate link',
  revoke: 'Revoke link',
  needsEmail: 'Add an email address to send the invitation by email.',
  regenerated: 'Earlier link replaced. Email status is back to Draft until you send the new link.',
  revokedNote: 'The email status is unchanged.',
  lastSent: 'Last sent {date}',
  firstOpened: 'First opened {date}',
  openedNote: 'Shows that the link was opened — not that the email was delivered.',
  history: 'Email history',
  attemptSent: '{date} — Sent',
  attemptFailed: '{date} — {reason}',
  rejected: 'The email address was rejected',
  unreachable: 'The email service could not be reached',
  copied: 'Link copied',
  queued: 'Email queued. Its status updates when the email service responds.',
  error: 'Something went wrong. Please try again.',
};

export const regenerateLink = {
  title: 'Create a new link?',
  body: 'The current link will stop working, and the email status goes back to Draft until you send the new link to {name}.',
  revokedTitle: 'Create a new link for {name}?',
  revokedBody:
    'The revoked link stays invalid. The email status goes back to Draft until you send the new link.',
  confirm: 'Regenerate link',
  pending: 'Regenerating…',
  cancel: 'Cancel',
};

export const revokeLink = {
  title: 'Revoke this link?',
  body: 'The current link will stop working, and no new link is created.',
  confirm: 'Revoke link',
  pending: 'Revoking…',
  cancel: 'Cancel',
};

/** The prefilled WhatsApp message (DRAFT); WhatsApp opens on the organizer's own device. */
export const whatsappMessage =
  "Dear {firstName}, you're warmly invited to the wedding celebrations of {couple}. Please view your invitation and RSVP here: {link}";
