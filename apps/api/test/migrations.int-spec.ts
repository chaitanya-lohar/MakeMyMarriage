import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import mongoose, { Types, type Connection } from 'mongoose';
import request from 'supertest';
import type { Server } from 'node:http';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttpApp } from '../src/bootstrap/configure-http-app.js';
import { OWNER_SEAT_INDEX } from '../src/infrastructure/database/migrations/001-owner-seats.js';
import {
  MIGRATIONS,
  MigrationDataError,
  runPendingMigrations,
  SCHEMA_MIGRATIONS,
} from '../src/infrastructure/database/migrations/index.js';
import { startTestEnvironment, type TestEnvironment } from './support/test-environment.js';

const DUPLICATE_KEY = 11000;
const silent = () => {};

interface Row {
  _id: Types.ObjectId;
  weddingId: Types.ObjectId;
  userId: Types.ObjectId;
  memberType: string;
  role: string;
  status: string;
  ownerSeat?: number;
  createdAt: Date;
}

function row(overrides: Partial<Row> = {}): Row {
  return {
    _id: new Types.ObjectId(),
    weddingId: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    memberType: 'OWNER',
    role: 'OWNER',
    status: 'ACTIVE',
    createdAt: new Date(),
    ...overrides,
  };
}

const member = (weddingId: Types.ObjectId, role = 'ORGANIZER') =>
  row({ weddingId, memberType: 'MEMBER', role });

/** Migration 001 — owner seats (decision 0034), on the raw collections. No Redis needed. */
describe('data migration 001-owner-seats', () => {
  let env: TestEnvironment;
  let connection: Connection;
  const db = () => connection.db!;
  const memberships = () => db().collection<Row>('wedding_memberships');
  const migrate = () => runPendingMigrations(db(), MIGRATIONS, silent);
  const ownerSeatIndex = async () =>
    (await memberships().indexes()).find((index) => index.name === OWNER_SEAT_INDEX);
  const snapshot = async () => ({
    rows: await memberships().find().sort({ _id: 1 }).toArray(),
    indexes: (await memberships().indexes()).map((index) => index.name),
    migrations: await db().collection(SCHEMA_MIGRATIONS).find().toArray(),
  });

  beforeAll(async () => {
    env = await startTestEnvironment();
    connection = await mongoose.createConnection(env.mongo.getUri('migrations_test')).asPromise();
  });

  afterEach(async () => {
    await db().dropDatabase();
  });

  afterAll(async () => {
    await connection.close();
    await env.stop();
  });

  it('gives each existing owner seat 1, leaves other rows alone and records itself', async () => {
    const first = row();
    const second = row();
    await memberships().insertMany([first, second, member(first.weddingId)]);

    await expect(migrate()).resolves.toEqual(['001-owner-seats']);

    const rows = await memberships().find().toArray();
    expect(rows.filter((r) => r.memberType === 'OWNER').map((r) => r.ownerSeat)).toEqual([1, 1]);
    expect(rows.find((r) => r.memberType === 'MEMBER')).not.toHaveProperty('ownerSeat');
    const records = await db().collection(SCHEMA_MIGRATIONS).find().toArray();
    expect(records).toEqual([{ _id: '001-owner-seats', appliedAt: expect.any(Date) }]);
  });

  it('creates the partial unique owner_seat_per_wedding index', async () => {
    await memberships().insertOne(row());
    await migrate();
    expect(await ownerSeatIndex()).toMatchObject({
      key: { weddingId: 1, ownerSeat: 1 },
      unique: true,
      partialFilterExpression: { memberType: 'OWNER' },
    });
  });

  it('is idempotent: a second run, or a re-run of the migration itself, changes nothing', async () => {
    await memberships().insertMany([row(), row()]);
    await migrate();
    const after = await snapshot();

    await expect(migrate()).resolves.toEqual([]);
    expect(await snapshot()).toEqual(after);

    await db().collection(SCHEMA_MIGRATIONS).deleteMany({});
    await expect(migrate()).resolves.toEqual(['001-owner-seats']);
    expect((await snapshot()).rows).toEqual(after.rows);
  });

  it('runs on an empty database', async () => {
    await expect(migrate()).resolves.toEqual(['001-owner-seats']);
    expect(await ownerSeatIndex()).toBeDefined();
  });

  it('fits two owners on seats 1 and 2 and refuses a third owner', async () => {
    const first = row();
    await memberships().insertMany([first, member(first.weddingId)]);
    await migrate();

    // A second owner (the partner, Phase 16) takes the free seat.
    await memberships().insertOne(row({ weddingId: first.weddingId, ownerSeat: 2 }));
    // A third cannot: both seats are taken.
    for (const ownerSeat of [1, 2]) {
      await expect(
        memberships().insertOne(row({ weddingId: first.weddingId, ownerSeat })),
      ).rejects.toMatchObject({ code: DUPLICATE_KEY });
    }
    // Members hold no seat, so they are not limited by the index.
    await memberships().insertOne(member(first.weddingId, 'VIEWER'));
    // A new wedding's first owner still takes seat 1.
    await memberships().insertOne(row({ ownerSeat: 1 }));
  });

  it('stops on inconsistent data, reports every case and changes nothing', async () => {
    const sharedWedding = new Types.ObjectId();
    const sharedUser = new Types.ObjectId();
    const mismatched = row({ role: 'ADMIN' });
    const revoked = row({ status: 'REVOKED' });
    await memberships().insertMany([
      row(),
      mismatched,
      revoked,
      row({ weddingId: sharedWedding }),
      row({ weddingId: sharedWedding }),
      row({ userId: sharedUser }),
      row({ userId: sharedUser }),
    ]);
    const before = await snapshot();

    const error = await migrate().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MigrationDataError);
    const { problems } = error as MigrationDataError;
    expect(problems).toHaveLength(4);
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining(mismatched._id.toHexString()),
        expect.stringContaining(revoked._id.toHexString()),
        expect.stringContaining(`wedding ${sharedWedding.toHexString()} has 2 owner rows`),
        expect.stringContaining(`user ${sharedUser.toHexString()}`),
      ]),
    );

    // Nothing written: no seat, no index, no migration record.
    expect(await snapshot()).toEqual(before);
    expect(await ownerSeatIndex()).toBeUndefined();
  });
});

/** Start-up in local and test: migrations first, then the indexes (Database Design §30). */
describe('database set-up at start-up', () => {
  let env: TestEnvironment;
  let app: INestApplication;
  let connection: Connection;
  const legacyOwner = row();

  beforeEach(async () => {
    env = await startTestEnvironment();
    // A database from before Phase 10: an owner row without a seat.
    const seed = await mongoose.createConnection(process.env.MONGODB_URI!).asPromise();
    await seed.db!.collection('wedding_memberships').insertOne(legacyOwner);
    await seed.close();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    configureHttpApp(app);
    await app.init();
    connection = app.get<Connection>(getConnectionToken());
  });

  afterEach(async () => {
    await app.close();
    await env.stop();
  });

  it('backfills the seat before creating the owner-seat index', async () => {
    const memberships = connection.db!.collection<Row>('wedding_memberships');
    expect((await memberships.findOne({ _id: legacyOwner._id }))?.ownerSeat).toBe(1);
    const names = (await memberships.indexes()).map((index) => index.name);
    expect(names).toEqual(
      expect.arrayContaining([
        OWNER_SEAT_INDEX,
        'one_owner_membership_per_user',
        'weddingId_1_status_1_role_1',
      ]),
    );
  });

  it('gives a new wedding’s creator seat 1', async () => {
    const agent = request.agent(app.getHttpServer() as Server);
    await agent
      .post('/api/v1/auth/register')
      .send({ displayName: 'Meera', email: 'meera@example.com', password: 'correct horse battery' })
      .expect(201);
    const created = await agent
      .post('/api/v1/weddings')
      .send({ brideName: 'Meera Sharma', groomName: 'Arjun Patel' })
      .expect(201);

    const owner = await connection.db!.collection<Row>('wedding_memberships').findOne({
      weddingId: new Types.ObjectId(created.body.data.id as string),
    });
    expect(owner).toMatchObject({ memberType: 'OWNER', role: 'OWNER', ownerSeat: 1 });
  });
});
