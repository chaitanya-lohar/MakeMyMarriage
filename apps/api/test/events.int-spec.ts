import { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startWorkspaceApp, type WorkspaceApp } from './support/workspace-app.js';

const MEHENDI = {
  name: 'Mehendi',
  type: 'MEHENDI',
  date: '2027-02-16',
  startTime: '16:00',
  endTime: '20:00',
  venue: { name: 'Garden Palace', address: 'Amer Road, Jaipur' },
  dressCode: 'Pastels',
  notes: 'Henna artist arrives at 15:00',
};

describe('Events', () => {
  let workspace: WorkspaceApp;

  beforeAll(async () => {
    workspace = await startWorkspaceApp();
  });

  beforeEach(async () => {
    await workspace.redis.flushdb();
  });

  afterAll(async () => {
    await workspace?.stop();
  });

  it('creates an event with every Phase 4 field and takes the wedding timezone', async () => {
    const { agent, weddingId } = await workspace.owner();
    const response = await agent
      .post(`/api/v1/weddings/${weddingId}/events`)
      .send({ ...MEHENDI, name: '  Mehendi ', description: '' })
      .expect(201);
    expect(response.body.data).toEqual({
      id: expect.any(String),
      name: 'Mehendi',
      type: 'MEHENDI',
      date: '2027-02-16',
      startTime: '16:00',
      endTime: '20:00',
      timezone: 'Asia/Kolkata',
      description: null,
      venue: { name: 'Garden Palace', address: 'Amer Road, Jaipur' },
      dressCode: 'Pastels',
      notes: 'Henna artist arrives at 15:00',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    const one = await agent
      .get(`/api/v1/weddings/${weddingId}/events/${response.body.data.id}`)
      .expect(200);
    expect(one.body.data).toEqual(response.body.data);
  });

  it('accepts a past, date-only event and stores no invented time', async () => {
    const { agent, weddingId } = await workspace.owner();
    const response = await agent
      .post(`/api/v1/weddings/${weddingId}/events`)
      .send({ name: 'Roka', type: 'CUSTOM', date: '2020-01-05' })
      .expect(201);
    expect(response.body.data).toMatchObject({
      date: '2020-01-05',
      startTime: null,
      endTime: null,
      venue: { name: null, address: null },
    });
    const stored = await workspace.connection
      .collection('events')
      .findOne({ _id: new Types.ObjectId(response.body.data.id) });
    expect(stored).not.toHaveProperty('startTime');
    expect(stored).not.toHaveProperty('venue');
  });

  it('reports invalid fields with the field messages', async () => {
    const { agent, weddingId } = await workspace.owner();
    const response = await agent
      .post(`/api/v1/weddings/${weddingId}/events`)
      .send({
        name: ' ',
        type: 'HOLI',
        date: '2027-02-30',
        startTime: '4 pm',
        venue: { name: 'V'.repeat(121), address: 'A'.repeat(301) },
        dressCode: 'D'.repeat(121),
        notes: 'N'.repeat(1001),
        description: 'X'.repeat(1001),
      })
      .expect(400);
    expect(response.body.error.details.fields).toEqual({
      name: ['Enter the event name.'],
      type: ['Choose an event type.'],
      date: ['Enter a valid date.'],
      startTime: ['Enter a time as HH:mm.'],
      'venue.name': ['Use 120 characters or fewer.'],
      'venue.address': ['Use 300 characters or fewer.'],
      dressCode: ['Use 120 characters or fewer.'],
      notes: ['Use 1,000 characters or fewer.'],
      description: ['Use 1,000 characters or fewer.'],
    });
  });

  it('needs a start time before an end time, and the end later the same day', async () => {
    const { agent, weddingId } = await workspace.owner();
    const base = { name: 'Sangeet', type: 'SANGEET', date: '2027-02-17' };
    const noStart = await agent
      .post(`/api/v1/weddings/${weddingId}/events`)
      .send({ ...base, endTime: '22:00' })
      .expect(400);
    expect(noStart.body.error.details.fields).toEqual({
      endTime: ['Add a start time before an end time.'],
    });
    const before = await agent
      .post(`/api/v1/weddings/${weddingId}/events`)
      .send({ ...base, startTime: '19:00', endTime: '01:00' })
      .expect(400);
    expect(before.body.error.details.fields).toEqual({
      endTime: ['The end time must be after the start time.'],
    });

    // The rule applies to the event as it will be saved, including partial updates.
    const created = await agent
      .post(`/api/v1/weddings/${weddingId}/events`)
      .send({ ...base, startTime: '19:00', endTime: '23:00' })
      .expect(201);
    const cleared = await agent
      .patch(`/api/v1/weddings/${weddingId}/events/${created.body.data.id}`)
      .send({ startTime: null })
      .expect(400);
    expect(cleared.body.error.details.fields).toEqual({
      endTime: ['Add a start time before an end time.'],
    });
  });

  it('lists by date then start time, with untimed events first on their day', async () => {
    const { agent, weddingId } = await workspace.owner();
    const create = (body: Record<string, unknown>) =>
      agent.post(`/api/v1/weddings/${weddingId}/events`).send(body).expect(201);
    await create({ name: 'Reception', type: 'RECEPTION', date: '2027-02-19', startTime: '19:30' });
    await create({ name: 'Sangeet', type: 'SANGEET', date: '2027-02-17', startTime: '19:00' });
    await create({ name: 'Wedding', type: 'WEDDING', date: '2027-02-18' });
    await create({ name: 'Haldi', type: 'HALDI', date: '2027-02-17', startTime: '10:00' });
    await create({ name: 'Puja', type: 'CUSTOM', date: '2027-02-17' });

    const list = await agent.get(`/api/v1/weddings/${weddingId}/events`).expect(200);
    const names = (list.body.data as { name: string }[]).map((event) => event.name);
    expect(names).toEqual(['Puja', 'Haldi', 'Sangeet', 'Wedding', 'Reception']);
  });

  it('updates only the given fields; null clears them, venue fields one by one', async () => {
    const { agent, weddingId } = await workspace.owner();
    const created = await agent
      .post(`/api/v1/weddings/${weddingId}/events`)
      .send(MEHENDI)
      .expect(201);
    const url = `/api/v1/weddings/${weddingId}/events/${created.body.data.id}`;

    const updated = await agent
      .patch(url)
      .send({ name: 'Mehendi Night', venue: { address: null }, dressCode: null, endTime: '21:00' })
      .expect(200);
    expect(updated.body.data).toMatchObject({
      name: 'Mehendi Night',
      type: 'MEHENDI',
      startTime: '16:00',
      endTime: '21:00',
      venue: { name: 'Garden Palace', address: null },
      dressCode: null,
      notes: 'Henna artist arrives at 15:00',
    });

    const venueCleared = await agent.patch(url).send({ venue: null }).expect(200);
    expect(venueCleared.body.data.venue).toEqual({ name: null, address: null });
  });

  it('soft-deletes an event: gone from reads, kept in the database', async () => {
    const { agent, weddingId } = await workspace.owner();
    const created = await agent
      .post(`/api/v1/weddings/${weddingId}/events`)
      .send(MEHENDI)
      .expect(201);
    const url = `/api/v1/weddings/${weddingId}/events/${created.body.data.id}`;

    await agent.delete(url).expect(204);
    const gone = await agent.get(url).expect(404);
    expect(gone.body.error.code).toBe('EVENT_NOT_FOUND');
    await agent.patch(url).send({ name: 'X' }).expect(404);
    await agent.delete(url).expect(404);
    const list = await agent.get(`/api/v1/weddings/${weddingId}/events`).expect(200);
    expect(list.body.data).toEqual([]);

    const stored = await workspace.connection
      .collection('events')
      .findOne({ _id: new Types.ObjectId(created.body.data.id) });
    expect(stored).toMatchObject({ name: 'Mehendi', deletedAt: expect.any(Date) });
  });

  it('keeps each wedding’s events private', async () => {
    const { agent, weddingId } = await workspace.owner();
    const created = await agent
      .post(`/api/v1/weddings/${weddingId}/events`)
      .send(MEHENDI)
      .expect(201);
    const eventId = created.body.data.id as string;
    const other = await workspace.owner();

    // A stranger cannot reach the wedding at all.
    const stranger = await workspace.signedInUser();
    const hidden = await stranger.get(`/api/v1/weddings/${weddingId}/events`).expect(404);
    expect(hidden.body.error.code).toBe('WEDDING_NOT_FOUND');

    // Another owner cannot use the event ID through their own wedding.
    for (const id of [eventId, 'not-an-id']) {
      const response = await other.agent
        .get(`/api/v1/weddings/${other.weddingId}/events/${id}`)
        .expect(404);
      expect(response.body.error.code).toBe('EVENT_NOT_FOUND');
      await other.agent
        .patch(`/api/v1/weddings/${other.weddingId}/events/${id}`)
        .send({ name: 'X' })
        .expect(404);
      await other.agent.delete(`/api/v1/weddings/${other.weddingId}/events/${id}`).expect(404);
    }
    await agent.get(`/api/v1/weddings/${weddingId}/events/${eventId}`).expect(200);
  });

  it('requires a signed-in user', async () => {
    const { weddingId } = await workspace.owner();
    await request(workspace.server()).get(`/api/v1/weddings/${weddingId}/events`).expect(401);
  });
});
