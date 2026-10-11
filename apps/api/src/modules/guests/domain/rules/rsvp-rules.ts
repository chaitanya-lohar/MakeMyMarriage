/** RSVP rules: Phase 4 PRD §6, decisions 0017 #1–5 and 0018 #7. */

export const RsvpStatus = {
  Pending: 'PENDING',
  Attending: 'ATTENDING',
  Declined: 'DECLINED',
  Maybe: 'MAYBE',
} as const;

export type RsvpStatus = (typeof RsvpStatus)[keyof typeof RsvpStatus];

export const RSVP_STATUSES = Object.values(RsvpStatus);

/** What a guest may send: every status except PENDING (0017 #4). */
export const GUEST_RSVP_STATUSES = RSVP_STATUSES.filter((status) => status !== RsvpStatus.Pending);

export const RsvpMessages = {
  status: 'Choose a response.',
  attendingCount: 'Enter at least 1 person.',
  declinedCount: 'A declined RSVP has an attendee count of 0.',
  noCount: 'A pending or maybe RSVP has no attendee count.',
  countRequired: 'Send the attendee count (null when there is none).',
} as const;

/**
 * Checks the status/count pair (0017 #2–3): PENDING and MAYBE take null, DECLINED takes 0,
 * ATTENDING takes an integer of at least 1, with no upper limit. Returns the message for
 * `attendeeCount`, or null when the pair is valid. The server never fills values in.
 */
export function rsvpCountError(status: RsvpStatus, attendeeCount: unknown): string | null {
  switch (status) {
    case RsvpStatus.Attending:
      return Number.isSafeInteger(attendeeCount) && (attendeeCount as number) >= 1
        ? null
        : RsvpMessages.attendingCount;
    case RsvpStatus.Declined:
      return attendeeCount === 0 ? null : RsvpMessages.declinedCount;
    case RsvpStatus.Pending:
    case RsvpStatus.Maybe:
      return attendeeCount === null ? null : RsvpMessages.noCount;
  }
}
