import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';
import { EmailSender } from './email-message.js';
import { EmailProcessor } from './email.processor.js';
import { createEmailSender } from './senders.js';

/** Consumer side of email; imported only by the worker runtime. */
@Module({
  providers: [
    { provide: EmailSender, inject: [AppConfig], useFactory: createEmailSender },
    EmailProcessor,
  ],
  // The invitations worker sends through the same provider (Phase 4).
  exports: [EmailSender],
})
export class EmailWorkerModule {}
