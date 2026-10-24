import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { todayIn } from '../src/modules/weddings/index.js';
import { restoreClock, startClockAtNoonInIndia } from './support/noon-in-india.js';
import { startWorkspaceApp, type WorkspaceApp } from './support/workspace-app.js';

const day = (offset: number) => {
  const [y, m, d] = todayIn('Asia/Kolkata').split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
};
type Vendor = Record<string, unknown> & { id: string };
type Booking = Record<string, unknown> & { id: string };

describe('Vendors (Phase 9, decisions 0032–0033)', () => {
  let workspace: WorkspaceApp;
  beforeAll(async () => {
    workspace = await startWorkspaceApp();
    startClockAtNoonInIndia();
  });
  beforeEach(async () => {
    await workspace.redis.flushdb();
  });
  afterAll(async () => {
    restoreClock();
    await workspace?.stop();
  });

  async function setup() {
    const { agent, weddingId } = await workspace.owner();
    const base = `/api/v1/weddings/${weddingId}`;
    const vendor = async (name = 'Aster Photography') =>
      (
        await agent
          .post(`${base}/vendors`)
          .send({ name, category: 'PHOTOGRAPHY_VIDEOGRAPHY' })
          .expect(201)
      ).body.data as Vendor;
    const booking = async (vendorId: string, body: Record<string, unknown> = {}) =>
      (
        await agent
          .post(`${base}/vendors/${vendorId}/bookings`)
          .send({ title: 'Wedding photography', ...body })
          .expect(201)
      ).body.data as Booking;
    return { agent, weddingId, base, vendor, booking };
  }

  it('creates wedding-scoped vendors and bookings, counts statuses, and has no booking delete route', async () => {
    const { agent, base, vendor, booking } = await setup();
    const v = await vendor();
    const first = await booking(v.id, { status: 'CANCELLED', serviceDate: day(2) });
    const second = await booking(v.id, {
      status: 'BOOKED',
      serviceDate: day(4),
      agreedPriceMinor: 2500000,
    });
    const list = (await agent.get(`${base}/vendors`).expect(200)).body.data as Array<
      Vendor & { bookingCounts: Record<string, number> }
    >;
    expect(list[0]?.bookingCounts).toMatchObject({ booked: 1, cancelled: 1, inProgress: 0 });
    expect(
      (await agent.get(`${base}/vendors/${v.id}/bookings`).expect(200)).body.data.map(
        (b: Booking) => b.id,
      ),
    ).toEqual([first.id, second.id]);
    await agent
      .patch(`${base}/vendors/${v.id}/bookings/${first.id}`)
      .send({ status: 'NEGOTIATING' })
      .expect(200);
    await agent.delete(`${base}/vendors/${v.id}/bookings/${first.id}`).expect(404);
  });

  it('validates profile and booking limits and supports partial vendor edits', async () => {
    const { agent, base, vendor, booking } = await setup();
    await agent
      .post(`${base}/vendors`)
      .send({ name: 'x'.repeat(151), category: 'OTHER' })
      .expect(400);
    await agent
      .post(`${base}/vendors`)
      .send({ name: 'Invalid phone', category: 'OTHER', phone: '123' })
      .expect(400);
    const v = await vendor();
    const updated = await agent
      .patch(`${base}/vendors/${v.id}`)
      .send({ notes: 'Updated notes' })
      .expect(200);
    expect(updated.body.data).toMatchObject({ name: v.name, notes: 'Updated notes' });
    await agent
      .post(`${base}/vendors/${v.id}/bookings`)
      .send({ title: 'Large price', agreedPriceMinor: 10_000_000_001 })
      .expect(400);
    const b = await booking(v.id, { status: 'BOOKED' });
    await agent
      .patch(`${base}/vendors/${v.id}/bookings/${b.id}`)
      .send({ serviceDate: '2027-02-30' })
      .expect(400);
  });

  it('combines booking filters on one booking and keeps name cursors stable', async () => {
    const { agent, base, vendor, booking } = await setup();
    const event = (
      await agent
        .post(`${base}/events`)
        .send({ name: 'Sangeet', type: 'SANGEET', date: day(5) })
        .expect(201)
    ).body.data as { id: string };
    const split = await vendor('Alpha');
    await booking(split.id, { status: 'BOOKED' });
    await booking(split.id, { status: 'CONTACTED', eventId: event.id });
    const match = await vendor('Bravo');
    await booking(match.id, { status: 'BOOKED', eventId: event.id });
    const filtered = await agent
      .get(`${base}/vendors?bookingStatus=BOOKED&eventId=${event.id}`)
      .expect(200);
    expect(filtered.body.data.map((v: Vendor) => v.id)).toEqual([match.id]);
    const first = await agent.get(`${base}/vendors?limit=1`).expect(200);
    const nextCursor = first.body.meta.pagination.nextCursor as string;
    expect(first.body.data[0].name).toBe('Alpha');
    const next = await agent.get(`${base}/vendors?limit=1&cursor=${nextCursor}`).expect(200);
    expect(next.body.data[0].name).toBe('Bravo');
  });

  it('hides vendors and bookings across wedding boundaries', async () => {
    const first = await setup();
    const vendor = await first.vendor();
    const second = await workspace.owner();
    const otherBase = `/api/v1/weddings/${second.weddingId}`;
    await second.agent.get(`${otherBase}/vendors/${vendor.id}`).expect(404);
    await second.agent.get(`${otherBase}/vendors/${vendor.id}/bookings`).expect(404);
    await first.agent.get(`${otherBase}/vendors`).expect(404);
  });

  it('serializes booking creation against vendor deletion', async () => {
    const { agent, base, vendor } = await setup();
    const v = await vendor();
    const [create, remove] = await Promise.all([
      agent
        .post(`${base}/vendors/${v.id}/bookings`)
        .send({ title: 'Race booking', status: 'BOOKED' }),
      agent.delete(`${base}/vendors/${v.id}`),
    ]);
    expect([201, 404].includes(create.status)).toBe(true);
    expect([204, 409, 404].includes(remove.status)).toBe(true);
    const storedVendor = await workspace.connection
      .collection('wedding_vendors')
      .findOne({ _id: new Types.ObjectId(v.id) });
    const activeBookings = await workspace.connection
      .collection('vendor_bookings')
      .countDocuments({ vendorId: new Types.ObjectId(v.id), status: { $ne: 'CANCELLED' } });
    expect(storedVendor?.deletedAt ? activeBookings : true).toBeTruthy();
  });

  it('refuses vendor deletion while a booking is active and permits it after cancellation', async () => {
    const { agent, base, vendor, booking } = await setup();
    const v = await vendor();
    const b = await booking(v.id, { status: 'BOOKED' });
    const refused = await agent.delete(`${base}/vendors/${v.id}`).expect(409);
    expect(refused.body.error.code).toBe('VENDOR_HAS_ACTIVE_BOOKINGS');
    expect(refused.body.error.details.activeBookings).toEqual([
      expect.objectContaining({ title: 'Wedding photography', status: 'BOOKED' }),
    ]);
    await agent
      .patch(`${base}/vendors/${v.id}/bookings/${b.id}`)
      .send({ status: 'CANCELLED' })
      .expect(200);
    await agent.delete(`${base}/vendors/${v.id}`).expect(204);
    await agent.get(`${base}/vendors/${v.id}`).expect(404);
    await agent.get(`${base}/vendors/${v.id}/bookings`).expect(404);
  });

  it('unlinks event bookings during event deletion and records an audit entry', async () => {
    const { agent, base, vendor, booking } = await setup();
    const v = await vendor();
    const event = (
      await agent
        .post(`${base}/events`)
        .send({ name: 'Sangeet', type: 'SANGEET', date: day(5) })
        .expect(201)
    ).body.data as { id: string };
    const b = await booking(v.id, { eventId: event.id, status: 'BOOKED' });
    await agent.delete(`${base}/events/${event.id}`).expect(204);
    const after = (await agent.get(`${base}/vendors/${v.id}/bookings/${b.id}`).expect(200)).body
      .data as Booking;
    expect(after.eventId).toBeNull();
    const audit = await workspace.connection
      .collection('audit_logs')
      .find({ resourceId: new Types.ObjectId(b.id), action: 'VENDOR_BOOKING_EVENT_UNLINKED' })
      .toArray();
    expect(audit).toHaveLength(1);
  });

  it('keeps an expense vendor link after vendor deletion and returns the deleted vendor name', async () => {
    const { agent, base, vendor, booking } = await setup();
    const v = await vendor();
    const b = await booking(v.id, { status: 'CANCELLED' });
    const expense = (
      await agent
        .post(`${base}/expenses`)
        .send({
          title: 'Photo advance',
          amountMinor: 100000,
          category: 'PHOTOGRAPHY',
          expenseDate: day(0),
          vendorId: v.id,
        })
        .expect(201)
    ).body.data as Record<string, unknown> & { id: string };
    await agent.delete(`${base}/vendors/${v.id}`).expect(204);
    const update = await agent
      .patch(`${base}/expenses/${expense.id}`)
      .send({ notes: 'Keep the old vendor link' })
      .expect(200);
    expect(update.body.data).toMatchObject({
      vendorId: v.id,
      vendorName: v.name,
      vendorDeleted: true,
    });
    expect(b.status).toBe('CANCELLED');
  });

  it('summarizes follow-up and future booked services using the wedding timezone', async () => {
    const { agent, base, vendor, booking } = await setup();
    const v = await vendor();
    await booking(v.id, { status: 'QUOTATION_RECEIVED' });
    await booking(v.id, { status: 'NEGOTIATING' });
    const event = (
      await agent
        .post(`${base}/events`)
        .send({ name: 'Reception', type: 'RECEPTION', date: day(3) })
        .expect(201)
    ).body.data as { id: string };
    await booking(v.id, { status: 'BOOKED', serviceDate: day(3), eventId: event.id });
    const summary = (await agent.get(`${base}/dashboard`).expect(200)).body.data.vendorSummary;
    expect(summary).toMatchObject({
      activeVendors: 1,
      bookedVendors: 1,
      bookingsNeedingFollowUp: 1,
    });
    expect(summary.upcomingServices).toEqual([
      expect.objectContaining({ vendorId: v.id, title: 'Wedding photography', eventId: event.id }),
    ]);
  });
});
