import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { EmailJob, QueueName } from '../queue/queue-names.js';
import type { EmailMessage } from './email-message.js';

/**
 * Queues email for the worker to send, so requests never wait on the provider.
 *
 * Messages can carry one-time links (password reset), so jobs are removed as soon as
 * they are sent and failed jobs after an hour — longer than any such link is useful.
 */
@Injectable()
export class EmailOutbox {
  constructor(@InjectQueue(QueueName.Email) private readonly queue: Queue<EmailMessage>) {}

  async enqueue(message: EmailMessage): Promise<void> {
    await this.queue.add(EmailJob.Send, message, {
      removeOnComplete: true,
      removeOnFail: { age: 60 * 60 },
    });
  }
}
