import type { EmailMessage } from '../../../../infrastructure/email/email-message.js';

/**
 * The invitation email. WORDING IS DRAFT (decision 0021: the copy-drafts screen awaits
 * product-owner approval). The approved rule for missing details applies: a wedding without a
 * date or city leaves that detail out, with no empty labels or invented text (0021).
 */
export interface InvitationEmailInput {
  to: string;
  guestName: string;
  brideName: string;
  groomName: string;
  /** YYYY-MM-DD, or null when the wedding has no date. */
  weddingDate: string | null;
  city: string | null;
  invitationUrl: string;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
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

/** "Thursday, 18 February 2027" for a YYYY-MM-DD calendar date. */
export function formatLongDate(calendarDate: string): string {
  const [year, month, day] = calendarDate.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${WEEKDAYS[date.getUTCDay()]}, ${day} ${MONTHS[month - 1]} ${year}`;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function invitationEmail(input: InvitationEmailInput): EmailMessage {
  const couple = `${input.brideName} & ${input.groomName}`;
  const when = input.weddingDate ? ` on ${formatLongDate(input.weddingDate)}` : '';
  const where = input.city ? ` in ${input.city}` : '';
  const signOff = `${firstName(input.brideName)} & ${firstName(input.groomName)}`;

  const greeting = `Dear ${input.guestName},`;
  const invited = `You're warmly invited to celebrate the wedding of ${couple}${when}${where}.`;
  const covers =
    'This invitation covers your personalized ceremony schedule and RSVP details for all events you are invited to.';
  const footer = '© 2026 MakeMyMarriage. All rights reserved.';

  const text = [
    greeting,
    '',
    invited,
    '',
    covers,
    '',
    `View invitation and RSVP: ${input.invitationUrl}`,
    '',
    'With love,',
    signOff,
    '',
    footer,
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#faf8f5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#faf8f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#ffffff;border:1px solid #eadfd3;border-radius:16px;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;color:#1b1c1a;">
            <tr>
              <td style="padding:32px 32px 8px;">
                <p style="margin:0;font-size:18px;font-weight:700;color:#0a1128;letter-spacing:-0.02em;">MakeMyMarriage<span style="color:#b89758;">.</span></p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 0;font-size:15px;line-height:24px;">
                <p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
                <p style="margin:0 0 16px;">${escapeHtml(invited)}</p>
                <p style="margin:0 0 24px;color:#46464d;">${escapeHtml(covers)}</p>
                <p style="margin:0 0 24px;">
                  <a href="${escapeHtml(input.invitationUrl)}" style="display:inline-block;background-color:#0a1128;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">View invitation and RSVP</a>
                </p>
                <p style="margin:0 0 4px;">With love,</p>
                <p style="margin:0 0 24px;font-weight:600;">${escapeHtml(signOff)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 32px;border-top:1px solid #f1efea;font-size:12px;color:#46464d;">${footer}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { to: input.to, subject: `You're invited: ${couple}`, html, text };
}
