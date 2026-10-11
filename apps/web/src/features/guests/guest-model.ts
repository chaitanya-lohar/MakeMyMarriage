import type { components } from '@makemymarriage/api-client';
import { formatDate } from '@/features/weddings/dates';
import {
  emailStatusLabels,
  guestErrors,
  invitationPanel,
  rsvpLabels,
  whatsappMessage,
} from './content';

export type ApiGuest = components['schemas']['GuestDto'];
export type ApiGuestEvent = components['schemas']['GuestEventDto'];
export type ApiInvitation = components['schemas']['InvitationDto'];
export type ApiInvitationHistory = components['schemas']['InvitationHistoryDto'];
export type RsvpStatus = ApiGuestEvent['rsvpStatus'];

export const RSVP_STATUSES: RsvpStatus[] = ['PENDING', 'ATTENDING', 'DECLINED', 'MAYBE'];

/** Field limits approved in 0019 #6; the API enforces the same. */
export const GuestLimits = { name: 100, email: 254, relation: 100, notes: 1000 } as const;

export interface GuestFormValues {
  name: string;
  mobile: string;
  email: string;
  relation: string;
  notes: string;
}

export type GuestFormField = keyof GuestFormValues;
export type GuestFormErrors = Partial<Record<GuestFormField, string>>;

export const emptyGuestForm: GuestFormValues = {
  name: '',
  mobile: '',
  email: '',
  relation: '',
  notes: '',
};

export function formFromGuest(guest: ApiGuest): GuestFormValues {
  return {
    name: guest.name,
    mobile: guest.mobile,
    email: guest.email ?? '',
    relation: guest.relation ?? '',
    notes: guest.notes ?? '',
  };
}

/** 7–15 digits, an optional leading +, spaces and hyphens allowed (0017 #14). */
export function isValidMobile(value: string): boolean {
  const trimmed = value.trim();
  if (!/^\+?[\d -]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, '').length;
  return digits >= 7 && digits <= 15;
}

/** A simple shape check; the server has the final say. */
export function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const tooLong = (value: string, max: number) =>
  value.trim().length > max
    ? guestErrors.tooLong.replace('{max}', max.toLocaleString('en-IN'))
    : undefined;

export function validateGuestForm(values: GuestFormValues): GuestFormErrors {
  const name = values.name.trim();
  const email = values.email.trim();
  const errors: GuestFormErrors = {
    name: !name
      ? guestErrors.name
      : name.length > GuestLimits.name
        ? guestErrors.nameTooLong
        : undefined,
    mobile: isValidMobile(values.mobile) ? undefined : guestErrors.mobile,
    email:
      email && (!isEmailLike(email) || email.length > GuestLimits.email)
        ? guestErrors.email
        : undefined,
    relation: tooLong(values.relation, GuestLimits.relation),
    notes: tooLong(values.notes, GuestLimits.notes),
  };
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message !== undefined));
}

const orNull = (value: string) => value.trim() || null;

export function toGuestPayload(values: GuestFormValues) {
  return {
    name: values.name.trim(),
    mobile: values.mobile.trim(),
    email: orNull(values.email),
    relation: orNull(values.relation),
    notes: orNull(values.notes),
  };
}

export function errorsFromApi(fields: Record<string, string[]>): GuestFormErrors {
  const errors: GuestFormErrors = {};
  for (const field of Object.keys(emptyGuestForm) as GuestFormField[]) {
    const message = fields[field]?.[0];
    if (message) errors[field] = message;
  }
  return errors;
}

/** The label for a guest's email status; Delivered is never shown in Phase 4 (0019 #8). */
export function emailStatusLabel(
  invitation: ApiGuest['invitation'] | ApiInvitation | null,
): string {
  if (!invitation) return emailStatusLabels.NONE;
  switch (invitation.deliveryStatus) {
    case 'DRAFT':
      return emailStatusLabels.DRAFT;
    case 'FAILED':
      return emailStatusLabels.FAILED;
    default:
      return emailStatusLabels.SENT;
  }
}

/** "Attending · 2", "Declined", "Pending" or "Maybe". */
export function rsvpSummary(status: RsvpStatus, attendeeCount: number | null): string {
  return status === 'ATTENDING' && attendeeCount !== null
    ? `${rsvpLabels.ATTENDING} · ${attendeeCount.toLocaleString('en-IN')}`
    : rsvpLabels[status];
}

/** The attendee count each status requires (0017 #2). */
export function countFor(status: RsvpStatus, people: number): number | null {
  if (status === 'ATTENDING') return people;
  return status === 'DECLINED' ? 0 : null;
}

/** "13 Jan 2027, 09:15" in India time, for invitation activity. */
export function formatDateTime(iso: string, timeZone = 'Asia/Kolkata'): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('day')} ${part('month')} ${part('year')}, ${part('hour')}:${part('minute')}`;
}

/** A send attempt's failure, worded for organizers (decision 0021, correction 6). */
export function failureText(reason: string | null): string {
  return reason?.startsWith('The email service could not be reached')
    ? invitationPanel.unreachable
    : invitationPanel.rejected;
}

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** The prefilled WhatsApp share link; WhatsApp opens on the organizer's own device. */
export function whatsappShareUrl(guestName: string, couple: string, link: string): string {
  const text = whatsappMessage
    .replace('{firstName}', firstNameOf(guestName))
    .replace('{couple}', couple)
    .replace('{link}', link);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export { formatDate };
