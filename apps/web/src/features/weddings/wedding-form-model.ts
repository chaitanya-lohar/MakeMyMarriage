import type { components } from '@makemymarriage/api-client';
import { fieldErrors } from './content';
import { isCalendarDate } from './dates';

export type ApiWedding = components['schemas']['WeddingDto'];

/** What the wedding form holds; the date is YYYY-MM-DD from the date picker, or empty. */
export interface WeddingFormValues {
  brideName: string;
  groomName: string;
  startDate: string;
  venueName: string;
  primaryCity: string;
  description: string;
}

export type WeddingFormField = keyof WeddingFormValues;
export type WeddingFormErrors = Partial<Record<WeddingFormField, string>>;

/** Field limits (decision 0016); the API enforces the same. */
export const WeddingLimits = { name: 100, place: 120, description: 1000 } as const;

export const emptyWeddingForm: WeddingFormValues = {
  brideName: '',
  groomName: '',
  startDate: '',
  venueName: '',
  primaryCity: '',
  description: '',
};

export function formFromWedding(wedding: ApiWedding): WeddingFormValues {
  return {
    brideName: wedding.brideName,
    groomName: wedding.groomName,
    startDate: wedding.startDate ?? '',
    venueName: wedding.venueName ?? '',
    primaryCity: wedding.primaryCity ?? '',
    description: wedding.description ?? '',
  };
}

/** "Meera Sharma & Arjun Patel", shown only once both names are filled in (0016). */
export function previewDisplayName(values: WeddingFormValues): string | null {
  const bride = values.brideName.trim();
  const groom = values.groomName.trim();
  return bride && groom ? `${bride} & ${groom}` : null;
}

function nameError(value: string, required: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return required;
  return trimmed.length > WeddingLimits.name ? fieldErrors.nameTooLong : undefined;
}

/** Checks the form the way the API will, so mistakes show before sending. */
export function validateWeddingForm(values: WeddingFormValues): WeddingFormErrors {
  const errors: WeddingFormErrors = {
    brideName: nameError(values.brideName, fieldErrors.brideRequired),
    groomName: nameError(values.groomName, fieldErrors.groomRequired),
    startDate:
      values.startDate && !isCalendarDate(values.startDate) ? fieldErrors.invalidDate : undefined,
    venueName:
      values.venueName.trim().length > WeddingLimits.place ? fieldErrors.placeTooLong : undefined,
    primaryCity:
      values.primaryCity.trim().length > WeddingLimits.place ? fieldErrors.placeTooLong : undefined,
    description:
      values.description.trim().length > WeddingLimits.description
        ? fieldErrors.descriptionTooLong
        : undefined,
  };
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message !== undefined));
}

const orNull = (value: string) => value.trim() || null;

/** The request body for creating or saving a wedding; empty optional fields become null. */
export function toWeddingPayload(values: WeddingFormValues) {
  return {
    brideName: values.brideName.trim(),
    groomName: values.groomName.trim(),
    startDate: values.startDate || null,
    venueName: orNull(values.venueName),
    primaryCity: orNull(values.primaryCity),
    description: orNull(values.description),
  };
}

/** Field errors reported by the API, as form errors (first message per field). */
export function errorsFromApi(fields: Record<string, string[]>): WeddingFormErrors {
  const errors: WeddingFormErrors = {};
  for (const field of Object.keys(emptyWeddingForm) as WeddingFormField[]) {
    const message = fields[field]?.[0];
    if (message) errors[field] = message;
  }
  return errors;
}
