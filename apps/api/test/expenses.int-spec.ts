import { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { todayIn } from '../src/modules/weddings/index.js';
import { restoreClock, startClockAtNoonInIndia } from './support/noon-in-india.js';
import { startWorkspaceApp, type WorkspaceApp } from './support/workspace-app.js';

/** A calendar date `days` from today in India (the wedding timezone). */
function day(days: number): string {
  const [year, month, date] = todayIn('Asia/Kolkata').split('-').map(Number) as [
    number,
    number,
    number,
  ];
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
}

function pluck(list: unknown, key: string): unknown[] {
  return (list as Record<string, unknown>[]).map((item) => item[key]);
}

type Expense = Record<string, unknown> & { id: string };
type Payment = Record<string, unknown> & { id: string };

const RUPEE = 100;

describe('Expenses (Phase 8, decision 0028)', () => {
  let workspace: WorkspaceApp;

  beforeAll(async () => {
    workspace = await startWorkspaceApp();
    // "Today" never crosses midnight IST during the run.
    startClockAtNoonInIndia();
  });

  beforeEach(async () => {
    await workspace.redis.flushdb();
  });

  afterAll(async () => {
    restoreClock();
    await workspace?.stop();
  });

  async function setUp() {
    const { agent, weddingId } = await workspace.owner();
    const base = `/api/v1/weddings/${weddingId}`;
    const me = (await agent.get('/api/v1/me').expect(200)).body.data.user as { id: string };
    const create = async (body: Record<string, unknown> = {}) =>
      (
        await agent
          .post(`${base}/expenses`)
          .send({
            title: 'Decorator',
            amountMinor: 150_000 * RUPEE,
            category: 'DECORATION',
            expenseDate: day(0),
            ...body,
          })
          .expect(201)
      ).body.data as Expense;
    const get = async (expenseId: string) =>
      (await agent.get(`${base}/expenses/${expenseId}`).expect(200)).body.data as Expense;
    const pay = (expenseId: string, body: Record<string, unknown> = {}) =>
      agent.post(`${base}/expenses/${expenseId}/payments`).send({
        amountMinor: 50_000 * RUPEE,
        paymentDate: day(0),
        paidByType: 'EXTERNAL_PERSON',
        paidByName: "Bride's father",
        ...body,
      });
    const payments = async (expenseId: string) =>
      (await agent.get(`${base}/expenses/${expenseId}/payments`).expect(200)).body
        .data as Payment[];
    const list = async (query = '') =>
      (await agent.get(`${base}/expenses${query}`).expect(200)).body as {
        data: Expense[];
        meta: {
          pagination: { nextCursor: string | null; hasNextPage: boolean };
          totals: { totalMinor: number; paidMinor: number; pendingMinor: number };
        };
      };
    const event = async (name: string) =>
      (
        await agent
          .post(`${base}/events`)
          .send({ name, type: 'CUSTOM', date: day(10) })
          .expect(201)
      ).body.data.id as string;
    const dashboard = async () =>
      (await agent.get(`${base}/dashboard`).expect(200)).body.data.expenseSummary as {
        totalMinor: number;
        paidMinor: number;
        pendingMinor: number;
        byCategory: { category: string; totalMinor: number }[];
        byEvent: { eventId: string | null; eventName: string | null; totalMinor: number }[];
      };
    const audits = (resourceId: string) =>
      workspace.connection
        .collection('audit_logs')
        .find({ resourceId: new Types.ObjectId(resourceId) })
        .sort({ createdAt: 1, _id: 1 })
        .toArray();
    return {
      agent,
      weddingId,
      base,
      me,
      create,
      get,
      pay,
      payments,
      list,
      event,
      dashboard,
      audits,
    };
  }

  it('creates a whole-wedding expense, pending with nothing paid, and audits it', async () => {
    const { create, audits } = await setUp();
    const expense = await create({ title: '  Banquet hall  ', amountMinor: 15_000_050 });
    expect(expense).toMatchObject({
      title: 'Banquet hall',
      amountMinor: 15_000_050,
      paidMinor: 0,
      pendingMinor: 15_000_050,
      currency: 'INR',
      category: 'DECORATION',
      expenseDate: day(0),
      eventId: null,
      eventName: null,
      paymentStatus: 'PENDING',
      notes: null,
    });
    expect(pluck(await audits(expense.id), 'action')).toEqual(['EXPENSE_CREATED']);
  });

  it('enforces the money and text limits (0028 #6, #11)', async () => {
    const { agent, base } = await setUp();
    const send = (body: Record<string, unknown>) =>
      agent.post(`${base}/expenses`).send({
        title: 'Venue',
        amountMinor: 100,
        category: 'VENUE',
        expenseDate: day(0),
        ...body,
      });
    const fields = async (body: Record<string, unknown>) =>
      (await send(body).expect(400)).body.error.details.fields as Record<string, string[]>;

    expect((await fields({ amountMinor: 0 })).amountMinor).toContain(
      'Enter an amount more than ₹0.',
    );
    expect((await fields({ amountMinor: 12.5 })).amountMinor).toContain(
      'Enter an amount more than ₹0.',
    );
    expect((await fields({ amountMinor: 10_000_000_001 })).amountMinor).toEqual([
      'Enter at most ₹10,00,00,000.',
    ]);
    await send({ amountMinor: 10_000_000_000 }).expect(201);
    expect(
      Object.keys(await fields({ title: 'x'.repeat(151), notes: 'y'.repeat(1001) })).sort(),
    ).toEqual(['notes', 'title']);
    expect((await fields({ title: '   ' })).title).toEqual(['Enter a title.']);
    expect((await fields({ category: 'TRANSPORT' })).category).toEqual(['Choose a category.']);
    expect((await fields({ expenseDate: '2027-02-30' })).expenseDate).toEqual([
      'Enter a valid date.',
    ]);
    await send({ expenseDate: day(-200) }).expect(201);
    await send({ expenseDate: day(200) }).expect(201);
  });

  it('never lets a client set the status, currency, vendor or a description (0028 #4, #7)', async () => {
    const { agent, base, create } = await setUp();
    for (const extra of [
      { paymentStatus: 'PAID' },
      { currency: 'USD' },
      { vendorId: new Types.ObjectId().toString() },
      { description: 'Lights' },
      { paidMinor: 100 },
    ]) {
      await agent
        .post(`${base}/expenses`)
        .send({ title: 'X', amountMinor: 100, category: 'GIFTS', expenseDate: day(0), ...extra })
        .expect(400);
    }
    const expense = await create();
    await agent.patch(`${base}/expenses/${expense.id}`).send({ paymentStatus: 'PAID' }).expect(400);
  });

  it('calculates the status from the payments (0028 #7)', async () => {
    const { create, get, pay, payments, agent, base } = await setUp();
    const expense = await create();

    const first = (await pay(expense.id, { amountMinor: 30_000 * RUPEE }).expect(201)).body
      .data as Payment;
    expect(await get(expense.id)).toMatchObject({
      paidMinor: 30_000 * RUPEE,
      pendingMinor: 120_000 * RUPEE,
      paymentStatus: 'PARTIALLY_PAID',
    });

    await pay(expense.id, { amountMinor: 120_000 * RUPEE }).expect(201);
    expect(await get(expense.id)).toMatchObject({ pendingMinor: 0, paymentStatus: 'PAID' });

    await agent.delete(`${base}/expenses/${expense.id}/payments/${first.id}`).expect(204);
    expect(await get(expense.id)).toMatchObject({
      paidMinor: 120_000 * RUPEE,
      paymentStatus: 'PARTIALLY_PAID',
    });
    expect(pluck(await payments(expense.id), 'amountMinor')).toEqual([120_000 * RUPEE]);
  });

  it('refuses an overpayment, also when editing a payment (0028 #9)', async () => {
    const { create, get, pay, agent, base } = await setUp();
    const expense = await create({ amountMinor: 1_000 * RUPEE });
    const payment = (await pay(expense.id, { amountMinor: 600 * RUPEE }).expect(201)).body
      .data as Payment;

    const refused = await pay(expense.id, { amountMinor: 401 * RUPEE }).expect(409);
    expect(refused.body.error).toMatchObject({
      code: 'PAYMENT_EXCEEDS_BALANCE',
      message: 'This is more than the pending ₹400.',
      details: { remainingMinor: 400 * RUPEE },
    });
    await pay(expense.id, { amountMinor: 400 * RUPEE }).expect(201);

    // Editing counts the edited payment as not yet paid: ₹600 may become at most ₹600.
    const edit = (amountMinor: number) =>
      agent.patch(`${base}/expenses/${expense.id}/payments/${payment.id}`).send({
        amountMinor,
        paymentDate: day(0),
        paidByType: 'EXTERNAL_PERSON',
        paidByName: "Bride's father",
      });
    expect((await edit(601 * RUPEE).expect(409)).body.error.details).toEqual({
      remainingMinor: 600 * RUPEE,
    });
    await edit(500 * RUPEE).expect(200);
    expect(await get(expense.id)).toMatchObject({
      paidMinor: 900 * RUPEE,
      paymentStatus: 'PARTIALLY_PAID',
    });
  });

  it('never overpays when payments arrive at the same time (0028 #8)', async () => {
    const { create, get, pay, payments } = await setUp();
    const expense = await create({ amountMinor: 1_000 * RUPEE });
    const results = await Promise.all(
      Array.from({ length: 4 }, () => pay(expense.id, { amountMinor: 400 * RUPEE })),
    );
    const statuses = results.map((result) => result.status).sort();
    expect(statuses).toEqual([201, 201, 409, 409]);
    expect(await get(expense.id)).toMatchObject({
      paidMinor: 800 * RUPEE,
      paymentStatus: 'PARTIALLY_PAID',
    });
    expect(await payments(expense.id)).toHaveLength(2);
  });

  it('refuses an amount below the paid total (0028 #10)', async () => {
    const { create, get, pay, agent, base } = await setUp();
    const expense = await create({ amountMinor: 1_000 * RUPEE });
    await pay(expense.id, { amountMinor: 500 * RUPEE }).expect(201);

    const refused = await agent
      .patch(`${base}/expenses/${expense.id}`)
      .send({ amountMinor: 499 * RUPEE })
      .expect(409);
    expect(refused.body.error).toMatchObject({
      code: 'AMOUNT_BELOW_PAID',
      details: { paidMinor: 500 * RUPEE },
    });

    const updated = (
      await agent
        .patch(`${base}/expenses/${expense.id}`)
        .send({ amountMinor: 500 * RUPEE })
        .expect(200)
    ).body.data as Expense;
    expect(updated).toMatchObject({ amountMinor: 500 * RUPEE, paymentStatus: 'PAID' });
    await agent
      .patch(`${base}/expenses/${expense.id}`)
      .send({ amountMinor: 800 * RUPEE })
      .expect(200);
    expect((await get(expense.id)).paymentStatus).toBe('PARTIALLY_PAID');
  });

  it('checks payment dates, payers and limits (0028 #12, #13)', async () => {
    const { create, pay, me } = await setUp();
    const expense = await create();
    const fields = async (body: Record<string, unknown>) =>
      (await pay(expense.id, body).expect(400)).body.error.details.fields as Record<
        string,
        string[]
      >;

    expect((await fields({ paymentDate: day(1) })).paymentDate).toEqual([
      "The payment date can't be in the future.",
    ]);
    await pay(expense.id, { amountMinor: 100, paymentDate: day(0) }).expect(201);
    await pay(expense.id, { amountMinor: 100, paymentDate: day(-400) }).expect(201);
    expect((await fields({ paidByName: '  ' })).paidByName).toEqual(['Enter who paid.']);
    expect((await fields({ paidByName: 'x'.repeat(101) })).paidByName).toEqual([
      'Use 100 characters or fewer.',
    ]);
    expect(
      Object.keys(
        await fields({ referenceNumber: 'r'.repeat(101), notes: 'n'.repeat(501), amountMinor: 0 }),
      ).sort(),
    ).toEqual(['amountMinor', 'notes', 'referenceNumber']);
    expect((await fields({ paymentMethod: 'NET_BANKING' })).paymentMethod).toEqual([
      'Choose a payment method.',
    ]);

    const member = (
      await pay(expense.id, {
        amountMinor: 100,
        paidByType: 'WEDDING_MEMBER',
        paidByUserId: me.id,
        paidByName: undefined,
        paymentMethod: 'UPI',
        referenceNumber: ' 4521 ',
      }).expect(201)
    ).body.data as Payment;
    expect(member).toMatchObject({
      paidByType: 'WEDDING_MEMBER',
      paidByUserId: me.id,
      paidByName: 'Meera Sharma',
      paymentMethod: 'UPI',
      referenceNumber: '4521',
    });

    const stranger = await workspace.owner();
    const strangerId = (await stranger.agent.get('/api/v1/me').expect(200)).body.data.user.id;
    const notMember = await pay(expense.id, {
      paidByType: 'WEDDING_MEMBER',
      paidByUserId: strangerId,
      paidByName: undefined,
    }).expect(404);
    expect(notMember.body.error.code).toBe('MEMBER_NOT_FOUND');
  });

  it('lists payments oldest first and audits each change with its details (0028 #18)', async () => {
    const { create, pay, payments, agent, base, audits } = await setUp();
    const expense = await create();
    const later = (await pay(expense.id, { amountMinor: 200, paymentDate: day(-1) }).expect(201))
      .body.data as Payment;
    const earlier = (
      await pay(expense.id, { amountMinor: 100, paymentDate: day(-5), notes: 'Advance' }).expect(
        201,
      )
    ).body.data as Payment;
    expect(pluck(await payments(expense.id), 'id')).toEqual([earlier.id, later.id]);

    await agent
      .patch(`${base}/expenses/${expense.id}/payments/${later.id}`)
      .send({
        amountMinor: 300,
        paymentDate: day(-1),
        paidByType: 'EXTERNAL_PERSON',
        paidByName: 'Mama',
      })
      .expect(200);
    await agent.delete(`${base}/expenses/${expense.id}/payments/${earlier.id}`).expect(204);
    await agent.delete(`${base}/expenses/${expense.id}/payments/${earlier.id}`).expect(404);

    expect(pluck(await audits(later.id), 'action')).toEqual([
      'EXPENSE_PAYMENT_ADDED',
      'EXPENSE_PAYMENT_UPDATED',
    ]);
    const [updated] = (await audits(later.id)).slice(1);
    expect(updated?.metadata).toMatchObject({
      expenseId: expense.id,
      oldValue: { amountMinor: 200, paidByName: "Bride's father" },
      newValue: { amountMinor: 300, paidByName: 'Mama' },
    });
    const removed = (await audits(earlier.id)).at(-1);
    expect(removed).toMatchObject({
      action: 'EXPENSE_PAYMENT_REMOVED',
      resourceType: 'expense_payment',
      metadata: {
        expenseId: expense.id,
        amountMinor: 100,
        paymentDate: day(-5),
        paidByType: 'EXTERNAL_PERSON',
        paidByName: "Bride's father",
        notes: 'Advance',
      },
    });
    expect(removed?.createdAt).toBeInstanceOf(Date);
    expect(removed?.actorUserId).toBeDefined();
  });

  it('edits an expense, audits real changes, and moves it between events', async () => {
    const { create, agent, base, event, audits } = await setUp();
    const sangeet = await event('Sangeet');
    const expense = await create({ eventId: sangeet });
    expect(expense).toMatchObject({ eventId: sangeet, eventName: 'Sangeet' });

    const moved = (
      await agent
        .patch(`${base}/expenses/${expense.id}`)
        .send({ eventId: null, notes: 'Stage and lights', category: 'ENTERTAINMENT' })
        .expect(200)
    ).body.data as Expense;
    expect(moved).toMatchObject({
      eventId: null,
      notes: 'Stage and lights',
      category: 'ENTERTAINMENT',
    });
    await agent.patch(`${base}/expenses/${expense.id}`).send({ title: 'Decorator' }).expect(200);

    const entries = await audits(expense.id);
    expect(pluck(entries, 'action')).toEqual(['EXPENSE_CREATED', 'EXPENSE_UPDATED']);
    expect(entries[1]?.metadata).toEqual({
      oldValue: { category: 'DECORATION', eventId: sangeet },
      newValue: { category: 'ENTERTAINMENT', eventId: null, fields: ['notes'] },
    });

    const other = await workspace.owner();
    const foreign = (
      await other.agent
        .post(`/api/v1/weddings/${other.weddingId}/events`)
        .send({ name: 'Theirs', type: 'CUSTOM', date: day(3) })
        .expect(201)
    ).body.data.id as string;
    const refused = await agent
      .patch(`${base}/expenses/${expense.id}`)
      .send({ eventId: foreign })
      .expect(404);
    expect(refused.body.error.code).toBe('EVENT_NOT_FOUND');
  });

  it('soft-deletes: gone from lists, totals and routes; payments kept; audited (0028 #16)', async () => {
    const { create, pay, list, dashboard, agent, base, audits } = await setUp();
    const expense = await create();
    await pay(expense.id).expect(201);
    await agent.delete(`${base}/expenses/${expense.id}`).expect(204);

    await agent.get(`${base}/expenses/${expense.id}`).expect(404);
    await agent.get(`${base}/expenses/${expense.id}/payments`).expect(404);
    await pay(expense.id).expect(404);
    await agent.delete(`${base}/expenses/${expense.id}`).expect(404);
    expect((await list()).data).toEqual([]);
    expect((await list()).meta.totals).toEqual({ totalMinor: 0, paidMinor: 0, pendingMinor: 0 });
    expect(await dashboard()).toMatchObject({ totalMinor: 0, byCategory: [], byEvent: [] });

    const stored = await workspace.connection
      .collection('expense_payments')
      .countDocuments({ expenseId: new Types.ObjectId(expense.id) });
    expect(stored).toBe(1);
    expect(pluck(await audits(expense.id), 'action')).toEqual([
      'EXPENSE_CREATED',
      'EXPENSE_DELETED',
    ]);
  });

  it('makes a deleted event’s expenses whole-wedding, keeping payments (0028 #17)', async () => {
    const { create, get, pay, event, agent, base, audits } = await setUp();
    const haldi = await event('Haldi');
    const expense = await create({ eventId: haldi });
    await pay(expense.id).expect(201);
    await agent.delete(`${base}/events/${haldi}`).expect(204);

    expect(await get(expense.id)).toMatchObject({
      eventId: null,
      eventName: null,
      paidMinor: 50_000 * RUPEE,
      paymentStatus: 'PARTIALLY_PAID',
    });
    expect((await audits(expense.id)).at(-1)).toMatchObject({
      action: 'EXPENSE_EVENT_UNLINKED',
      metadata: { eventId: haldi },
    });
  });

  it('filters, searches and pages newest first, with totals for the filters (0028 #20, #22)', async () => {
    const { create, pay, list, event } = await setUp();
    const sangeet = await event('Sangeet');
    const lehenga = await create({
      title: 'Bridal lehenga',
      category: 'CLOTHING',
      amountMinor: 85_000 * RUPEE,
      expenseDate: day(-1),
    });
    const decor = await create({ title: 'Decorator', eventId: sangeet, expenseDate: day(-3) });
    await pay(decor.id).expect(201);
    const hall = await create({
      title: 'Banquet hall',
      category: 'VENUE',
      amountMinor: 400_000 * RUPEE,
      expenseDate: day(-3),
    });
    await pay(hall.id, { amountMinor: 400_000 * RUPEE }).expect(201);

    const all = await list();
    expect(pluck(all.data, 'title')).toEqual(['Bridal lehenga', 'Banquet hall', 'Decorator']);
    expect(all.meta.totals).toEqual({
      totalMinor: 635_000 * RUPEE,
      paidMinor: 450_000 * RUPEE,
      pendingMinor: 185_000 * RUPEE,
    });
    expect(pluck((await list('?category=VENUE')).data, 'id')).toEqual([hall.id]);
    expect(pluck((await list(`?eventId=${sangeet}`)).data, 'id')).toEqual([decor.id]);
    expect(pluck((await list('?eventId=none')).data, 'id')).toEqual([lehenga.id, hall.id]);
    expect(pluck((await list('?paymentStatus=PENDING')).data, 'id')).toEqual([lehenga.id]);
    const partial = await list('?paymentStatus=PARTIALLY_PAID');
    expect(partial.meta.totals).toEqual({
      totalMinor: 150_000 * RUPEE,
      paidMinor: 50_000 * RUPEE,
      pendingMinor: 100_000 * RUPEE,
    });
    expect(pluck((await list('?search=LEHEN')).data, 'id')).toEqual([lehenga.id]);
    expect((await list('?search=nothing')).meta.totals.totalMinor).toBe(0);

    // Pages stay in order across "Load more", and every page carries the full totals.
    const first = await list('?limit=2');
    expect(first.meta.pagination.hasNextPage).toBe(true);
    const second = await list(`?limit=2&cursor=${first.meta.pagination.nextCursor}`);
    expect([...pluck(first.data, 'id'), ...pluck(second.data, 'id')]).toEqual([
      lehenga.id,
      hall.id,
      decor.id,
    ]);
    expect(second.meta.totals.totalMinor).toBe(635_000 * RUPEE);
  });

  it('summarises the dashboard: totals and breakdowns that add up (0028 #23)', async () => {
    const { create, pay, dashboard, list, event } = await setUp();
    expect(await dashboard()).toEqual({
      totalMinor: 0,
      paidMinor: 0,
      pendingMinor: 0,
      byCategory: [],
      byEvent: [],
    });
    const sangeet = await event('Sangeet');
    const wedding = await event('Wedding');
    await create({ title: 'Banquet hall', category: 'VENUE', amountMinor: 400_000 * RUPEE });
    const decor = await create({ eventId: sangeet });
    await pay(decor.id).expect(201);
    await create({
      title: 'Lehenga',
      category: 'CLOTHING',
      amountMinor: 85_000 * RUPEE,
      eventId: wedding,
    });

    const summary = await dashboard();
    expect(summary).toEqual({
      totalMinor: 635_000 * RUPEE,
      paidMinor: 50_000 * RUPEE,
      pendingMinor: 585_000 * RUPEE,
      byCategory: [
        { category: 'VENUE', totalMinor: 400_000 * RUPEE },
        { category: 'DECORATION', totalMinor: 150_000 * RUPEE },
        { category: 'CLOTHING', totalMinor: 85_000 * RUPEE },
      ],
      byEvent: [
        { eventId: null, eventName: null, totalMinor: 400_000 * RUPEE },
        { eventId: sangeet, eventName: 'Sangeet', totalMinor: 150_000 * RUPEE },
        { eventId: wedding, eventName: 'Wedding', totalMinor: 85_000 * RUPEE },
      ],
    });
    const sum = (rows: { totalMinor: number }[]) => rows.reduce((a, row) => a + row.totalMinor, 0);
    expect(sum(summary.byCategory)).toBe(summary.totalMinor);
    expect(sum(summary.byEvent)).toBe(summary.totalMinor);
    expect((await list()).meta.totals).toEqual({
      totalMinor: summary.totalMinor,
      paidMinor: summary.paidMinor,
      pendingMinor: summary.pendingMinor,
    });
  });

  it('keeps each wedding’s expenses private on every route, and requires sign-in', async () => {
    const { base, create, pay, dashboard } = await setUp();
    const expense = await create();
    const payment = (await pay(expense.id).expect(201)).body.data as Payment;
    const other = await workspace.owner();
    const theirs = `/api/v1/weddings/${other.weddingId}`;

    await other.agent.get(`${base}/expenses`).expect(404);
    await other.agent.get(`${base}/expenses/${expense.id}`).expect(404);
    for (const path of [
      `${theirs}/expenses/${expense.id}`,
      `${theirs}/expenses/${expense.id}/payments`,
    ]) {
      expect((await other.agent.get(path).expect(404)).body.error.code).toBe('EXPENSE_NOT_FOUND');
    }
    await other.agent.patch(`${theirs}/expenses/${expense.id}`).send({ title: 'Mine' }).expect(404);
    await other.agent.delete(`${theirs}/expenses/${expense.id}`).expect(404);
    await other.agent.delete(`${theirs}/expenses/${expense.id}/payments/${payment.id}`).expect(404);
    await other.agent.get(`${theirs}/expenses/not-an-id`).expect(404);
    expect((await other.agent.get(`${theirs}/expenses`).expect(200)).body.data).toEqual([]);
    expect(
      (await other.agent.get(`${theirs}/dashboard`).expect(200)).body.data.expenseSummary
        .totalMinor,
    ).toBe(0);
    expect((await dashboard()).totalMinor).toBe(150_000 * RUPEE);
    await request(workspace.server()).get(`${base}/expenses`).expect(401);
  });

  // ─── Review P8 ─────────────────────────────────────────────────────────────────────────────

  it('answers malformed and mismatched IDs with 404, never a server error (P8-M2)', async () => {
    const { create, pay, agent, base, event } = await setUp();
    const expense = await create();
    const other = await create({ title: 'Other' });
    const payment = (await pay(expense.id).expect(201)).body.data as Payment;
    const body = {
      amountMinor: 100,
      paymentDate: day(0),
      paidByType: 'EXTERNAL_PERSON',
      paidByName: 'Mama',
    };
    const code = async (response: Promise<request.Response>) =>
      ((await response).body as { error: { code: string } }).error.code;

    for (const [expenseId, paymentId, expected] of [
      ['not-an-id', payment.id, 'EXPENSE_NOT_FOUND'],
      [expense.id, 'not-an-id', 'PAYMENT_NOT_FOUND'],
      // A payment used under a different expense of the same wedding.
      [other.id, payment.id, 'PAYMENT_NOT_FOUND'],
    ] as const) {
      const path = `${base}/expenses/${expenseId}/payments/${paymentId}`;
      expect(await code(agent.patch(path).send(body).expect(404))).toBe(expected);
      expect(await code(agent.delete(path).expect(404))).toBe(expected);
    }
    expect(
      await code(agent.post(`${base}/expenses/not-an-id/payments`).send(body).expect(404)),
    ).toBe('EXPENSE_NOT_FOUND');

    // Another wedding's event on create, edit and the filter.
    const stranger = await workspace.owner();
    const foreign = (
      await stranger.agent
        .post(`/api/v1/weddings/${stranger.weddingId}/events`)
        .send({ name: 'Theirs', type: 'CUSTOM', date: day(3) })
        .expect(201)
    ).body.data.id as string;
    expect(
      await code(
        agent
          .post(`${base}/expenses`)
          .send({
            title: 'X',
            amountMinor: 100,
            category: 'GIFTS',
            expenseDate: day(0),
            eventId: foreign,
          })
          .expect(404),
      ),
    ).toBe('EVENT_NOT_FOUND');
    expect(
      await code(
        agent.patch(`${base}/expenses/${expense.id}`).send({ eventId: foreign }).expect(404),
      ),
    ).toBe('EVENT_NOT_FOUND');
    expect(await code(agent.get(`${base}/expenses?eventId=${foreign}`).expect(404))).toBe(
      'EVENT_NOT_FOUND',
    );
    await event('Ours');
  });

  it('refuses payment changes on a deleted expense', async () => {
    const { create, pay, agent, base } = await setUp();
    const expense = await create();
    const payment = (await pay(expense.id).expect(201)).body.data as Payment;
    await agent.delete(`${base}/expenses/${expense.id}`).expect(204);
    const path = `${base}/expenses/${expense.id}/payments/${payment.id}`;
    const body = {
      amountMinor: 100,
      paymentDate: day(0),
      paidByType: 'EXTERNAL_PERSON',
      paidByName: 'Mama',
    };
    expect((await pay(expense.id).expect(404)).body.error.code).toBe('EXPENSE_NOT_FOUND');
    expect((await agent.patch(path).send(body).expect(404)).body.error.code).toBe(
      'EXPENSE_NOT_FOUND',
    );
    expect((await agent.delete(path).expect(404)).body.error.code).toBe('EXPENSE_NOT_FOUND');
    // The payment is kept, untouched.
    const stored = await workspace.connection
      .collection('expense_payments')
      .findOne({ _id: new Types.ObjectId(payment.id) });
    expect(stored?.amountMinor).toBe(50_000 * RUPEE);
  });

  it('keeps paid equal to the sum of payments through concurrent changes (0028 #8–#10)', async () => {
    const { create, get, pay, payments, agent, base } = await setUp();
    const expense = await create({ amountMinor: 1_000 * RUPEE });
    const first = (await pay(expense.id, { amountMinor: 300 * RUPEE }).expect(201)).body
      .data as Payment;
    const second = (await pay(expense.id, { amountMinor: 200 * RUPEE }).expect(201)).body
      .data as Payment;
    const edit = (paymentId: string, amountMinor: number) =>
      agent.patch(`${base}/expenses/${expense.id}/payments/${paymentId}`).send({
        amountMinor,
        paymentDate: day(0),
        paidByType: 'EXTERNAL_PERSON',
        paidByName: 'Mama',
      });

    // Lowering the amount while a payment arrives: never below what ends up paid.
    const [lowered, added] = await Promise.all([
      agent.patch(`${base}/expenses/${expense.id}`).send({ amountMinor: 600 * RUPEE }),
      pay(expense.id, { amountMinor: 400 * RUPEE }),
    ]);
    expect([lowered.status, added.status].sort()).toEqual(
      lowered.status === 200 ? [200, 409] : [201, 409],
    );

    // Editing and removing the same payment at once: the removal always succeeds; the edit either
    // ran first or finds the payment gone.
    const [edited, removed] = await Promise.all([
      edit(first.id, 100 * RUPEE),
      agent.delete(`${base}/expenses/${expense.id}/payments/${first.id}`),
    ]);
    expect(removed.status).toBe(204);
    expect([200, 404]).toContain(edited.status);
    await Promise.all([edit(second.id, 250 * RUPEE), pay(expense.id, { amountMinor: 50 * RUPEE })]);

    const current = await get(expense.id);
    const sum = (await payments(expense.id)).reduce(
      (total, payment) => total + (payment.amountMinor as number),
      0,
    );
    expect(current.paidMinor).toBe(sum);
    expect(sum).toBeLessThanOrEqual(current.amountMinor as number);
    expect(current.pendingMinor).toBe((current.amountMinor as number) - sum);
  });

  it('pages through equal dates and creation times without gaps, and rejects a bad cursor', async () => {
    const { create, list, agent, base } = await setUp();
    const ids = new Set<string>();
    for (let index = 0; index < 5; index += 1) {
      ids.add((await create({ title: `Same day ${index}`, expenseDate: day(-2) })).id);
    }
    // Force identical creation times: the ID is the final tie-break.
    await workspace.connection
      .collection('expenses')
      .updateMany(
        { _id: { $in: [...ids].map((id) => new Types.ObjectId(id)) } },
        { $set: { createdAt: new Date('2027-01-01T00:00:00.000Z') } },
      );
    const seen: unknown[] = [];
    let cursor: string | null = null;
    do {
      const page = await list(`?limit=2${cursor ? `&cursor=${cursor}` : ''}`);
      seen.push(...pluck(page.data, 'id'));
      cursor = page.meta.pagination.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(5);
    expect(new Set(seen)).toEqual(ids);

    for (const bad of ['not-a-cursor', Buffer.from('["x","y","z"]').toString('base64url')]) {
      expect(
        (await agent.get(`${base}/expenses?cursor=${bad}`).expect(400)).body.error.details.fields,
      ).toEqual({ cursor: ['The cursor is not valid.'] });
    }
  });

  it('never leaves an expense linked to an event deleted at the same moment (P8-M1)', async () => {
    const { agent, base, event } = await setUp();
    for (let round = 0; round < 6; round += 1) {
      const eventId = await event(`Race ${round}`);
      await Promise.all([
        agent.post(`${base}/expenses`).send({
          title: `Race ${round}`,
          amountMinor: 100,
          category: 'GIFTS',
          expenseDate: day(0),
          eventId,
        }),
        agent.delete(`${base}/events/${eventId}`),
      ]);
    }
    const deleted = await workspace.connection
      .collection('events')
      .find({ deletedAt: { $exists: true } }, { projection: { _id: 1 } })
      .toArray();
    const dangling = await workspace.connection.collection('expenses').countDocuments({
      eventId: { $in: deleted.map((row) => row._id) },
      deletedAt: { $exists: false },
    });
    expect(dangling).toBe(0);
  });

  it('writes no audit entry when a payment is saved unchanged', async () => {
    const { create, pay, agent, base, audits } = await setUp();
    const expense = await create();
    const payment = (await pay(expense.id, { amountMinor: 100, notes: 'Advance' }).expect(201)).body
      .data as Payment;
    await agent
      .patch(`${base}/expenses/${expense.id}/payments/${payment.id}`)
      .send({
        amountMinor: 100,
        paymentDate: day(0),
        paidByType: 'EXTERNAL_PERSON',
        paidByName: "Bride's father",
        notes: 'Advance',
      })
      .expect(200);
    expect(pluck(await audits(payment.id), 'action')).toEqual(['EXPENSE_PAYMENT_ADDED']);
  });
});
