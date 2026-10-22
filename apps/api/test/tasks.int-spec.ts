import { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { todayIn } from '../src/modules/weddings/index.js';
import { restoreClock, startClockAtNoonInIndia } from './support/noon-in-india.js';
import { startWorkspaceApp, type Agent, type WorkspaceApp } from './support/workspace-app.js';

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

type Task = Record<string, unknown> & { id: string };

describe('Tasks (Phase 7, decision 0026)', () => {
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
    const create = async (body: Record<string, unknown>) =>
      (await agent.post(`${base}/tasks`).send(body).expect(201)).body.data as Task;
    const update = async (taskId: string, body: Record<string, unknown>) =>
      (await agent.patch(`${base}/tasks/${taskId}`).send(body).expect(200)).body.data as Task;
    const list = async (query = '') =>
      (await agent.get(`${base}/tasks${query}`).expect(200)).body as {
        data: Task[];
        meta: { pagination: { nextCursor: string | null; hasNextPage: boolean } };
      };
    const history = async (taskId: string) =>
      (await agent.get(`${base}/tasks/${taskId}/activities`).expect(200)).body.data as Record<
        string,
        unknown
      >[];
    const event = async (name: string) =>
      (
        await agent
          .post(`${base}/events`)
          .send({ name, type: 'CUSTOM', date: day(10) })
          .expect(201)
      ).body.data.id as string;
    const dashboard = async () =>
      (await agent.get(`${base}/dashboard`).expect(200)).body.data as {
        taskCounts: Record<string, number>;
        upcomingTasks: Task[];
      };
    return { agent, weddingId, base, me, create, update, list, history, event, dashboard };
  }

  it('creates a task with only a title: To do, Medium, whole wedding, with history', async () => {
    const { create, history } = await setUp();
    const task = await create({ title: '  Book mehendi artist  ' });
    expect(task).toMatchObject({
      title: 'Book mehendi artist',
      description: null,
      notes: null,
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: null,
      eventId: null,
      eventName: null,
      assignees: [],
      isOverdue: false,
      isDueToday: false,
    });
    expect(pluck(await history(task.id), 'action')).toEqual(['CREATED']);
  });

  it('enforces the limits: title 150, description and notes 1,000 (0026 #6)', async () => {
    const { agent, base } = await setUp();
    const response = await agent
      .post(`${base}/tasks`)
      .send({ title: 'x'.repeat(151), description: 'y'.repeat(1001), notes: 'z'.repeat(1001) })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(response.body.error.details.fields).sort()).toEqual([
      'description',
      'notes',
      'title',
    ]);
    const empty = await agent.post(`${base}/tasks`).send({ title: '   ' }).expect(400);
    expect(empty.body.error.details.fields.title).toEqual(['Enter a title.']);
    await agent.post(`${base}/tasks`).send({ title: 'Ok', dueDate: '2027-02-30' }).expect(400);
  });

  it('links only active events of the same wedding', async () => {
    const { agent, base, event, create } = await setUp();
    const mehendi = await event('Mehendi');
    expect(await create({ title: 'Henna cones', eventId: mehendi })).toMatchObject({
      eventId: mehendi,
      eventName: 'Mehendi',
    });

    const other = await workspace.owner();
    const foreign = (
      await other.agent
        .post(`/api/v1/weddings/${other.weddingId}/events`)
        .send({ name: 'Theirs', type: 'CUSTOM', date: day(5) })
        .expect(201)
    ).body.data.id as string;
    const response = await agent
      .post(`${base}/tasks`)
      .send({ title: 'X', eventId: foreign })
      .expect(404);
    expect(response.body.error.code).toBe('EVENT_NOT_FOUND');

    await agent.delete(`${base}/events/${mehendi}`).expect(204);
    await agent.post(`${base}/tasks`).send({ title: 'Y', eventId: mehendi }).expect(404);
  });

  it('is overdue from the day after the due date; closed tasks never are (0026 #8)', async () => {
    const { create } = await setUp();
    expect(await create({ title: 'Yesterday', dueDate: day(-1) })).toMatchObject({
      isOverdue: true,
      isDueToday: false,
    });
    expect(await create({ title: 'Today', dueDate: day(0) })).toMatchObject({
      isOverdue: false,
      isDueToday: true,
    });
    expect(await create({ title: 'Tomorrow', dueDate: day(1) })).toMatchObject({
      isOverdue: false,
      isDueToday: false,
    });
    expect(
      await create({ title: 'Done late', dueDate: day(-3), status: 'COMPLETED' }),
    ).toMatchObject({ isOverdue: false });
    expect(await create({ title: 'Dropped', dueDate: day(-3), status: 'CANCELLED' })).toMatchObject(
      { isOverdue: false },
    );
  });

  it('allows any status change and records each in the history (0026 #9, #15)', async () => {
    const { create, update, history } = await setUp();
    const task = await create({ title: 'Order sweets' });
    for (const status of ['COMPLETED', 'TODO', 'CANCELLED', 'BLOCKED', 'IN_PROGRESS']) {
      expect((await update(task.id, { status })).status).toBe(status);
    }
    const entries = await history(task.id);
    expect(pluck(entries, 'action')).toEqual([
      'STATUS_CHANGED',
      'STATUS_CHANGED',
      'STATUS_CHANGED',
      'STATUS_CHANGED',
      'STATUS_CHANGED',
      'CREATED',
    ]);
    expect(entries[0]).toMatchObject({
      oldValue: { status: 'BLOCKED' },
      newValue: { status: 'IN_PROGRESS' },
      actorName: 'Meera Sharma',
    });
  });

  it('records edits by field, naming long texts without copying them', async () => {
    const { create, update, history, event } = await setUp();
    const haldi = await event('Haldi');
    const task = await create({ title: 'Turmeric', notes: 'old note' });
    await update(task.id, {
      title: 'Turmeric paste',
      priority: 'HIGH',
      dueDate: day(3),
      notes: 'new note',
      eventId: haldi,
    });
    const [eventEntry, updated] = await history(task.id);
    expect(updated).toMatchObject({
      action: 'UPDATED',
      oldValue: { title: 'Turmeric', priority: 'MEDIUM', dueDate: null },
      newValue: { title: 'Turmeric paste', priority: 'HIGH', dueDate: day(3), fields: ['notes'] },
    });
    expect(JSON.stringify(updated)).not.toContain('new note');
    expect(eventEntry).toMatchObject({
      action: 'EVENT_CHANGED',
      oldValue: { eventId: null, eventName: null },
      newValue: { eventId: haldi, eventName: 'Haldi' },
    });
    // Clearing the event moves the task to the whole wedding (0026 #11).
    expect(await update(task.id, { eventId: null })).toMatchObject({ eventId: null });
  });

  it('hides cancelled tasks unless the Cancelled status is chosen (0026 #10)', async () => {
    const { create, list } = await setUp();
    await create({ title: 'Open' });
    await create({ title: 'Dropped', status: 'CANCELLED' });
    expect(pluck((await list()).data, 'title')).toEqual(['Open']);
    expect(pluck((await list('?status=CANCELLED')).data, 'title')).toEqual(['Dropped']);
    expect(pluck((await list('?status=CANCELLED&status=TODO')).data, 'title').sort()).toEqual([
      'Dropped',
      'Open',
    ]);
  });

  it('soft-deletes: gone from lists, counts and routes; history kept; audited', async () => {
    const { agent, base, create, list, dashboard } = await setUp();
    const task = await create({ title: 'Mistake', dueDate: day(-2) });
    expect((await dashboard()).taskCounts).toMatchObject({ pending: 1, overdue: 1 });

    await agent.delete(`${base}/tasks/${task.id}`).expect(204);
    await agent.get(`${base}/tasks/${task.id}`).expect(404);
    await agent.get(`${base}/tasks/${task.id}/activities`).expect(404);
    await agent.delete(`${base}/tasks/${task.id}`).expect(404);
    expect((await list()).data).toEqual([]);
    expect((await dashboard()).taskCounts).toEqual({
      pending: 0,
      blocked: 0,
      completed: 0,
      overdue: 0,
    });

    const id = new Types.ObjectId(task.id);
    const actions = await workspace.connection
      .collection('task_activities')
      .find({ taskId: id })
      .sort({ createdAt: 1, _id: 1 })
      .toArray();
    expect(actions.map((entry) => entry.action as string)).toEqual(['CREATED', 'DELETED']);
    const audit = await workspace.connection.collection('audit_logs').findOne({ resourceId: id });
    expect(audit).toMatchObject({ action: 'TASK_DELETED', resourceType: 'task' });
  });

  it('turns a deleted event’s tasks into whole-wedding tasks, with history (0026 #12)', async () => {
    const { agent, base, event, create, history, list } = await setUp();
    const sangeet = await event('Sangeet');
    const playlist = await create({ title: 'Playlist', eventId: sangeet });
    const done = await create({ title: 'Book DJ', eventId: sangeet, status: 'COMPLETED' });

    await agent.delete(`${base}/events/${sangeet}`).expect(204);

    for (const task of [playlist, done]) {
      const current = (await agent.get(`${base}/tasks/${task.id}`).expect(200)).body.data;
      expect(current).toMatchObject({ eventId: null, eventName: null });
      expect((await history(task.id))[0]).toMatchObject({
        action: 'EVENT_DELETED',
        oldValue: { eventId: sangeet },
      });
    }
    // Completed tasks stay in the default list; only Cancelled is hidden.
    expect(pluck((await list('?eventId=none')).data, 'title').sort()).toEqual([
      'Book DJ',
      'Playlist',
    ]);
  });

  it('assigns members once, unassigns, filters "assigned to me" (0026 #13)', async () => {
    const { agent, base, me, create, list, history } = await setUp();
    const task = await create({ title: 'Mine', assigneeIds: [me.id, me.id] });
    expect(task.assignees).toEqual([{ userId: me.id, displayName: 'Meera Sharma' }]);
    await create({ title: 'Nobody’s' });

    const again = await agent
      .post(`${base}/tasks/${task.id}/assignees`)
      .send({ userId: me.id })
      .expect(200);
    expect(again.body.data.assignees).toHaveLength(1);
    expect(pluck((await list('?assignedToMe=true')).data, 'title')).toEqual(['Mine']);

    const stranger = await workspace.owner();
    const strangerId = (await stranger.agent.get('/api/v1/me').expect(200)).body.data.user.id;
    const refused = await agent
      .post(`${base}/tasks/${task.id}/assignees`)
      .send({ userId: strangerId })
      .expect(404);
    expect(refused.body.error.code).toBe('MEMBER_NOT_FOUND');

    const removed = await agent.delete(`${base}/tasks/${task.id}/assignees/${me.id}`).expect(200);
    expect(removed.body.data.assignees).toEqual([]);
    expect((await list('?assignedToMe=true')).data).toEqual([]);
    expect(pluck(await history(task.id), 'action')).toEqual([
      'ASSIGNEE_REMOVED',
      'ASSIGNEE_ADDED',
      'CREATED',
    ]);
    expect((await history(task.id))[0]).toMatchObject({ subjectName: 'Meera Sharma' });
  });

  it('orders by due date (undated last), then Urgent → Low, stable across pages', async () => {
    const { create, list } = await setUp();
    await create({ title: 'No date, urgent', priority: 'URGENT' });
    await create({ title: 'Day 2 low', dueDate: day(2), priority: 'LOW' });
    await create({ title: 'Day 2 urgent', dueDate: day(2), priority: 'URGENT' });
    await create({ title: 'Day 1 medium', dueDate: day(1) });
    await create({ title: 'Overdue high', dueDate: day(-4), priority: 'HIGH' });

    const expected = [
      'Overdue high',
      'Day 1 medium',
      'Day 2 urgent',
      'Day 2 low',
      'No date, urgent',
    ];
    expect(pluck((await list()).data, 'title')).toEqual(expected);

    const titles: unknown[] = [];
    let cursor: string | null = null;
    do {
      const page = await list(`?limit=2${cursor ? `&cursor=${cursor}` : ''}`);
      titles.push(...pluck(page.data, 'title'));
      cursor = page.meta.pagination.nextCursor;
    } while (cursor);
    expect(titles).toEqual(expected);
  });

  it('combines filters: priority, event, overdue only and title search', async () => {
    const { create, list, event, agent, base } = await setUp();
    const mehendi = await event('Mehendi');
    await create({
      title: 'Book Mehendi artist',
      eventId: mehendi,
      priority: 'HIGH',
      dueDate: day(-1),
    });
    await create({ title: 'Mehendi snacks', eventId: mehendi, priority: 'LOW' });
    await create({ title: 'Return gifts', priority: 'HIGH', dueDate: day(-1) });

    expect(pluck((await list('?priority=HIGH')).data, 'title').sort()).toEqual([
      'Book Mehendi artist',
      'Return gifts',
    ]);
    expect(pluck((await list(`?eventId=${mehendi}`)).data, 'title').length).toBe(2);
    expect(pluck((await list('?overdue=true')).data, 'title').sort()).toEqual([
      'Book Mehendi artist',
      'Return gifts',
    ]);
    expect(pluck((await list('?search=mEhEnDi&overdue=true')).data, 'title')).toEqual([
      'Book Mehendi artist',
    ]);
    await agent.get(`${base}/tasks?cursor=not-a-cursor`).expect(400);
  });

  it('shows counts and at most five upcoming tasks on the dashboard (0026 #20)', async () => {
    const { create, dashboard } = await setUp();
    expect(await dashboard()).toMatchObject({
      taskCounts: { pending: 0, blocked: 0, completed: 0, overdue: 0 },
      upcomingTasks: [],
    });

    await create({ title: 'Very old', dueDate: day(-30), status: 'BLOCKED' });
    await create({ title: 'Yesterday', dueDate: day(-1), priority: 'LOW' });
    await create({ title: 'Today', dueDate: day(0), status: 'IN_PROGRESS' });
    await create({ title: 'In a week', dueDate: day(7), priority: 'URGENT' });
    await create({ title: 'In a week, low', dueDate: day(7), priority: 'LOW' });
    await create({ title: 'Too far', dueDate: day(8) });
    await create({ title: 'Undated' });
    await create({ title: 'Done', dueDate: day(1), status: 'COMPLETED' });
    await create({ title: 'Dropped', dueDate: day(1), status: 'CANCELLED' });

    const { taskCounts, upcomingTasks } = await dashboard();
    expect(taskCounts).toEqual({ pending: 6, blocked: 1, completed: 1, overdue: 2 });
    expect(pluck(upcomingTasks, 'title')).toEqual([
      'Very old',
      'Yesterday',
      'Today',
      'In a week',
      'In a week, low',
    ]);
    expect(upcomingTasks[0]).toMatchObject({ isOverdue: true, status: 'BLOCKED' });
    expect(upcomingTasks[2]).toMatchObject({ isDueToday: true });
  });

  it('records each change once when two saves arrive together (review P7-M1)', async () => {
    const { create, update, history, agent, base } = await setUp();
    const task = await create({ title: 'Book DJ' });
    await Promise.all([
      update(task.id, { status: 'COMPLETED' }),
      update(task.id, { status: 'COMPLETED' }),
    ]);
    expect(pluck(await history(task.id), 'action')).toEqual(['STATUS_CHANGED', 'CREATED']);

    // Different fields from two tabs: both kept, each recorded once against the right value.
    await Promise.all([
      update(task.id, { priority: 'URGENT' }),
      update(task.id, { status: 'BLOCKED' }),
    ]);
    const current = (await agent.get(`${base}/tasks/${task.id}`).expect(200)).body.data;
    expect(current).toMatchObject({ priority: 'URGENT', status: 'BLOCKED' });
    const entries = await history(task.id);
    expect(entries.filter((entry) => entry.action === 'STATUS_CHANGED')).toHaveLength(2);
    expect(entries.filter((entry) => entry.action === 'UPDATED')).toEqual([
      expect.objectContaining({ oldValue: { priority: 'MEDIUM' } }),
    ]);
  });

  it('refuses another wedding’s task on every route, and its events', async () => {
    const { agent, base, me, create } = await setUp();
    const task = await create({ title: 'Ours' });
    const other = await workspace.owner();
    const theirBase = `/api/v1/weddings/${other.weddingId}`;
    const viaTheirWedding = `${theirBase}/tasks/${task.id}`;
    const theirId = (await other.agent.get('/api/v1/me').expect(200)).body.data.user.id as string;
    const responses = [
      await other.agent.patch(viaTheirWedding).send({ title: 'Taken' }),
      await other.agent.delete(viaTheirWedding),
      await other.agent.post(`${viaTheirWedding}/assignees`).send({ userId: theirId }),
      await other.agent.delete(`${viaTheirWedding}/assignees/${me.id}`),
      await other.agent.get(`${viaTheirWedding}/activities`),
    ];
    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('TASK_NOT_FOUND');
    }

    const theirEvent = (
      await other.agent
        .post(`${theirBase}/events`)
        .send({ name: 'Theirs', type: 'CUSTOM', date: day(5) })
        .expect(201)
    ).body.data.id as string;
    const moved = await agent
      .patch(`${base}/tasks/${task.id}`)
      .send({ eventId: theirEvent })
      .expect(404);
    expect(moved.body.error.code).toBe('EVENT_NOT_FOUND');
    expect((await agent.get(`${base}/tasks/${task.id}`).expect(200)).body.data.eventId).toBeNull();
  });

  it('answers a malformed assignee ID with MEMBER_NOT_FOUND, not a server error', async () => {
    const { agent, base, create } = await setUp();
    const task = await create({ title: 'Flowers' });
    const unassign = await agent.delete(`${base}/tasks/${task.id}/assignees/abc`).expect(404);
    expect(unassign.body.error.code).toBe('MEMBER_NOT_FOUND');
    const assign = await agent
      .post(`${base}/tasks/${task.id}/assignees`)
      .send({ userId: 'abc' })
      .expect(404);
    expect(assign.body.error.code).toBe('MEMBER_NOT_FOUND');
  });

  it('pages tasks with the same due date and priority, and with filters, without gaps', async () => {
    const { create, list } = await setUp();
    const titles: string[] = [];
    for (let i = 1; i <= 7; i++) {
      const title = `Same day ${i}`;
      titles.push(title);
      await create({ title, dueDate: day(2), priority: 'HIGH' });
    }
    await create({ title: 'Other priority', dueDate: day(2), priority: 'LOW' });

    const collect = async (query: string) => {
      const seen: unknown[] = [];
      let cursor: string | null = null;
      do {
        const page = await list(`?limit=3${query}${cursor ? `&cursor=${cursor}` : ''}`);
        seen.push(...pluck(page.data, 'title'));
        cursor = page.meta.pagination.nextCursor;
      } while (cursor);
      return seen;
    };

    const all = await collect('');
    expect(all).toHaveLength(8);
    expect(new Set(all).size).toBe(8);
    // Same date and priority: newest first, and "Other priority" (Low) after them.
    expect(all).toEqual([...titles].reverse().concat('Other priority'));

    const high = await collect('&priority=HIGH&search=same');
    expect(high).toEqual([...titles].reverse());
  });

  it('keeps each wedding’s tasks private and requires sign-in', async () => {
    const { base, create } = await setUp();
    const task = await create({ title: 'Private' });
    const other = await workspace.owner();
    await other.agent.get(`${base}/tasks`).expect(404);
    await other.agent.get(`${base}/tasks/${task.id}`).expect(404);
    await other.agent.get(`/api/v1/weddings/${other.weddingId}/tasks/${task.id}`).expect(404);
    await request(workspace.server()).get(`${base}/tasks`).expect(401);
    const ownList = (await other.agent.get(`/api/v1/weddings/${other.weddingId}/tasks`).expect(200))
      .body.data as Agent[];
    expect(ownList).toEqual([]);
  });

  it('never leaves a task linked to an event deleted at the same moment (review P8-M1)', async () => {
    const { agent, base, event } = await setUp();
    for (let round = 0; round < 6; round += 1) {
      const eventId = await event(`Race ${round}`);
      await Promise.all([
        agent.post(`${base}/tasks`).send({ title: `Race ${round}`, eventId }),
        agent.delete(`${base}/events/${eventId}`),
      ]);
    }
    const deleted = await workspace.connection
      .collection('events')
      .find({ deletedAt: { $exists: true } }, { projection: { _id: 1 } })
      .toArray();
    const dangling = await workspace.connection.collection('tasks').countDocuments({
      eventId: { $in: deleted.map((row) => row._id) },
      deletedAt: { $exists: false },
    });
    expect(dangling).toBe(0);
  });
});
