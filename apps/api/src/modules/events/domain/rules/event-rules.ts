/** Event rules: Phase 4 PRD §3.1, decision 0017 #15 and #17, limits approved in 0019 #6. */

export const EventType = {
  Engagement: 'ENGAGEMENT',
  Mehendi: 'MEHENDI',
  Haldi: 'HALDI',
  Sangeet: 'SANGEET',
  Wedding: 'WEDDING',
  Reception: 'RECEPTION',
  Custom: 'CUSTOM',
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

export const EVENT_TYPES = Object.values(EventType);

export const EventLimits = {
  nameMaxLength: 100,
  descriptionMaxLength: 1000,
  venueNameMaxLength: 120,
  venueAddressMaxLength: 300,
  dressCodeMaxLength: 120,
  notesMaxLength: 1000,
} as const;

/** Field messages (DRAFT wording — decision 0021). */
export const EventMessages = {
  name: 'Enter the event name.',
  nameTooLong: 'Use 100 characters or fewer.',
  type: 'Choose an event type.',
  date: 'Enter a valid date.',
  time: 'Enter a time as HH:mm.',
  endWithoutStart: 'Add a start time before an end time.',
  endNotAfterStart: 'The end time must be after the start time.',
  tooLong: (max: number) => `Use ${max.toLocaleString('en-IN')} characters or fewer.`,
} as const;

/** True for a 24-hour local time written as HH:mm, from 00:00 to 23:59. */
export function isLocalTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/**
 * Checks the start/end pair (0017 #17): an end time needs a start time and must be later
 * on the same day. Returns the end-time message, or null when the pair is valid.
 */
export function eventTimesError(startTime: string | null, endTime: string | null): string | null {
  if (endTime === null) return null;
  if (startTime === null) return EventMessages.endWithoutStart;
  // HH:mm strings compare correctly as text.
  return endTime > startTime ? null : EventMessages.endNotAfterStart;
}
