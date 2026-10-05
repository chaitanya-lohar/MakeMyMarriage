import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module.js';

export interface RateLimitRule {
  /** Short name of the limited action, used in the Redis key. */
  name: string;
  limit: number;
  windowSeconds: number;
}

/**
 * Fixed-window counters in Redis. Subjects (for example an email address) are hashed
 * before they become part of a key, so personal data never appears in Redis keys.
 */
@Injectable()
export class RateLimiter {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Counts one use and returns the count so far; the window starts with the first use.
   * Callers reject when the count exceeds the limit. Counting first is atomic, so
   * concurrent requests cannot all pass the check.
   */
  async hit(rule: RateLimitRule, subject: string): Promise<number> {
    const key = this.key(rule, subject);
    const [[, count]] = (await this.redis
      .multi()
      .incr(key)
      .expire(key, rule.windowSeconds, 'NX')
      .exec()) as [[Error | null, number], [Error | null, number]];
    return count;
  }

  async reset(rule: RateLimitRule, subject: string): Promise<void> {
    await this.redis.del(this.key(rule, subject));
  }

  private key(rule: RateLimitRule, subject: string): string {
    const digest = createHash('sha256').update(subject).digest('base64url');
    return `rl:${rule.name}:${digest}`;
  }
}
