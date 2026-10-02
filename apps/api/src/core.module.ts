import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { EmailModule } from './infrastructure/email/email.module.js';
import { LoggingModule, type ServiceRole } from './infrastructure/logging/logging.module.js';
import { QueueModule } from './infrastructure/queue/queue.module.js';
import { RateLimitModule } from './infrastructure/rate-limit/rate-limit.module.js';
import { RedisModule } from './infrastructure/redis/redis.module.js';

/**
 * Infrastructure shared by both runtimes (HTTP API and worker): validated config,
 * structured logging, MongoDB, Redis, BullMQ, rate limiting and the email outbox.
 */
@Module({})
export class CoreModule {
  static forRoot(service: ServiceRole): DynamicModule {
    return {
      module: CoreModule,
      imports: [
        ConfigModule,
        LoggingModule.forRoot(service),
        DatabaseModule,
        RedisModule,
        QueueModule,
        RateLimitModule,
        EmailModule,
      ],
      exports: [QueueModule],
    };
  }
}
