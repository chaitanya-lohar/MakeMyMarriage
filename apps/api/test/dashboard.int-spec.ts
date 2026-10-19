import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { todayIn } from '../src/modules/dashboard/domain/rules/dashboard-rules.js';
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

describe('Dashboard', () => {
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

  async function setUp() {
    const { agent, weddingId } = await workspace.owner();
    const base = `/api/v1/weddings/${weddingId}`;
    const event = async (body: Record<string, unknown>) =>
      (await agent.post(`${base}/events`).send(body).expect(201)).body.data.id as string;
    const guest = async (name: string, mobile: string) =>
      (await agent.post(`${base}/guests`).send({ name, mobile }).expect(201)).body.data.guest
        .id as string;
    const assign = async (guestId: string, eventId: string) =>
      (await agent.post(`${base}/guests/${guestId}/events`).send({ eventId }).expect(201)).body.data
        .id as string;
    const rsvp = (assignmentId: string, rsvpStatus: string, attendeeCount: number | null) =>
      agent
        .patch(`${base}/guest-events/${assignmentId}`)
        .send({ rsvpStatus, attendeeCount })
        .expect(200);
    const dashboard = async (who: Agent = agent) =>
      (await who.get(`${base}/dashboard`).expect(200)).body.data as {
        upcomingEvents: Record<string, unknown>[];
        guestTotals: { guests: number };
        rsvpBreakdown: Record<string, number>;
      };
    return { agent, base, event, guest, assign, rsvp, dashboard };
  }

  it('is empty for a new wedding', async () => {
    const { dashboard } = await setUp();
    expect(await dashboard()).toEqual({
      upcomingEvents: [],
      guestTotals: { guests: 0 },
      rsvpBreakdown: { pending: 0, attending: 0, declined: 0, maybe: 0 },
      // Phase 7 (0026 #20); the task summaries are tested in tasks.int-spec.ts.
      taskCounts: { pending: 0, blocked: 0, completed: 0, overdue: 0 },
      upcomingTasks: [],
    });
  });

  it('lists at most five upcoming events, from today, untimed first on their day', async () => {
    const { event, dashboard } = await setUp();
    await event({ name: 'Yesterday', type: 'CUSTOM', date: day(-1) });
    // Dated today but already over: still upcoming (date-only rule, 0022 #3).
    await event({
      name: 'Today morning',
      type: 'HALDI',
      date: day(0),
      startTime: '00:00',
      endTime: '00:01',
    });
    await event({ name: 'Today untimed', type: 'CUSTOM', date: day(0) });
    await event({ name: 'Day 2', type: 'SANGEET', date: day(2), startTime: '19:00' });
    await event({
      name: 'Day 1',
      type: 'MEHENDI',
      date: day(1),
      startTime: '16:00',
      venue: { name: 'Garden Palace' },
    });
    await event({ name: 'Day 3', type: 'WEDDING', date: day(3) });
    await event({ name: 'Day 4', type: 'RECEPTION', date: day(4) });

    const { upcomingEvents } = await dashboard();
    expect(pluck(upcomingEvents, 'name')).toEqual([
      'Today untimed',
      'Today morning',
      'Day 1',
      'Day 2',
      'Day 3',
    ]);
    expect(upcomingEvents[2]).toEqual({
      id: expect.any(String),
      name: 'Day 1',
      type: 'MEHENDI',
      date: day(1),
      startTime: '16:00',
      endTime: null,
      venueName: 'Garden Palace',
      expectedAttendees: 0,
    });
  });

  it('counts guests, RSVPs across past and future events, and expected attendees per event', async () => {
    const { base, agent, event, guest, assign, rsvp, dashboard } = await setUp();
    const past = await event({ name: 'Roka', type: 'CUSTOM', date: day(-10) });
    const haldi = await event({ name: 'Haldi', type: 'HALDI', date: day(1) });
    const sangeet = await event({ name: 'Sangeet', type: 'SANGEET', date: day(2) });

    const raju = await guest('Raju', '9876543210');
    const sunita = await guest('Sunita', '9876543211');
    const kavita = await guest('Kavita', '9876543212');
    await guest('Unassigned', '9876543213');

    await rsvp(await assign(raju, past), 'ATTENDING', 3);
    await rsvp(await assign(raju, haldi), 'ATTENDING', 4);
    await rsvp(await assign(sunita, haldi), 'ATTENDING', 2);
    await rsvp(await assign(kavita, haldi), 'DECLINED', 0);
    await rsvp(await assign(raju, sangeet), 'MAYBE', null);
    await assign(sunita, sangeet); // PENDING

    const result = await dashboard();
    expect(result.guestTotals).toEqual({ guests: 4 });
    // Six counted assignments; Raju counts once per event (three times).
    expect(result.rsvpBreakdown).toEqual({ pending: 1, attending: 3, declined: 1, maybe: 1 });
    expect(result.upcomingEvents.map((item) => [item.name, item.expectedAttendees])).toEqual([
      ['Haldi', 6],
      ['Sangeet', 0],
    ]);

    // Deleted guests, deleted events and removed assignments are excluded everywhere.
    await agent.delete(`${base}/guests/${sunita}`).expect(204);
    await agent.delete(`${base}/events/${past}`).expect(204);
    const afterDeletes = await dashboard();
    expect(afterDeletes.guestTotals).toEqual({ guests: 3 });
    expect(afterDeletes.rsvpBreakdown).toEqual({ pending: 0, attending: 1, declined: 1, maybe: 1 });
    expect(afterDeletes.upcomingEvents.map((item) => item.expectedAttendees)).toEqual([4, 0]);
  });

  it('keeps each wedding’s dashboard private', async () => {
    const { base } = await setUp();
    const stranger = await workspace.signedInUser();
    const response = await stranger.get(`${base}/dashboard`).expect(404);
    expect(response.body.error.code).toBe('WEDDING_NOT_FOUND');
  });
});
