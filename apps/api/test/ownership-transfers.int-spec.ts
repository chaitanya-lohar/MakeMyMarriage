import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startWorkspaceApp, type Agent, type WorkspaceApp } from './support/workspace-app.js';

/** Ownership-seat transfer (Database Design §7.6, P10-5, 0034 R3). */
describe('Ownership transfers', () => {
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
  const userIdOf = async (agent: Agent) =>
    (await agent.get('/api/v1/me').expect(200)).body.data.user.id as string;

  async function join(weddingId: string, fields: Record<string, unknown>) {
    const agent = await workspace.signedInUser();
    const { insertedId } = await memberships().insertOne({
      weddingId: new Types.ObjectId(weddingId),
      userId: new Types.ObjectId(await userIdOf(agent)),
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...fields,
    });
    return { agent, membershipId: insertedId.toHexString() };
  }

  /** Owners A (seat 1, the creator) and B (seat 2), and member C. */
  async function couple() {
    const a = await workspace.owner();
    const base = `/api/v1/weddings/${a.weddingId}`;
    const b = await join(a.weddingId, { memberType: 'OWNER', role: 'OWNER', ownerSeat: 2 });
    const c = await join(a.weddingId, { memberType: 'MEMBER', role: 'ORGANIZER' });
    const aMembershipId = (
      await memberships().findOne({
        weddingId: new Types.ObjectId(a.weddingId),
        userId: new Types.ObjectId(await userIdOf(a.agent)),
      })
    )?._id.toHexString() as string;
    return { a: { ...a, membershipId: aMembershipId }, b, c, base };
  }

  it('moves one seat: C becomes owner, A an Admin, B stays owner', async () => {
    const { a, b, c, base } = await couple();
    const offer = (
      await a.agent
        .post(`${base}/ownership-transfers`)
        .send({ toMembershipId: c.membershipId })
        .expect(201)
    ).body.data;
    expect(offer).toMatchObject({ status: 'PENDING', ownerSeat: 1 });

    const seen = (await c.agent.get(`${base}/ownership-transfers`).expect(200)).body.data as {
      id: string;
    }[];
    expect(seen.map((t) => t.id)).toEqual([offer.id]);

    const done = (
      await c.agent.post(`${base}/ownership-transfers/${offer.id as string}/accept`).expect(200)
    ).body.data;
    expect(done.giver).toMatchObject({ role: 'ADMIN', isOwner: false });
    expect(done.recipient).toMatchObject({ role: 'OWNER', isOwner: true });

    const rows = await memberships()
      .find({ weddingId: new Types.ObjectId((await a.agent.get(base)).body.data.id as string) })
      .toArray();
    const byId = new Map(rows.map((row) => [row._id.toHexString(), row]));
    expect(byId.get(a.membershipId)).toMatchObject({ memberType: 'MEMBER', role: 'ADMIN' });
    expect(byId.get(a.membershipId)?.ownerSeat).toBeUndefined();
    expect(byId.get(b.membershipId)).toMatchObject({ memberType: 'OWNER', ownerSeat: 2 });
    expect(byId.get(c.membershipId)).toMatchObject({ memberType: 'OWNER', ownerSeat: 1 });

    const audit = (await c.agent.get(`${base}/audit-logs?action=OWNERSHIP_TRANSFERRED`).expect(200))
      .body.data;
    expect(audit).toHaveLength(1);
  });

  it('never lets a wedding have a third owner', async () => {
    const { a } = await couple();
    const third = await workspace.signedInUser();
    await expect(
      memberships().insertOne({
        weddingId: new Types.ObjectId(a.weddingId),
        userId: new Types.ObjectId(await userIdOf(third)),
        memberType: 'OWNER',
        role: 'OWNER',
        status: 'ACTIVE',
        ownerSeat: 1,
      }),
    ).rejects.toThrow(/duplicate key/);
  });

  it('lets only owners offer, one offer at a time, and only to a non-owner member', async () => {
    const { a, b, c, base } = await couple();
    const refused = await c.agent
      .post(`${base}/ownership-transfers`)
      .send({ toMembershipId: a.membershipId })
      .expect(403);
    expect(refused.body.error.details.reason).toBe('OWNER_ONLY');
    await a.agent
      .post(`${base}/ownership-transfers`)
      .send({ toMembershipId: b.membershipId })
      .expect(400);
    await a.agent
      .post(`${base}/ownership-transfers`)
      .send({ toMembershipId: c.membershipId })
      .expect(201);
    const second = await b.agent
      .post(`${base}/ownership-transfers`)
      .send({ toMembershipId: c.membershipId })
      .expect(409);
    expect(second.body.error.code).toBe('OWNERSHIP_TRANSFER_ALREADY_PENDING');
  });

  it('refuses a recipient who already owns another wedding', async () => {
    const { a, base } = await couple();
    const other = await workspace.owner();
    const { insertedId } = await memberships().insertOne({
      weddingId: new Types.ObjectId(a.weddingId),
      userId: new Types.ObjectId(await userIdOf(other.agent)),
      memberType: 'MEMBER',
      role: 'VIEWER',
      status: 'ACTIVE',
    });
    const response = await a.agent
      .post(`${base}/ownership-transfers`)
      .send({ toMembershipId: insertedId.toHexString() })
      .expect(409);
    expect(response.body.error.code).toBe('WEDDING_ALREADY_OWNED');
  });

  it('lets the recipient decline and the giver cancel; only they may', async () => {
    const { a, b, c, base } = await couple();
    const offer = async () =>
      (
        await a.agent
          .post(`${base}/ownership-transfers`)
          .send({ toMembershipId: c.membershipId })
          .expect(201)
      ).body.data.id as string;

    const first = await offer();
    await b.agent.post(`${base}/ownership-transfers/${first}/accept`).expect(403);
    await c.agent.post(`${base}/ownership-transfers/${first}/decline`).expect(204);
    await c.agent.post(`${base}/ownership-transfers/${first}/accept`).expect(409);

    const second = await offer();
    await c.agent.post(`${base}/ownership-transfers/${second}/cancel`).expect(403);
    await a.agent.post(`${base}/ownership-transfers/${second}/cancel`).expect(204);
    await c.agent.post(`${base}/ownership-transfers/${second}/accept`).expect(409);
  });

  it('cancels the offer when the recipient is removed', async () => {
    const { a, c, base } = await couple();
    const id = (
      await a.agent
        .post(`${base}/ownership-transfers`)
        .send({ toMembershipId: c.membershipId })
        .expect(201)
    ).body.data.id as string;
    await a.agent.delete(`${base}/members/${c.membershipId}`).expect(204);
    const offers = (await a.agent.get(`${base}/ownership-transfers`).expect(200)).body.data as {
      id: string;
      status: string;
    }[];
    expect(offers.find((t) => t.id === id)).toMatchObject({ status: 'CANCELLED' });
  });

  it('applies a transfer once even when accepted twice at the same time', async () => {
    const { a, c, base } = await couple();
    const id = (
      await a.agent
        .post(`${base}/ownership-transfers`)
        .send({ toMembershipId: c.membershipId })
        .expect(201)
    ).body.data.id as string;
    const results = await Promise.all([
      c.agent.post(`${base}/ownership-transfers/${id}/accept`),
      c.agent.post(`${base}/ownership-transfers/${id}/accept`),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const owners = await memberships().countDocuments({
      weddingId: new Types.ObjectId(a.weddingId),
      memberType: 'OWNER',
    });
    expect(owners).toBe(2);
  });
});
