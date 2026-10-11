/**
 * Guest invitation copy (Stitch "P4 · G1 / G2" and "G3 / G4 / G5"; corrections in decision
 * 0021). DRAFT WORDING — awaiting product-owner approval (0019 #7, 0021). Guarded by
 * content.spec.ts.
 */

export const invitationPage = {
  greeting: 'Dear {name}, you’re invited',
  intro: 'Please view the ceremonies you are invited to below and share your RSVP reply.',
  loading: 'Opening your invitation…',
  awaiting: 'Awaiting your reply',
  dressCode: 'Dress code: {value}',
  yourResponse: 'Your response',
  attending: 'Attending',
  declined: 'Declined',
  maybe: 'Maybe',
  peopleQuestion: 'How many people are coming, including you?',
  fewer: 'Fewer people',
  more: 'More people',
  send: 'Send my RSVP',
  sending: 'Sending…',
  note: 'Events you leave unanswered stay awaiting your reply. You can change your answers later.',
  nothingChosen: 'Choose a response for at least one event.',
};

/** G3 states. */
export const rsvpSaved = {
  title: 'Thank you, {name}. Your RSVP has been saved.',
  answers: 'Your answers',
  later: 'You can change your answers later.',
};

export const invitationErrors = {
  headcount: 'Please tell us how many people are coming (at least 1).',
  server: "We couldn't save your RSVP. Please try again.",
  network: "We couldn't reach MakeMyMarriage. Check your connection and try again.",
  rateLimited: 'Too many attempts. Please wait a few minutes and try again.',
  loadServer: "We couldn't open your invitation. Please try again.",
  retry: 'Try again',
};

/** G4: an unknown, revoked or replaced link — no buttons. */
export const linkNotWorking = {
  title: 'This invitation link isn’t working',
  body: 'It may have been replaced or withdrawn. Please contact the couple for a new link.',
};

/** G5: no events on the invitation — no buttons. */
export const noEvents = {
  title: 'No events on your invitation',
  body: 'There are no events on your invitation right now. Please check back later or contact the couple.',
};

export const invitationFooter = {
  copyright: '© 2026 MakeMyMarriage. All rights reserved.',
};
