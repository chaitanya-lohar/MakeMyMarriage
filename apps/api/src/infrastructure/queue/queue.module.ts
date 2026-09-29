import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';
import { QueueName } from './queue-names.js';

/**
 * BullMQ root configuration shared by producers (HTTP API) and consumers (worker).
 * Processors are registered only by the worker module, so the HTTP API never
 * consumes jobs.
 *
 * Failed jobs are retained (removeOnFail: false) so they can be inspected and
 * replayed — this is the failure/dead-letter record required by System Design §22.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        connection: {
          url: config.redis.url,
          // Required by BullMQ workers: blocking commands must not be retried by ioredis.
          maxRetriesPerRequest: null,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1_000 },
          removeOnComplete: { count: 1_000 },
          removeOnFail: false,
        },
      }),
    }),
    BullModule.registerQueue({ name: QueueName.System }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
