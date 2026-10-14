import { Injectable } from '@nestjs/common';
import { waitUntil } from '@vercel/functions';
import { PinoLogger } from 'nestjs-pino';
import { EmailRejectedError, EmailSender, type EmailMessage } from './email-message.js';

/**
 * Sends email after the response (decision 0025): the caller returns at once and the send
 * finishes in the same function invocation (Vercel `waitUntil`; elsewhere the promise simply
 * runs on). Used where response time must not depend on whether an email goes out, such as
 * password reset (0015). A failed send is logged, never retried.
 */
@Injectable()
export class EmailOutbox {
  constructor(
    private readonly sender: EmailSender,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(EmailOutbox.name);
  }

  sendAfterResponse(message: EmailMessage): void {
    const sending = this.sender.send(message).then(
      // Never log the recipient or content: messages can carry one-time links.
      () => this.logger.info('Email sent'),
      (error: unknown) => {
        const reason = error instanceof EmailRejectedError ? error.reason : (error as Error).name;
        this.logger.warn({ reason }, 'Email could not be sent');
      },
    );
    waitUntil(sending);
  }
}
