import type { EmailMessage } from '../../../../infrastructure/email/email-message.js';

/**
 * The organizer invitation email (API Design §7.1). WORDING IS DRAFT (decision 0035): it is
 * reviewed with the Phase 10 screens. It carries the single-use link, never shown again.
 */
export interface MemberInvitationEmailInput {
  to: string;
  weddingName: string;
  invitedByName: string;
  roleLabel: string;
  message: string | null;
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

export function memberInvitationEmail(input: MemberInvitationEmailInput): EmailMessage {
  const expires = formatDate(input.expiresOn);
  const intro = `${input.invitedByName} invited you to help plan ${input.weddingName} as ${input.roleLabel}.`;
  const text = [
    intro,
    ...(input.message ? ['', `“${input.message}”`] : []),
    '',
    `Accept the invitation: ${input.acceptUrl}`,
    '',
    `This invitation expires on ${expires}. If you were not expecting it, you can ignore this email.`,
  ].join('\n');
  const html = [
    `<p>${escapeHtml(intro)}</p>`,
    ...(input.message ? [`<blockquote>${escapeHtml(input.message)}</blockquote>`] : []),
    `<p><a href="${escapeHtml(input.acceptUrl)}">Accept the invitation</a></p>`,
    `<p>This invitation expires on ${escapeHtml(expires)}. If you were not expecting it, you can ignore this email.</p>`,
  ].join('\n');
  return {
    to: input.to,
    subject: `You're invited to help plan ${input.weddingName}`,
    text,
    html,
  };
}
