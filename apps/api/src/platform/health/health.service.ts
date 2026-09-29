import { Inject, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Redis } from 'ioredis';
import type { Connection } from 'mongoose';
import { REDIS_CLIENT } from '../../infrastructure/redis/redis.module.js';

export type DependencyStatus = 'up' | 'down';

export interface ReadinessReport {
  status: 'ok' | 'error';
  checks: { mongodb: DependencyStatus; redis: DependencyStatus };
}

const CHECK_TIMEOUT_MS = 2_000;

/**
 * Dependency health for readiness probes. Reports only up/down per dependency —
 * never hostnames, versions or error text (API Design §29).
 */
@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly mongo: Connection,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async readiness(): Promise<ReadinessReport> {
    const [mongodb, redis] = await Promise.all([
      this.check(async () => {
        const db = this.mongo.db;
        if (!db) throw new Error('MongoDB connection not established');
        await db.admin().ping();
      }),
      this.check(async () => {
        await this.redis.ping();
      }),
    ]);
    return {
      status: mongodb === 'up' && redis === 'up' ? 'ok' : 'error',
      checks: { mongodb, redis },
    };
  }

  private async check(probe: () => Promise<void>): Promise<DependencyStatus> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('health check timed out')), CHECK_TIMEOUT_MS);
    });
    try {
      await Promise.race([probe(), timeout]);
      return 'up';
    } catch {
      return 'down';
    } finally {
      clearTimeout(timer);
    }
  }
}
