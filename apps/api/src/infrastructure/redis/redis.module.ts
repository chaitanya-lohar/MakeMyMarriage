import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppConfig } from '../../config/app-config.js';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Shared general-purpose Redis client (health checks now; rate limiting and
 * short-lived operational state later). BullMQ manages its own connections.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [AppConfig],
      // A rediss:// URL enables TLS, which managed Redis requires in staging/production.
      useFactory: (config: AppConfig) => new Redis(config.redis.url),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
