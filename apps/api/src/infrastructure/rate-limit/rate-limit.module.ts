import { Global, Module } from '@nestjs/common';
import { RateLimiter } from './rate-limiter.service.js';

/** Redis-backed rate limiting for abuse protection (System Design §21). */
@Global()
@Module({
  providers: [RateLimiter],
  exports: [RateLimiter],
})
export class RateLimitModule {}
