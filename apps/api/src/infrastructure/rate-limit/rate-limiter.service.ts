import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module.js';

// A sorted set of use times: drop those outside the window, then add one if there is room.
// KEYS[1] key; ARGV now (ms), window (ms), limit, unique member. Returns {allowed, retryMs}.
const SLIDING_WINDOW_SCRIPT = `
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window)
if redis.call('ZCARD', KEYS[1]) < tonumber(ARGV[3]) then
  redis.call('ZADD', KEYS[1], now, ARGV[4])
  redis.call('PEXPIRE', KEYS[1], window)
  return {1, 0}
end
local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
return {0, tonumber(oldest[2]) + window - now}
`;

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

  /**
   * A sliding window: takes one use when fewer than `limit` were taken in the last
   * `windowSeconds`, else none. One Redis script checks and records, so concurrent requests
   * can never exceed the limit (API Design §28). Returns the seconds until a use frees up
   * when refused.
   */
  async take(
    rule: RateLimitRule,
    subject: string,
    now: Date = new Date(),
  ): Promise<{ allowed: true; ticket: string } | { allowed: false; retryAfterSeconds: number }> {
    const nowMs = now.getTime();
    const ticket = `${nowMs}:${randomUUID()}`;
    const [allowed, retryAfterMs] = (await this.redis.eval(
      SLIDING_WINDOW_SCRIPT,
      1,
      this.key(rule, subject),
      String(nowMs),
      String(rule.windowSeconds * 1000),
      String(rule.limit),
      ticket,
    )) as [number, number];
    return allowed === 1
      ? { allowed: true, ticket }
      : { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  /** Gives back a use `take` recorded, e.g. when the request it allowed was refused after. */
  async release(rule: RateLimitRule, subject: string, ticket: string): Promise<void> {
    await this.redis.zrem(this.key(rule, subject), ticket);
  }

  async reset(rule: RateLimitRule, subject: string): Promise<void> {
    await this.redis.del(this.key(rule, subject));
  }

  private key(rule: RateLimitRule, subject: string): string {
    const digest = createHash('sha256').update(subject).digest('base64url');
    return `rl:${rule.name}:${digest}`;
  }
}
