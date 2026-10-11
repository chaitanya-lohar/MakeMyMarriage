import type { RsvpStatus } from '../rules/rsvp-rules.js';

/** A guest of one wedding (Database Design §10.1). */
export interface Guest {
  id: string;
  weddingId: string;
  name: string;
  /** Normalized: digits with an optional leading "+". */
  mobile: string;
  email: string | null;
  relation: string | null;
  /** Organizer-only; never in guest-facing responses. */
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The details an organizer enters; null clears an optional field. */
export interface GuestDetails {
  name: string;
  mobile: string;
  email: string | null;
  relation: string | null;
  notes: string | null;
}

export interface NewGuest extends GuestDetails {
  weddingId: string;
  createdBy: string;
}

export type GuestChanges = Partial<GuestDetails>;

/** Another active guest with the same normalized mobile — a warning, never a block. */
export interface DuplicateMobileGuest {
  id: string;
  name: string;
}

export interface GuestSaveResult {
  guest: Guest;
  duplicateMobileGuests: DuplicateMobileGuest[];
}

/** A guest–event assignment and its RSVP (Database Design §10.2). */
export interface GuestEvent {
  id: string;
  weddingId: string;
  guestId: string;
  eventId: string;
  rsvpStatus: RsvpStatus;
  /** PENDING/MAYBE: null; DECLINED: 0; ATTENDING: ≥ 1. */
  attendeeCount: number | null;
  respondedAt: Date | null;
  rsvpUpdatedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export interface RsvpAnswer {
  rsvpStatus: RsvpStatus;
  attendeeCount: number | null;
}

/** Guest list query (API Design §9). */
export interface GuestListQuery {
  search?: string;
  eventId?: string;
  rsvpStatus?: RsvpStatus;
  limit: number;
  cursor?: string;
}

export interface GuestPage {
  guests: Guest[];
  nextCursor: string | null;
}
