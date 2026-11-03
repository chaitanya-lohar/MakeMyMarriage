import type { EmailMessage } from '../../../../infrastructure/email/email-message.js';

/**
 * The partner invitation email (API Design §7.2). WORDING IS DRAFT (decision 0039). It carries
 * the single-use link, never shown again.
 */
export interface PartnerInvitationEmailInput {
  to: string;
  weddingName: string;
  invitedByName: string;
  acceptUrl: string;
  /** YYYY-MM-DD in the wedding's timezone. */
  expiresOn: string;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "1 November 2026" for a YYYY-MM-DD date. */
function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function partnerInvitationEmail(input: PartnerInvitationEmailInput): EmailMessage {
  const expires = formatDate(input.expiresOn);
  const intro = `${input.invitedByName} invited you to plan ${input.weddingName} together.`;
  const owner =
    "If you accept, you'll become an owner of this wedding, with full access to everything in it.";
  const closing = `This invitation expires on ${expires}. If you were not expecting it, you can ignore this email.`;
  return {
    to: input.to,
    subject: `${input.invitedByName} invited you to plan ${input.weddingName} together`,
    text: [intro, owner, '', `See the invitation: ${input.acceptUrl}`, '', closing].join('\n'),
    html: [
      `<p>${escapeHtml(intro)}</p>`,
      `<p>${escapeHtml(owner)}</p>`,
      `<p><a href="${escapeHtml(input.acceptUrl)}">See the invitation</a></p>`,
      `<p>${escapeHtml(closing)}</p>`,
    ].join('\n'),
  };
}
