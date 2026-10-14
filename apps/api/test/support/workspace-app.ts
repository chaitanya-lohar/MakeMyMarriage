import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Redis } from 'ioredis';
import type { Connection } from 'mongoose';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureHttpApp } from '../../src/bootstrap/configure-http-app.js';
import { EmailSender } from '../../src/infrastructure/email/email-message.js';
import { startTestEnvironment, TEST_REDIS_URL, type TestEnvironment } from './test-environment.js';

export type Agent = ReturnType<typeof request.agent>;

/** A running HTTP API with helpers for signed-in owners — shared by the Phase 4 suites. */
export interface WorkspaceApp {
  app: INestApplication;
  connection: Connection;
  redis: Redis;
  server(): Server;
  /** A signed-in browser for a new user without a wedding. */
  signedInUser(): Promise<Agent>;
  /** A new user who owns a new wedding. */
  owner(details?: Record<string, unknown>): Promise<{ agent: Agent; weddingId: string }>;
  stop(): Promise<void>;
}

export const COUPLE = { brideName: 'Meera Sharma', groomName: 'Arjun Patel' };

export async function startWorkspaceApp(
  overrides: Record<string, string> = {},
  options: { emailSender?: EmailSender } = {},
): Promise<WorkspaceApp> {
  const env: TestEnvironment = await startTestEnvironment(overrides);
  const redis = new Redis(TEST_REDIS_URL);
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.emailSender) builder.overrideProvider(EmailSender).useValue(options.emailSender);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ bufferLogs: true });
  configureHttpApp(app);
  await app.init();
  const connection = app.get<Connection>(getConnectionToken());
  const server = () => app.getHttpServer() as Server;
  let counter = 0;

  async function signedInUser(): Promise<Agent> {
    const agent = request.agent(server());
    await agent
      .post('/api/v1/auth/register')
      .send({
        displayName: 'Meera Sharma',
        email: `owner${++counter}.${Date.now()}@example.com`,
        password: 'correct horse battery',
      })
      .expect(201);
    return agent;
  }

  return {
    app,
    connection,
    redis,
    server,
    signedInUser,
    async owner(details = COUPLE) {
      const agent = await signedInUser();
      const response = await agent.post('/api/v1/weddings').send(details).expect(201);
      return { agent, weddingId: response.body.data.id as string };
    },
    async stop() {
      await redis.quit();
      await app.close();
      await env.stop();
    },
  };
}
