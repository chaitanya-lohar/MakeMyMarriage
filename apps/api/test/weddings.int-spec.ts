import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Redis } from 'ioredis';
import { Types, type Connection } from 'mongoose';
import type { Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttpApp } from '../src/bootstrap/configure-http-app.js';
import {
  startTestEnvironment,
  TEST_REDIS_URL,
  type TestEnvironment,
} from './support/test-environment.js';

const COUPLE = { brideName: 'Meera Sharma', groomName: 'Arjun Patel' };

describe('Weddings', () => {
  let env: TestEnvironment;
  let app: INestApplication;
  let redis: Redis;
  let connection: Connection;
  let counter = 0;

  const server = () => app.getHttpServer() as Server;

  /** A signed-in browser for a new user. */
  async function signedInUser() {
    const agent = request.agent(server());
    await agent
      .post('/api/v1/auth/register')
      .send({
        displayName: 'Meera Sharma',
        email: `couple${++counter}.${Date.now()}@example.com`,
        password: 'correct horse battery',
      })
      .expect(201);
    return agent;
  }

  async function userWithWedding(details: Record<string, unknown> = COUPLE) {
    const agent = await signedInUser();
    const response = await agent.post('/api/v1/weddings').send(details).expect(201);
    return { agent, wedding: response.body.data as { id: string } & Record<string, unknown> };
  }

  beforeAll(async () => {
    env = await startTestEnvironment();
    redis = new Redis(TEST_REDIS_URL);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    configureHttpApp(app);
    await app.init();
    connection = app.get<Connection>(getConnectionToken());
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  afterAll(async () => {
    await redis?.quit();
    await app?.close();
    await env?.stop();
  });

  it('requires a signed-in user', async () => {
    await request(server()).get('/api/v1/weddings').expect(401);
    await request(server()).post('/api/v1/weddings').send(COUPLE).expect(401);
  });

  describe('creating a wedding', () => {
    it('starts with no wedding after sign-up', async () => {
      const agent = await signedInUser();
      const response = await agent.get('/api/v1/weddings').expect(200);
      expect(response.body.data).toEqual([]);
    });

    it('needs only the couple and generates the display name', async () => {
      const agent = await signedInUser();
      const created = await agent.post('/api/v1/weddings').send(COUPLE).expect(201);
      expect(created.body.data).toEqual({
        id: expect.any(String),
        displayName: 'Meera Sharma & Arjun Patel',
        brideName: 'Meera Sharma',
        groomName: 'Arjun Patel',
        startDate: null,
        venueName: null,
        primaryCity: null,
        description: null,
        timezone: 'Asia/Kolkata',
      });

      // Reads add the caller's own membership (API Design §6, decision 0035).
      const mine = {
        ...created.body.data,
        membership: { membershipId: expect.any(String), role: 'OWNER', isOwner: true },
      };
      const list = await agent.get('/api/v1/weddings').expect(200);
      expect(list.body.data).toEqual([mine]);
      const one = await agent.get(`/api/v1/weddings/${created.body.data.id}`).expect(200);
      expect(one.body.data).toEqual(mine);
    });

    it('stores every field, trimmed, and treats empty optional fields as not set', async () => {
      const { wedding } = await userWithWedding({
        brideName: '  Meera Sharma ',
        groomName: 'Arjun Patel',
        startDate: '2027-02-18',
        venueName: ' Lakeside Garden ',
        primaryCity: '',
        description: "Two families, one celebration. We can't wait to share it with you.",
      });
      expect(wedding).toMatchObject({
        displayName: 'Meera Sharma & Arjun Patel',
        brideName: 'Meera Sharma',
        startDate: '2027-02-18',
        venueName: 'Lakeside Garden',
        primaryCity: null,
        description: "Two families, one celebration. We can't wait to share it with you.",
      });
    });

    it('allows a date in the past', async () => {
      const { wedding } = await userWithWedding({ ...COUPLE, startDate: '2020-11-21' });
      expect(wedding.startDate).toBe('2020-11-21');
    });

    it('makes the creator the active OWNER', async () => {
      const { wedding } = await userWithWedding();
      const memberships = await connection
        .collection('wedding_memberships')
        .find({ weddingId: new Types.ObjectId(wedding.id) })
        .toArray();
      expect(memberships).toEqual([
        expect.objectContaining({ memberType: 'OWNER', role: 'OWNER', status: 'ACTIVE' }),
      ]);
    });

    it('reports invalid details with the approved messages', async () => {
      const agent = await signedInUser();
      const response = await agent
        .post('/api/v1/weddings')
        .send({
          brideName: '   ',
          groomName: 'A'.repeat(101),
          startDate: '2027-02-30',
          primaryCity: 'C'.repeat(121),
          description: 'D'.repeat(1001),
        })
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.details.fields).toEqual({
        brideName: ["Enter the bride's name."],
        groomName: ['Use 100 characters or fewer.'],
        startDate: ['Enter a valid date.'],
        primaryCity: ['Use 120 characters or fewer.'],
        description: ['Use 1,000 characters or fewer.'],
      });
    });

    it('rejects fields that cannot be set, such as the display name', async () => {
      const agent = await signedInUser();
      const response = await agent
        .post('/api/v1/weddings')
        .send({ ...COUPLE, displayName: 'Something else', timezone: 'UTC' })
        .expect(400);
      expect(Object.keys(response.body.error.details.fields).sort()).toEqual([
        'displayName',
        'timezone',
      ]);
    });

    it('lets a user own only one wedding', async () => {
      const { agent } = await userWithWedding();
      const second = await agent.post('/api/v1/weddings').send(COUPLE).expect(409);
      expect(second.body.error).toMatchObject({
        code: 'WEDDING_ALREADY_OWNED',
        message: 'You already have a wedding. Each account can own one wedding.',
      });
      const list = await agent.get('/api/v1/weddings').expect(200);
      expect(list.body.data).toHaveLength(1);
    });

    it('keeps one wedding when two creates race, rolling the loser back', async () => {
      const agent = await signedInUser();
      const before = await connection.collection('weddings').countDocuments();
      const statuses = await Promise.all(
        [0, 1].map(() => agent.post('/api/v1/weddings').send(COUPLE)),
      ).then((responses) => responses.map((response) => response.status).sort());
      expect(statuses).toEqual([201, 409]);
      expect(await connection.collection('weddings').countDocuments()).toBe(before + 1);
    });
  });

  describe('access', () => {
    it('hides other users’ weddings and invalid IDs behind the same 404', async () => {
      const { wedding } = await userWithWedding();
      const stranger = await signedInUser();

      for (const id of [wedding.id, '000000000000000000000000', 'not-an-id']) {
        const response = await stranger.get(`/api/v1/weddings/${id}`).expect(404);
        expect(response.body.error.code).toBe('WEDDING_NOT_FOUND');
        await stranger.patch(`/api/v1/weddings/${id}`).send({ groomName: 'X' }).expect(404);
      }
      const list = await stranger.get('/api/v1/weddings').expect(200);
      expect(list.body.data).toEqual([]);
    });
  });

  describe('updating a wedding', () => {
    it('changes only the given fields and keeps the display name in step', async () => {
      const { agent, wedding } = await userWithWedding({
        ...COUPLE,
        venueName: 'Lakeside Garden',
        primaryCity: 'Jaipur',
      });
      const response = await agent
        .patch(`/api/v1/weddings/${wedding.id}`)
        .send({ groomName: ' Arjun Mehta ', startDate: '2027-03-01', venueName: null })
        .expect(200);
      expect(response.body.data).toMatchObject({
        displayName: 'Meera Sharma & Arjun Mehta',
        brideName: 'Meera Sharma',
        groomName: 'Arjun Mehta',
        startDate: '2027-03-01',
        venueName: null,
        primaryCity: 'Jaipur',
      });

      const cleared = await agent
        .patch(`/api/v1/weddings/${wedding.id}`)
        .send({ startDate: null, primaryCity: '' })
        .expect(200);
      expect(cleared.body.data).toMatchObject({ startDate: null, primaryCity: null });
    });

    it('requires the names to stay filled in', async () => {
      const { agent, wedding } = await userWithWedding();
      const response = await agent
        .patch(`/api/v1/weddings/${wedding.id}`)
        .send({ brideName: '', groomName: null })
        .expect(400);
      expect(response.body.error.details.fields).toEqual({
        brideName: ["Enter the bride's name."],
        groomName: ["Enter the groom's name."],
      });
    });
  });
});
