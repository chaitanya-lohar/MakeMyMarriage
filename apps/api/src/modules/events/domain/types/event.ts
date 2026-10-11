import type { EventType } from '../rules/event-rules.js';

export interface EventVenue {
  name: string | null;
  address: string | null;
}

/** A wedding event (Database Design §9, decision 0017). */
export interface WeddingEvent {
  id: string;
  weddingId: string;
  name: string;
  type: EventType;
  /** Calendar date, YYYY-MM-DD, in the wedding's timezone. */
  date: string;
  /** HH:mm, wedding timezone. */
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  description: string | null;
  venue: EventVenue;
  dressCode: string | null;
  /** Organizer-only; never shown to guests. */
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The details an organizer enters; null clears an optional field. */
export interface EventDetails {
  name: string;
  type: EventType;
  date: string;
  startTime: string | null;
  endTime: string | null;
  description: string | null;
  venue: EventVenue;
  dressCode: string | null;
  notes: string | null;
}

export interface NewEvent extends EventDetails {
  weddingId: string;
  timezone: string;
  createdBy: string;
}

/** A change to an event: only the given fields change; venue fields change one by one. */
export type EventChanges = Partial<Omit<EventDetails, 'venue'>> & {
  venue?: Partial<EventVenue>;
};
