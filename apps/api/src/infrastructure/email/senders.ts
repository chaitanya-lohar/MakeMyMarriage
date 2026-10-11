import { createTransport, type Transporter } from 'nodemailer';
import { AppConfig } from '../../config/app-config.js';
import {
  EmailRejectedError,
  EmailSender,
  type EmailMessage,
  type EmailSendResult,
} from './email-message.js';

/** SMTP delivery — used for the local Mailpit inbox (decision 0015). */
export class SmtpEmailSender extends EmailSender {
  readonly providerName = 'SMTP';
  private readonly transporter: Transporter;

  constructor(
    host: string,
    port: number,
    private readonly from: string,
  ) {
    super();
    this.transporter = createTransport({ host, port, secure: false });
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const info = (await this.transporter.sendMail({ from: this.from, ...message })) as {
        messageId?: string;
      };
      return { providerMessageId: info.messageId ?? null };
    } catch (error) {
      // SMTP 5xx replies are permanent; 4xx replies and connection errors are temporary.
      const code = (error as { responseCode?: unknown }).responseCode;
      if (typeof code === 'number' && code >= 500 && code < 600) {
        throw new EmailRejectedError(`SMTP ${code}`);
      }
      throw error;
    }
  }
}

/** Resend HTTP API delivery for staging and production. */
export class ResendEmailSender extends EmailSender {
  readonly providerName = 'RESEND';

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {
    super();
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: this.from, ...message }),
    });
    if (response.ok) {
      const body = (await response.json().catch(() => ({}))) as { id?: unknown };
      return { providerMessageId: typeof body.id === 'string' ? body.id : null };
    }
    // 4xx (except rate limiting) is a rejection of this message; 429 and 5xx are temporary.
    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
      // Only the error name is kept: the message text can echo request content.
      const body = (await response.json().catch(() => ({}))) as { name?: unknown };
      const name = typeof body.name === 'string' ? `: ${body.name}` : '';
      throw new EmailRejectedError(`Resend HTTP ${response.status}${name}`);
    }
    throw new Error(`Resend failed with HTTP ${response.status}`);
  }
}

export function createEmailSender(config: AppConfig): EmailSender {
  const { email } = config;
  if (email.transport === 'resend') {
    // Guaranteed by the environment schema.
    return new ResendEmailSender(email.resendApiKey as string, email.from);
  }
  return new SmtpEmailSender(email.smtp.host, email.smtp.port, email.from);
}
