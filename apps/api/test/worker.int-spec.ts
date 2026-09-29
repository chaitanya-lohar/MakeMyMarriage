import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Queue, QueueEvents } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { QueueName, SystemJob } from '../src/infrastructure/queue/queue-names.js';
import type { PingResult } from '../src/worker/system.processor.js';
import { WorkerModule } from '../src/worker/worker.module.js';
import {
  startTestEnvironment,
  TEST_REDIS_URL,
  type TestEnvironment,
} from './support/test-environment.js';

const HEALTH_PORT = 3902;

describe('Worker runtime', () => {
  let env: TestEnvironment;
  let worker: INestApplicationContext;
  let queue: Queue;
  let queueEvents: QueueEvents;

  beforeAll(async () => {
    env = await startTestEnvironment({ WORKER_HEALTH_PORT: String(HEALTH_PORT) });
    worker = await NestFactory.createApplicationContext(WorkerModule, { logger: false });
    worker.enableShutdownHooks();

    queue = new Queue(QueueName.System, { connection: { url: TEST_REDIS_URL } });
    queueEvents = new QueueEvents(QueueName.System, { connection: { url: TEST_REDIS_URL } });
    await queueEvents.waitUntilReady();
  });

  afterAll(async () => {
    await queueEvents?.close();
    await queue?.close();
    await worker?.close();
    await env?.stop();
  });

  it('consumes jobs enqueued by a producer', async () => {
    const job = await queue.add(SystemJob.Ping, {}, { jobId: `ping-${randomUUID()}` });
    const result = (await job.waitUntilFinished(queueEvents, 15_000)) as PingResult;
    expect(result.pong).toBe(true);
  });

  it('serves liveness and readiness probes', async () => {
    const live = await fetch(`http://127.0.0.1:${HEALTH_PORT}/health/live`);
    expect(live.status).toBe(200);

    const ready = await fetch(`http://127.0.0.1:${HEALTH_PORT}/health/ready`);
    expect(ready.status).toBe(200);
    expect(await ready.json()).toEqual({ status: 'ok', checks: { mongodb: 'up', redis: 'up' } });
  });
});
