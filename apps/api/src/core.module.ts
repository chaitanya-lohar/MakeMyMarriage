import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { EmailModule } from './infrastructure/email/email.module.js';
import { LoggingModule, type ServiceRole } from './infrastructure/logging/logging.module.js';
import { RateLimitModule } from './infrastructure/rate-limit/rate-limit.module.js';
import { RedisModule } from './infrastructure/redis/redis.module.js';

/**
 * Infrastructure for the HTTP API: validated config, structured logging, MongoDB, Redis
 * (rate limiting), and email (0025: there is no worker runtime).
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
        RateLimitModule,
        EmailModule,
      ],
    };
  }
}
