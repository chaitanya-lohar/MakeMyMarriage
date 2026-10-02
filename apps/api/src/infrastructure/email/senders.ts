import { createTransport, type Transporter } from 'nodemailer';
import { AppConfig } from '../../config/app-config.js';
import { EmailSender, type EmailMessage } from './email-message.js';

/** SMTP delivery — used for the local Mailpit inbox (decision 0015). */
export class SmtpEmailSender extends EmailSender {
  private readonly transporter: Transporter;

  constructor(
    host: string,
    port: number,
    private readonly from: string,
  ) {
    super();
    this.transporter = createTransport({ host, port, secure: false });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.from, ...message });
  }
}

/** Resend HTTP API delivery for staging and production. */
export class ResendEmailSender extends EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {
    super();
  }

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: this.from, ...message }),
    });
    if (!response.ok) {
      // The body is not included: it can echo request content.
      throw new Error(`Resend rejected the message with HTTP ${response.status}`);
    }
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
