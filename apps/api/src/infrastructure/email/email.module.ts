import { Global, Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module.js';
import { EmailOutbox } from './email-outbox.service.js';

/** Producer side of email: lets any runtime queue a message for the worker. */
@Global()
@Module({
  imports: [QueueModule],
  providers: [EmailOutbox],
  exports: [EmailOutbox],
})
export class EmailModule {}
