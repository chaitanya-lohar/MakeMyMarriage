import type { components } from '@makemymarriage/api-client';

export type ApiPartnerState = components['schemas']['PartnerStateDto'];
export type ApiPartnerInvitation = components['schemas']['PartnerInvitationDto'];
export type ApiPartnerInvitationDetails = components['schemas']['PartnerInvitationDetailsDto'];

/** "aa•••@example.com": the invited address as the Stitch boards show it (0039). */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.toLowerCase().split('@');
  return `${local.slice(0, 2)}•••@${domain}`;
}

/** The API's hint ("aa***@example.com") in the boards' style. */
export function displayHint(hint: string): string {
  return hint.replace('***', '•••');
}

/** "3 Nov 2026" for an instant, in the browser's timezone. */
export function shortDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** One-off session values: read once, then forgotten. Storage may be blocked. */
function remember(key: string, value: object): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the screen falls back to the dashboard.
  }
}

function take(key: string): Record<string, unknown> | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    window.sessionStorage.removeItem(key);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The success screen after accepting (Stitch "M16-04"). */
const WELCOME_KEY = 'mmm.partnerWelcome';

export interface PartnerWelcome {
  weddingName: string;
  inviterName: string;
}

export function rememberPartnerWelcome(welcome: PartnerWelcome): void {
  remember(WELCOME_KEY, welcome);
}

export function takePartnerWelcome(): PartnerWelcome | null {
  const value = take(WELCOME_KEY);
  return typeof value?.weddingName === 'string' && typeof value.inviterName === 'string'
    ? { weddingName: value.weddingName, inviterName: value.inviterName }
    : null;
}

/** A one-off message for the "no wedding yet" page after leaving (Stitch "M16-06"). */
const LEFT_KEY = 'mmm.leftWedding';

export interface LeftWedding {
  weddingName: string;
  otherName: string;
}

export function rememberLeftWedding(left: LeftWedding): void {
  remember(LEFT_KEY, left);
}

/** Reads and forgets the notice. */
export function takeLeftWedding(): LeftWedding | null {
  const value = take(LEFT_KEY);
  return typeof value?.weddingName === 'string' && typeof value.otherName === 'string'
    ? { weddingName: value.weddingName, otherName: value.otherName }
    : null;
}
