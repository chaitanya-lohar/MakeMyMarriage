import { Processor, WorkerHost } from '@nestjs/bullmq';
import { UnrecoverableError, type Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { QueueName, SystemJob } from '../infrastructure/queue/queue-names.js';

export interface PingResult {
  pong: true;
  processedAt: string;
}

/**
 * Infrastructure-only processor proving that producers, Redis and the worker are
 * wired together. It performs no business work.
 */
@Processor(QueueName.System)
export class SystemProcessor extends WorkerHost {
  constructor(private readonly logger: PinoLogger) {
    super();
    this.logger.setContext(SystemProcessor.name);
  }

  process(job: Job): Promise<PingResult> {
    switch (job.name) {
      case SystemJob.Ping:
        this.logger.info({ jobId: job.id }, 'Processed system ping job');
        return Promise.resolve({ pong: true, processedAt: new Date().toISOString() });
      default:
        // Unknown job names fail permanently instead of being retried.
        return Promise.reject(
          new UnrecoverableError(`Unknown job "${job.name}" on queue "${job.queueName}"`),
        );
    }
  }
}
