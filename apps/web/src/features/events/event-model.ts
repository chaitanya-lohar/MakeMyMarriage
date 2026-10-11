import type { components } from '@makemymarriage/api-client';
import type { IconName } from '@/components/ui/icon';
import { formatLongDate, parseTypedDate, toTypedDate } from '@/features/weddings/dates';
import { eventErrors } from './content';

export type ApiEvent = components['schemas']['EventDto'];
export type EventType = ApiEvent['type'];

/** The seven Phase 4 event types (decision 0017 #15), in form order. */
export const EVENT_TYPES: EventType[] = [
  'ENGAGEMENT',
  'MEHENDI',
  'HALDI',
  'SANGEET',
  'WEDDING',
  'RECEPTION',
  'CUSTOM',
];

export const eventTypeIcons: Record<EventType, IconName> = {
  ENGAGEMENT: 'diamond',
  MEHENDI: 'spa',
  HALDI: 'flare',
  SANGEET: 'music_note',
  WEDDING: 'temple_hindu',
  RECEPTION: 'nightlife',
  CUSTOM: 'celebration',
};

/** Field limits approved in 0019 #6; the API enforces the same. */
export const EventLimits = {
  name: 100,
  description: 1000,
  venueName: 120,
  venueAddress: 300,
  dressCode: 120,
  notes: 1000,
} as const;

/** What the event form holds; the date is kept as typed ("DD / MM / YYYY"). */
export interface EventFormValues {
  name: string;
  type: EventType | '';
  date: string;
  startTime: string;
  endTime: string;
  description: string;
  venueName: string;
  venueAddress: string;
  dressCode: string;
  notes: string;
}

export type EventFormField = keyof EventFormValues;
export type EventFormErrors = Partial<Record<EventFormField, string>>;

export const emptyEventForm: EventFormValues = {
  name: '',
  type: '',
  date: '',
  startTime: '',
  endTime: '',
  description: '',
  venueName: '',
  venueAddress: '',
  dressCode: '',
  notes: '',
};

export function formFromEvent(event: ApiEvent): EventFormValues {
  return {
    name: event.name,
    type: event.type,
    date: toTypedDate(event.date),
    startTime: event.startTime ?? '',
    endTime: event.endTime ?? '',
    description: event.description ?? '',
    venueName: event.venue.name ?? '',
    venueAddress: event.venue.address ?? '',
    dressCode: event.dressCode ?? '',
    notes: event.notes ?? '',
  };
}

export function isLocalTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

const tooLong = (value: string, max: number) =>
  value.trim().length > max
    ? eventErrors.tooLong.replace('{max}', max.toLocaleString('en-IN'))
    : undefined;

/** Checks the form the way the API will (Phase 4 PRD §3.1), so mistakes show before sending. */
export function validateEventForm(values: EventFormValues): EventFormErrors {
  const name = values.name.trim();
  const start = values.startTime.trim();
  const end = values.endTime.trim();
  let endTime: string | undefined;
  if (end && !isLocalTime(end)) endTime = eventErrors.time;
  else if (end && !start) endTime = eventErrors.endWithoutStart;
  else if (end && isLocalTime(start) && end <= start) endTime = eventErrors.endNotAfterStart;

  const errors: EventFormErrors = {
    name: !name
      ? eventErrors.name
      : name.length > EventLimits.name
        ? eventErrors.nameTooLong
        : undefined,
    type: values.type ? undefined : eventErrors.type,
    date: parseTypedDate(values.date) ? undefined : eventErrors.date,
    startTime: start && !isLocalTime(start) ? eventErrors.time : undefined,
    endTime,
    description: tooLong(values.description, EventLimits.description),
    venueName: tooLong(values.venueName, EventLimits.venueName),
    venueAddress: tooLong(values.venueAddress, EventLimits.venueAddress),
    dressCode: tooLong(values.dressCode, EventLimits.dressCode),
    notes: tooLong(values.notes, EventLimits.notes),
  };
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message !== undefined));
}

const orNull = (value: string) => value.trim() || null;

/** The request body for creating or saving an event; empty optional fields become null. */
export function toEventPayload(values: EventFormValues) {
  return {
    name: values.name.trim(),
    type: values.type as EventType,
    date: parseTypedDate(values.date) as string,
    startTime: orNull(values.startTime),
    endTime: orNull(values.endTime),
    description: orNull(values.description),
    venue: { name: orNull(values.venueName), address: orNull(values.venueAddress) },
    dressCode: orNull(values.dressCode),
    notes: orNull(values.notes),
  };
}

const apiFieldNames: Record<string, EventFormField> = {
  'venue.name': 'venueName',
  'venue.address': 'venueAddress',
};

/** Field errors reported by the API, as form errors (first message per field). */
export function errorsFromApi(fields: Record<string, string[]>): EventFormErrors {
  const errors: EventFormErrors = {};
  for (const [name, messages] of Object.entries(fields)) {
    const field = apiFieldNames[name] ?? (name in emptyEventForm ? (name as EventFormField) : null);
    if (field && messages[0]) errors[field] = messages[0];
  }
  return errors;
}

/** "16:00 – 20:00", "16:00", or "" for an untimed event. */
export function formatTimes(startTime: string | null, endTime: string | null): string {
  if (!startTime) return '';
  return endTime ? `${startTime} – ${endTime}` : startTime;
}

/** "Tuesday, 16 February 2027 · 16:00 – 20:00" (24-hour times; untimed: the date only). */
export function formatEventWhen(event: Pick<ApiEvent, 'date' | 'startTime' | 'endTime'>): string {
  const times = formatTimes(event.startTime, event.endTime);
  const date = formatLongDate(event.date);
  return times ? `${date} · ${times}` : date;
}

/** Dated before today in the wedding's timezone. */
export function isPast(event: Pick<ApiEvent, 'date'>, today: string): boolean {
  return event.date < today;
}
