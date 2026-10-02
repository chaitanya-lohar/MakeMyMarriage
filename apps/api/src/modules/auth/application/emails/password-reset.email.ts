import type { EmailMessage } from '../../../../infrastructure/email/email-message.js';

const SUBJECT = 'Reset your MakeMyMarriage password';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * The approved password-reset email (decision 0015): HTML in the design system plus a
 * plain-text version. Inline styles only, for email-client compatibility.
 */
export function passwordResetEmail(to: string, name: string, resetUrl: string): EmailMessage {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(resetUrl);

  const text = [
    `Hi ${name},`,
    '',
    'We received a request to reset the password for your MakeMyMarriage account.',
    '',
    `Reset your password: ${resetUrl}`,
    '',
    'This link can be used once and expires in 60 minutes. For your security, resetting your password signs you out on all your devices.',
    '',
    "If you didn't ask to reset your password, you can ignore this email — your password won't change.",
    '',
    '© 2026 MakeMyMarriage. All rights reserved.',
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
                <p style="margin:0 0 16px;">Hi ${safeName},</p>
                <p style="margin:0 0 24px;">We received a request to reset the password for your MakeMyMarriage account.</p>
                <p style="margin:0 0 24px;">
                  <a href="${safeUrl}" style="display:inline-block;background-color:#0a1128;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">Reset your password</a>
                </p>
                <p style="margin:0 0 16px;color:#46464d;">This link can be used once and expires in 60 minutes. For your security, resetting your password signs you out on all your devices.</p>
                <p style="margin:0 0 24px;color:#46464d;">If you didn't ask to reset your password, you can ignore this email — your password won't change.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 32px;border-top:1px solid #f1efea;font-size:12px;color:#46464d;">© 2026 MakeMyMarriage. All rights reserved.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { to, subject: SUBJECT, html, text };
}
