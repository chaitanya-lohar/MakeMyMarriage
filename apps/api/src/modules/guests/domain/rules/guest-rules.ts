/** Guest rules: Phase 4 PRD §4, decision 0017 #13–14, limits approved in 0019 #6. */

export const GuestLimits = {
  nameMaxLength: 100,
  emailMaxLength: 254,
  relationMaxLength: 100,
  notesMaxLength: 1000,
  mobileMinDigits: 7,
  mobileMaxDigits: 15,
} as const;

/** Field messages (DRAFT wording — decision 0021). */
export const GuestMessages = {
  name: "Enter the guest's name.",
  nameTooLong: 'Use 100 characters or fewer.',
  mobile: 'Enter a valid mobile number.',
  email: 'Enter a valid email address.',
  tooLong: (max: number) => `Use ${max.toLocaleString('en-IN')} characters or fewer.`,
} as const;

/**
 * 7–15 digits, an optional leading `+`, spaces and hyphens allowed as separators, no
 * country-specific format (0017 #14). Checks the format only.
 */
export function isValidMobile(value: string): boolean {
  if (!/^\+?[\d -]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, '').length;
  return digits >= GuestLimits.mobileMinDigits && digits <= GuestLimits.mobileMaxDigits;
}

/** Separators removed, leading `+` kept — the stored and compared form (Phase 4 PRD §4). */
export function normalizeMobile(value: string): string {
  return value.replace(/[\s-]/g, '');
}
