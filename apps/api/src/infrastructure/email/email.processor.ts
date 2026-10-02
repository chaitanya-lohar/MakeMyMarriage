import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { EmailJob, QueueName } from '../queue/queue-names.js';
import { EmailSender, type EmailMessage } from './email-message.js';

/** Worker-side delivery of queued email. Retries use the queue's default backoff. */
@Processor(QueueName.Email)
export class EmailProcessor extends WorkerHost {
  constructor(
    private readonly sender: EmailSender,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(EmailProcessor.name);
  }

  async process(job: Job<EmailMessage>): Promise<void> {
    if (job.name !== EmailJob.Send) {
      throw new Error(`Unknown job "${job.name}" on queue "${job.queueName}"`);
    }
    await this.sender.send(job.data);
    // Never log the recipient or content: messages can carry one-time links.
    this.logger.info({ jobId: job.id }, 'Email sent');
  }
}
