import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { LoggingModule, type ServiceRole } from './infrastructure/logging/logging.module.js';
import { QueueModule } from './infrastructure/queue/queue.module.js';
import { RedisModule } from './infrastructure/redis/redis.module.js';

/**
 * Infrastructure shared by both runtimes (HTTP API and worker): validated config,
 * structured logging, MongoDB, Redis and BullMQ.
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
      ],
      exports: [QueueModule],
    };
  }
}
