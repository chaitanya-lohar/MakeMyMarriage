/** A rendered transactional email, ready to send. */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** The provider accepted the message. Acceptance is not delivery (decision 0017 #10). */
export interface EmailSendResult {
  /** The provider's ID for the message, when it returns one. */
  providerMessageId: string | null;
}

/**
 * The provider rejected the message immediately and permanently (for example an invalid
 * address). Retrying cannot help. Any other error is treated as temporary and retried.
 */
export class EmailRejectedError extends Error {
  constructor(readonly reason: string) {
    super(`The email provider rejected the message: ${reason}`);
    this.name = 'EmailRejectedError';
  }
}

/** Email delivery provider (System Design: external providers behind interfaces). */
export abstract class EmailSender {
  /** Name recorded with invitation send attempts (Database Design §10.4). */
  abstract readonly providerName: string;

  abstract send(message: EmailMessage): Promise<EmailSendResult>;
}
