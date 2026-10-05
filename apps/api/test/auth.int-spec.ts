import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import type { Connection } from 'mongoose';
import type { Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttpApp } from '../src/bootstrap/configure-http-app.js';
import type { EmailMessage } from '../src/infrastructure/email/email-message.js';
import { QueueName } from '../src/infrastructure/queue/queue-names.js';
import {
  startTestEnvironment,
  TEST_REDIS_URL,
  type TestEnvironment,
} from './support/test-environment.js';

const PASSWORD = 'correct horse battery';

interface ParsedCookie {
  name: string;
  value: string;
  attributes: string[];
}

function cookiesOf(response: request.Response): ParsedCookie[] {
  const header = response.headers['set-cookie'] as unknown as string[] | undefined;
  return (header ?? []).map((raw) => {
    const [pair = '', ...attributes] = raw.split(';').map((part) => part.trim());
    const [name = '', value = ''] = pair.split('=');
    return { name, value, attributes: attributes.map((a) => a.toLowerCase()) };
  });
}

function cookie(response: request.Response, name: string): ParsedCookie | undefined {
  return cookiesOf(response).find((c) => c.name === name);
}

/** Max-Age of the refresh cookie, in seconds. */
function maxAgeOf(response: request.Response): number {
  const attribute = cookie(response, 'mmm_rt')?.attributes.find((a) => a.startsWith('max-age='));
  return Number(attribute?.slice('max-age='.length));
}

describe('Authentication', () => {
  let env: TestEnvironment;
  let app: INestApplication;
  let redis: Redis;
  let emailQueue: Queue<EmailMessage>;
  let connection: Connection;
  let counter = 0;

  const server = () => app.getHttpServer() as Server;
  const uniqueEmail = () => `user${++counter}.${Date.now()}@example.com`;

  async function register(email = uniqueEmail(), agent = request.agent(server())) {
    const response = await agent
      .post('/api/v1/auth/register')
      .send({ displayName: 'Priya Sharma', email, password: PASSWORD })
      .expect(201);
    return { agent, email, response };
  }

  async function resetEmailFor(email: string): Promise<EmailMessage | undefined> {
    const jobs = await emailQueue.getJobs(['waiting', 'delayed', 'prioritized']);
    return jobs.map((job) => job.data).find((message) => message.to === email);
  }

  function tokenFrom(message: EmailMessage): string {
    const match = /reset-password\?token=([A-Za-z0-9_-]+)/.exec(message.text);
    if (!match?.[1]) throw new Error('No reset link in email');
    return match[1];
  }

  beforeAll(async () => {
    env = await startTestEnvironment();
    redis = new Redis(TEST_REDIS_URL);
    emailQueue = new Queue(QueueName.Email, { connection: { url: TEST_REDIS_URL } });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    configureHttpApp(app);
    await app.init();
    connection = app.get<Connection>(getConnectionToken());
  });

  beforeEach(async () => {
    // Database 15 is reserved for tests (test-environment.ts).
    await redis.flushdb();
  });

  afterAll(async () => {
    await emailQueue?.close();
    await redis?.quit();
    await app?.close();
    await env?.stop();
  });

  describe('sign-up', () => {
    it('creates the account, signs it in with a browser session and serves /me', async () => {
      const { agent, email, response } = await register();

      expect(response.body.data.user).toMatchObject({ email, displayName: 'Priya Sharma' });
      expect(response.body.data.user).not.toHaveProperty('passwordHash');

      const access = cookie(response, 'mmm_at');
      const refresh = cookie(response, 'mmm_rt');
      expect(access?.attributes).toEqual(
        expect.arrayContaining(['httponly', 'samesite=lax', 'path=/']),
      );
      expect(refresh?.attributes).toEqual(
        expect.arrayContaining(['httponly', 'samesite=lax', 'path=/api/v1/auth']),
      );
      // Not remembered: the refresh cookie ends with the browser session.
      expect(
        refresh?.attributes.some((a) => a.startsWith('max-age') || a.startsWith('expires')),
      ).toBe(false);

      const me = await agent.get('/api/v1/me').expect(200);
      expect(me.body.data.user.email).toBe(email);
    });

    it('rejects an email that is already registered, regardless of case', async () => {
      const { email } = await register();
      const response = await request(server())
        .post('/api/v1/auth/register')
        .send({ displayName: 'Someone', email: email.toUpperCase(), password: PASSWORD })
        .expect(409);
      expect(response.body.error).toMatchObject({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'An account with this email already exists. Sign in or reset your password.',
      });
    });

    it('enforces the password rule and rejects unknown fields', async () => {
      const short = await request(server())
        .post('/api/v1/auth/register')
        .send({ displayName: 'Priya', email: uniqueEmail(), password: 'short' })
        .expect(400);
      expect(short.body.error.details.fields).toHaveProperty('password');

      const extra = await request(server())
        .post('/api/v1/auth/register')
        .send({ displayName: 'Priya', email: uniqueEmail(), password: PASSWORD, role: 'OWNER' })
        .expect(400);
      expect(extra.body.error.details.fields).toHaveProperty('role');
    });
  });

  describe('protected routes', () => {
    it('require a session', async () => {
      const response = await request(server()).get('/api/v1/me').expect(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('reject a tampered access token', async () => {
      await request(server())
        .get('/api/v1/me')
        .set('cookie', 'mmm_at=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.forged')
        .expect(401);
    });
  });

  describe('sign-in', () => {
    it('returns the same error for a wrong password and an unknown email', async () => {
      const { email } = await register();
      const wrongPassword = await request(server())
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrong password' })
        .expect(401);
      const unknownEmail = await request(server())
        .post('/api/v1/auth/login')
        .send({ email: uniqueEmail(), password: PASSWORD })
        .expect(401);
      expect(wrongPassword.body.error).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials. Please verify your email and try again.',
      });
      expect(unknownEmail.body.error.code).toBe(wrongPassword.body.error.code);
      expect(unknownEmail.body.error.message).toBe(wrongPassword.body.error.message);
    });

    it('keeps a remembered session for 30 days', async () => {
      const { email } = await register();
      const response = await request(server())
        .post('/api/v1/auth/login')
        .send({ email: email.toUpperCase(), password: PASSWORD, rememberMe: true })
        .expect(200);
      expect(maxAgeOf(response)).toBeGreaterThan(30 * 24 * 60 * 60 - 5);
      expect(maxAgeOf(response)).toBeLessThanOrEqual(30 * 24 * 60 * 60);
    });

    it('counts parallel failed attempts atomically', async () => {
      const { email } = await register();
      const statuses = await Promise.all(
        Array.from({ length: 12 }, () =>
          request(server()).post('/api/v1/auth/login').send({ email, password: 'wrong password' }),
        ),
      ).then((responses) => responses.map((response) => response.status));
      expect(statuses.filter((status) => status === 401)).toHaveLength(5);
      expect(statuses.filter((status) => status === 429)).toHaveLength(7);
    });

    it('blocks an email after 5 failed attempts in 15 minutes, even with the right password', async () => {
      const { email } = await register();
      for (let attempt = 0; attempt < 5; attempt++) {
        await request(server())
          .post('/api/v1/auth/login')
          .send({ email, password: 'wrong password' })
          .expect(401);
      }
      const blocked = await request(server())
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD })
        .expect(429);
      expect(blocked.body.error).toMatchObject({
        code: 'RATE_LIMITED',
        message: 'Too many attempts. Please wait a few minutes and try again.',
      });
    });
  });

  describe('session refresh and sign-out', () => {
    it('rotates the refresh token, so an old one stops working', async () => {
      const { response } = await register();
      const firstRefresh = cookie(response, 'mmm_rt')?.value ?? '';

      const refreshed = await request(server())
        .post('/api/v1/auth/refresh')
        .set('cookie', `mmm_rt=${firstRefresh}`)
        .expect(200);
      expect(refreshed.body.data.user.displayName).toBe('Priya Sharma');
      expect(cookie(refreshed, 'mmm_rt')?.value).not.toBe(firstRefresh);

      // The session is still active (another tab may hold the new token), so this
      // response must not clear the browser's cookies.
      const stale = await request(server())
        .post('/api/v1/auth/refresh')
        .set('cookie', `mmm_rt=${firstRefresh}`)
        .expect(401);
      expect(cookiesOf(stale)).toEqual([]);
    });

    it('lets only one of two parallel refreshes rotate, without signing the browser out', async () => {
      const { response } = await register();
      const token = cookie(response, 'mmm_rt')?.value ?? '';

      const [first, second] = await Promise.all(
        [0, 1].map(() =>
          request(server()).post('/api/v1/auth/refresh').set('cookie', `mmm_rt=${token}`),
        ),
      );
      const statuses = [first?.status, second?.status].sort();
      expect(statuses).toEqual([200, 401]);
      const loser = first?.status === 401 ? first : second;
      expect(cookiesOf(loser as request.Response)).toEqual([]);
    });

    it('never extends a remembered session when refreshing', async () => {
      const { email } = await register();
      const login = await request(server())
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD, rememberMe: true })
        .expect(200);

      // Move the session to its last day.
      const oneDayMs = 24 * 60 * 60 * 1000;
      await connection.collection('auth_sessions').updateMany(
        {},
        {
          $set: {
            createdAt: new Date(Date.now() - 29 * oneDayMs),
            expiresAt: new Date(Date.now() + oneDayMs),
          },
        },
      );

      const refreshed = await request(server())
        .post('/api/v1/auth/refresh')
        .set('cookie', `mmm_rt=${cookie(login, 'mmm_rt')?.value ?? ''}`)
        .expect(200);
      expect(maxAgeOf(refreshed)).toBeGreaterThan(24 * 60 * 60 - 5);
      expect(maxAgeOf(refreshed)).toBeLessThanOrEqual(24 * 60 * 60);
    });

    it('signs out: the session is revoked and the cookies are cleared', async () => {
      const { agent, response } = await register();
      const refreshToken = cookie(response, 'mmm_rt')?.value ?? '';

      const logout = await agent.post('/api/v1/auth/logout').expect(204);
      expect(cookie(logout, 'mmm_at')?.value).toBe('');

      await agent.get('/api/v1/me').expect(401);
      // The session has ended, so a refresh attempt also clears the cookies.
      const ended = await request(server())
        .post('/api/v1/auth/refresh')
        .set('cookie', `mmm_rt=${refreshToken}`)
        .expect(401);
      expect(cookie(ended, 'mmm_rt')?.value).toBe('');
    });
  });

  describe('password reset', () => {
    it('responds identically for unknown emails and sends nothing', async () => {
      const email = uniqueEmail();
      const response = await request(server())
        .post('/api/v1/auth/forgot-password')
        .send({ email })
        .expect(202);
      expect(response.body.data).toBeNull();
      expect(await resetEmailFor(email)).toBeUndefined();
    });

    it('emails a single-use link that sets a new password and signs out everywhere', async () => {
      const { email, response } = await register();
      const oldRefresh = cookie(response, 'mmm_rt')?.value ?? '';

      await request(server()).post('/api/v1/auth/forgot-password').send({ email }).expect(202);
      const message = await resetEmailFor(email);
      expect(message?.subject).toBe('Reset your MakeMyMarriage password');
      expect(message?.text).toContain('expires in 60 minutes');
      const token = tokenFrom(message as EmailMessage);

      await request(server())
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'a brand new password' })
        .expect(204);

      // Every existing session is revoked.
      await request(server())
        .post('/api/v1/auth/refresh')
        .set('cookie', `mmm_rt=${oldRefresh}`)
        .expect(401);

      await request(server())
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD })
        .expect(401);
      await request(server())
        .post('/api/v1/auth/login')
        .send({ email, password: 'a brand new password' })
        .expect(200);

      const reused = await request(server())
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'another new password' })
        .expect(400);
      expect(reused.body.error).toMatchObject({
        code: 'RESET_TOKEN_INVALID',
        message: 'This link has expired or has already been used.',
      });
    });

    it('lifts a sign-in lockout once the password is reset', async () => {
      const { email } = await register();
      for (let attempt = 0; attempt < 5; attempt++) {
        await request(server())
          .post('/api/v1/auth/login')
          .send({ email, password: 'wrong password' })
          .expect(401);
      }
      await request(server()).post('/api/v1/auth/forgot-password').send({ email }).expect(202);
      const token = tokenFrom((await resetEmailFor(email)) as EmailMessage);
      await request(server())
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'a brand new password' })
        .expect(204);

      await request(server())
        .post('/api/v1/auth/login')
        .send({ email, password: 'a brand new password' })
        .expect(200);
    });

    it('rejects an expired link', async () => {
      const { email } = await register();
      await request(server()).post('/api/v1/auth/forgot-password').send({ email }).expect(202);
      const token = tokenFrom((await resetEmailFor(email)) as EmailMessage);

      await connection
        .collection('password_reset_tokens')
        .updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });

      const response = await request(server())
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'a brand new password' })
        .expect(400);
      expect(response.body.error.code).toBe('RESET_TOKEN_INVALID');
    });

    it('limits reset requests to 3 per email per hour', async () => {
      const email = uniqueEmail();
      for (let attempt = 0; attempt < 3; attempt++) {
        await request(server()).post('/api/v1/auth/forgot-password').send({ email }).expect(202);
      }
      await request(server()).post('/api/v1/auth/forgot-password').send({ email }).expect(429);
    });
  });

  it('never stores raw tokens or passwords', async () => {
    const { email, response } = await register();
    await request(server()).post('/api/v1/auth/forgot-password').send({ email }).expect(202);
    const resetToken = tokenFrom((await resetEmailFor(email)) as EmailMessage);
    const refreshSecret = (cookie(response, 'mmm_rt')?.value ?? '').split('.')[1] ?? '';

    const dump = JSON.stringify([
      await connection.collection('users').find({ email }).toArray(),
      await connection.collection('auth_sessions').find({}).toArray(),
      await connection.collection('password_reset_tokens').find({}).toArray(),
    ]);
    expect(dump).not.toContain(PASSWORD);
    expect(dump).not.toContain(resetToken);
    expect(dump).not.toContain(refreshSecret);
    expect(dump).toContain('$argon2id$');
  });
});
