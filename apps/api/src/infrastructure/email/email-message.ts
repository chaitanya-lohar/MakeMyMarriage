/** A rendered transactional email, ready to send. */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Delivery provider behind the worker (System Design: external providers behind interfaces). */
export abstract class EmailSender {
  abstract send(message: EmailMessage): Promise<void>;
}
