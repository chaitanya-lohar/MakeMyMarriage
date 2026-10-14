import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';
import { EmailSender } from './email-message.js';
import { EmailOutbox } from './email-outbox.service.js';
import { createEmailSender } from './senders.js';

/**
 * Email for the HTTP API (decision 0025: no worker). `EmailSender` sends during the request
 * (invitations); `EmailOutbox` sends after the response (password reset).
 */
@Global()
@Module({
  providers: [
    { provide: EmailSender, inject: [AppConfig], useFactory: createEmailSender },
    EmailOutbox,
  ],
  exports: [EmailSender, EmailOutbox],
})
export class EmailModule {}
