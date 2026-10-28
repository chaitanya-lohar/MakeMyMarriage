import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startWorkspaceApp, type Agent, type WorkspaceApp } from './support/workspace-app.js';

type Role = 'ADMIN' | 'ORGANIZER' | 'EDITOR' | 'VIEWER';
type Override = { module: string; action: string; effect: 'ALLOW' | 'DENY' };

const EVENT = { name: 'Mehendi', type: 'MEHENDI', date: '2027-02-16' };
const EXPENSE = {
  title: 'Decorator',
  amountMinor: 100,
  category: 'DECORATION',
  expenseDate: '2027-01-10',
};

/**
 * Phase 10 authorization on the Phase 3–9 routes (API Design §23, decision 0034): a member
 * without the route's permission gets 403, a non-member or removed member 404, overrides
 * change the role defaults, and guest links are owner-only by default.
 */
describe('Route permissions', () => {
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

  const memberships = () => workspace.connection.collection('wedding_memberships');

  /** A signed-in user added to the wedding as a non-owner member with `role`. */
  async function member(
    weddingId: string,
    role: Role,
    permissionOverrides: Override[] = [],
  ): Promise<{ agent: Agent; userId: string }> {
    const agent = await workspace.signedInUser();
    const userId = (await agent.get('/api/v1/me').expect(200)).body.data.user.id as string;
    await memberships().insertOne({
      weddingId: new Types.ObjectId(weddingId),
      userId: new Types.ObjectId(userId),
      memberType: 'MEMBER',
      role,
      status: 'ACTIVE',
      ...(permissionOverrides.length > 0 && { permissionOverrides }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { agent, userId };
  }

  async function wedding() {
    const owner = await workspace.owner();
    return { ...owner, base: `/api/v1/weddings/${owner.weddingId}` };
  }

  const denied = (body: { error: { code: string } }) =>
    expect(body.error.code).toBe('PERMISSION_DENIED');

  it('lets each role do exactly what the default matrix gives it', async () => {
    const { agent: owner, weddingId, base } = await wedding();
    const event = (await owner.post(`${base}/events`).send(EVENT).expect(201)).body.data as {
      id: string;
    };
    const viewer = await member(weddingId, 'VIEWER');
    const editor = await member(weddingId, 'EDITOR');
    const organizer = await member(weddingId, 'ORGANIZER');

    // Viewer: view only.
    await viewer.agent.get(`${base}/events`).expect(200);
    denied((await viewer.agent.post(`${base}/events`).send(EVENT).expect(403)).body);

    // Editor: view, create, edit — never delete.
    await editor.agent.post(`${base}/events`).send(EVENT).expect(201);
    await editor.agent.patch(`${base}/events/${event.id}`).send({ name: 'Haldi' }).expect(200);
    denied((await editor.agent.delete(`${base}/events/${event.id}`).expect(403)).body);

    // Organizer: manages events, but only views expenses.
    await organizer.agent.get(`${base}/expenses`).expect(200);
    denied((await organizer.agent.post(`${base}/expenses`).send(EXPENSE).expect(403)).body);
    await organizer.agent.delete(`${base}/events/${event.id}`).expect(204);
  });

  it('keeps wedding settings and guest links away from non-owners by default', async () => {
    const { agent: owner, weddingId, base } = await wedding();
    const guest = (
      await owner
        .post(`${base}/guests`)
        .send({ name: 'Raju Sharma', mobile: '+91 98201 22334' })
        .expect(201)
    ).body.data.guest as { id: string };
    await owner.post(`${base}/guests/${guest.id}/invitation`).expect(201);
    const admin = await member(weddingId, 'ADMIN');

    denied((await admin.agent.patch(base).send({ venueName: 'Lakeside' }).expect(403)).body);
    // INVITATIONS Manage still excludes sending, retrieving, regenerating and revoking links.
    await admin.agent.get(`${base}/guests/${guest.id}/invitation/deliveries`).expect(200);
    denied((await admin.agent.get(`${base}/guests/${guest.id}/invitation/link`).expect(403)).body);
    denied(
      (await admin.agent.post(`${base}/guests/${guest.id}/invitation/regenerate`).expect(403)).body,
    );
    await owner.get(`${base}/guests/${guest.id}/invitation/link`).expect(200);
  });

  it('grants an owner-only-by-default or Custom action through an ALLOW override', async () => {
    const { agent: owner, weddingId, base } = await wedding();
    const guest = (
      await owner
        .post(`${base}/guests`)
        .send({ name: 'Raju Sharma', mobile: '+91 98201 22334' })
        .expect(201)
    ).body.data.guest as { id: string };
    await owner.post(`${base}/guests/${guest.id}/invitation`).expect(201);
    const organizer = await member(weddingId, 'ORGANIZER', [
      { module: 'INVITATIONS', action: 'SEND', effect: 'ALLOW' },
    ]);
    const admin = await member(weddingId, 'ADMIN', [
      { module: 'WEDDING_SETTINGS', action: 'VIEW', effect: 'ALLOW' },
      { module: 'WEDDING_SETTINGS', action: 'EDIT', effect: 'ALLOW' },
    ]);

    await organizer.agent.get(`${base}/guests/${guest.id}/invitation/link`).expect(200);
    await admin.agent.patch(base).send({ venueName: 'Lakeside Garden' }).expect(200);
  });

  it('lets a DENY override beat the role default, and a DENY of VIEW close the module', async () => {
    const { weddingId, base } = await wedding();
    const organizer = await member(weddingId, 'ORGANIZER', [
      { module: 'TASKS', action: 'CREATE', effect: 'DENY' },
      { module: 'VENDORS', action: 'VIEW', effect: 'DENY' },
      { module: 'EVENTS', action: 'CREATE', effect: 'ALLOW' },
      { module: 'EVENTS', action: 'CREATE', effect: 'DENY' },
    ]);

    await organizer.agent.get(`${base}/tasks`).expect(200);
    denied((await organizer.agent.post(`${base}/tasks`).send({ title: 'Book' }).expect(403)).body);
    denied((await organizer.agent.get(`${base}/vendors`).expect(403)).body);
    denied((await organizer.agent.post(`${base}/events`).send(EVENT).expect(403)).body);
  });

  it('answers 404 to a non-member, a member of another wedding and a removed member', async () => {
    const { weddingId, base } = await wedding();
    const stranger = await workspace.signedInUser();
    const other = await wedding();
    const viewer = await member(weddingId, 'VIEWER');

    for (const agent of [stranger, other.agent]) {
      const response = await agent.get(`${base}/events`).expect(404);
      expect(response.body.error.code).toBe('WEDDING_NOT_FOUND');
    }

    await viewer.agent.get(`${base}/events`).expect(200);
    await memberships().updateOne(
      { weddingId: new Types.ObjectId(weddingId), userId: new Types.ObjectId(viewer.userId) },
      { $set: { status: 'REVOKED', revokedAt: new Date() } },
    );
    await viewer.agent.get(`${base}/events`).expect(404);
  });

  it('returns only the dashboard sections the member may view', async () => {
    const { agent: owner, weddingId, base } = await wedding();
    const viewer = await member(weddingId, 'VIEWER', [
      { module: 'EXPENSES', action: 'VIEW', effect: 'DENY' },
    ]);

    const full = (await owner.get(`${base}/dashboard`).expect(200)).body.data;
    expect(full).toHaveProperty('expenseSummary');
    expect(full).toHaveProperty('upcomingEvents');

    const limited = (await viewer.agent.get(`${base}/dashboard`).expect(200)).body.data;
    expect(limited).not.toHaveProperty('expenseSummary');
    expect(limited).toHaveProperty('upcomingEvents');
    expect(limited).toHaveProperty('taskCounts');
    expect(limited).toHaveProperty('vendorSummary');
  });

  it('lets every member read the wedding itself', async () => {
    const { weddingId, base } = await wedding();
    const viewer = await member(weddingId, 'VIEWER');
    await viewer.agent.get(base).expect(200);
  });
});
