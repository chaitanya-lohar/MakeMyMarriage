import type { ApiError } from '@/lib/api';

/**
 * A quick shape check (something@domain.tld) so obvious typos are caught before the
 * request. The API's own check stays authoritative; see {@link isInvalidEmailError}.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

/** The API rejected the request because the email field is not an email address. */
export function isInvalidEmailError(error: ApiError): boolean {
  return error.code === 'VALIDATION_FAILED' && (error.fields.email?.length ?? 0) > 0;
}
