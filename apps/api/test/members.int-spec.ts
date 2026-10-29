import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startWorkspaceApp, type Agent, type WorkspaceApp } from './support/workspace-app.js';

type Role = 'ADMIN' | 'ORGANIZER' | 'EDITOR' | 'VIEWER';
type Override = { module: string; action: string; effect: 'ALLOW' | 'DENY' };
interface Member {
  membershipId: string;
  userId: string;
  displayName: string;
  isOwner: boolean;
  role?: string;
  hasOverrides?: boolean;
}

/** An admin granted organizer management, except removing (P10-4 limits still apply). */
const MANAGING_ADMIN: Override[] = [
  { module: 'MEMBERS', action: 'VIEW', effect: 'ALLOW' },
  { module: 'MEMBERS', action: 'CHANGE_ROLE', effect: 'ALLOW' },
  { module: 'MEMBERS', action: 'EDIT_PERMISSIONS', effect: 'ALLOW' },
  { module: 'MEMBERS', action: 'REMOVE', effect: 'ALLOW' },
];

/** Members, their permissions and the audit history (API Design §7.1, decision 0034). */
describe('Members', () => {
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

  async function member(weddingId: string, role: Role, permissionOverrides: Override[] = []) {
    const agent = await workspace.signedInUser();
    const userId = (await agent.get('/api/v1/me').expect(200)).body.data.user.id as string;
    const { insertedId } = await memberships().insertOne({
      weddingId: new Types.ObjectId(weddingId),
      userId: new Types.ObjectId(userId),
      memberType: 'MEMBER',
      role,
      status: 'ACTIVE',
      ...(permissionOverrides.length > 0 && { permissionOverrides }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { agent, userId, membershipId: insertedId.toHexString() };
  }

  async function wedding() {
    const owner = await workspace.owner();
    const base = `/api/v1/weddings/${owner.weddingId}`;
    const list = async (agent: Agent, query = '') =>
      (await agent.get(`${base}/members${query}`).expect(200)).body.data as Member[];
    return { ...owner, base, list };
  }

  const reason = (body: { error: { code: string; details?: { reason?: string } } }) => {
    expect(body.error.code).toBe('PERMISSION_DENIED');
    return body.error.details?.reason;
  };

  it('lists owners first; directory fields for everyone, details with MEMBERS:VIEW', async () => {
    const { agent: owner, weddingId, base, list } = await wedding();
    const viewer = await member(weddingId, 'VIEWER');

    const full = await list(owner);
    expect(full.map((m) => m.isOwner)).toEqual([true, false]);
    expect(full[1]).toMatchObject({ role: 'VIEWER', hasOverrides: false });

    const directory = await list(viewer.agent);
    expect(Object.keys(directory[1]!).sort()).toEqual([
      'displayName',
      'isOwner',
      'membershipId',
      'userId',
    ]);
    reason((await viewer.agent.get(`${base}/members?status=REVOKED`).expect(403)).body);
  });

  it("returns the caller's own permissions, and others' only with MEMBERS:VIEW", async () => {
    const { agent: owner, weddingId, base } = await wedding();
    const editor = await member(weddingId, 'EDITOR');

    const mine = (await editor.agent.get(`${base}/members/me/permissions`).expect(200)).body.data;
    expect(mine).toMatchObject({ role: 'EDITOR', isOwner: false, overrides: [] });
    expect(mine.permissions.EVENTS).toEqual(['VIEW', 'CREATE', 'EDIT']);
    expect(mine.permissions).not.toHaveProperty('MEMBERS');

    await owner.get(`${base}/members/${editor.membershipId}/permissions`).expect(200);
    reason(
      (await editor.agent.get(`${base}/members/${editor.membershipId}/permissions`).expect(403))
        .body,
    );
  });

  it('lets an owner change a role, keeping the custom permissions, and audits it', async () => {
    const { agent: owner, weddingId, base } = await wedding();
    const organizer = await member(weddingId, 'ORGANIZER', [
      { module: 'INVITATIONS', action: 'SEND', effect: 'ALLOW' },
    ]);

    const updated = (
      await owner
        .patch(`${base}/members/${organizer.membershipId}`)
        .send({ role: 'VIEWER' })
        .expect(200)
    ).body.data as Member;
    expect(updated).toMatchObject({ role: 'VIEWER', hasOverrides: true });

    const audit = (await owner.get(`${base}/audit-logs?action=MEMBER_ROLE_CHANGED`).expect(200))
      .body.data;
    expect(audit[0].metadata).toMatchObject({ oldRole: 'ORGANIZER', newRole: 'VIEWER' });
  });

  it('stores only overrides that differ from the role defaults', async () => {
    const { agent: owner, weddingId, base } = await wedding();
    const organizer = await member(weddingId, 'ORGANIZER');

    const body = {
      permissionOverrides: [
        { module: 'EVENTS', action: 'VIEW', effect: 'ALLOW' },
        { module: 'EXPENSES', action: 'CREATE', effect: 'ALLOW' },
      ],
    };
    await owner.patch(`${base}/members/${organizer.membershipId}`).send(body).expect(200);
    const stored = await memberships().findOne({ _id: new Types.ObjectId(organizer.membershipId) });
    expect(stored?.permissionOverrides).toEqual([
      { module: 'EXPENSES', action: 'CREATE', effect: 'ALLOW' },
    ]);
    await organizer.agent
      .post(`${base}/expenses`)
      .send({ title: 'Venue', amountMinor: 100, category: 'VENUE', expenseDate: '2027-01-10' })
      .expect(201);
  });

  it('refuses invalid changes with 400', async () => {
    const { agent: owner, weddingId, base } = await wedding();
    const viewer = await member(weddingId, 'VIEWER');
    const url = `${base}/members/${viewer.membershipId}`;

    await owner.patch(url).send({}).expect(400);
    await owner.patch(url).send({ role: 'OWNER' }).expect(400);
    await owner
      .patch(url)
      .send({
        permissionOverrides: [{ module: 'PARTNER_SHARING', action: 'VIEW', effect: 'ALLOW' }],
      })
      .expect(400);
    await owner
      .patch(url)
      .send({ permissionOverrides: [{ module: 'EVENTS', action: 'PUBLISH', effect: 'ALLOW' }] })
      .expect(400);
  });

  it('applies the Admin limits of P10-4 and audits each refusal', async () => {
    const { agent: owner, weddingId, base, list } = await wedding();
    const admin = await member(weddingId, 'ADMIN', MANAGING_ADMIN);
    const otherAdmin = await member(weddingId, 'ADMIN');
    const editor = await member(weddingId, 'EDITOR');
    const ownerId = (await list(owner)).find((m) => m.isOwner)!.membershipId;
    const patch = (membershipId: string, body: object) =>
      admin.agent.patch(`${base}/members/${membershipId}`).send(body).expect(403);

    expect(reason((await patch(ownerId, { role: 'VIEWER' })).body)).toBe(
      'OWNER_MEMBERSHIP_PROTECTED',
    );
    expect(reason((await patch(admin.membershipId, { role: 'VIEWER' })).body)).toBe(
      'SELF_MODIFICATION_NOT_ALLOWED',
    );
    expect(reason((await patch(otherAdmin.membershipId, { role: 'VIEWER' })).body)).toBe(
      'ADMIN_MEMBERSHIP_OWNER_ONLY',
    );
    expect(reason((await patch(editor.membershipId, { role: 'ADMIN' })).body)).toBe(
      'ADMIN_ROLE_OWNER_ONLY',
    );
    expect(
      reason(
        (
          await patch(editor.membershipId, {
            permissionOverrides: [{ module: 'INVITATIONS', action: 'SEND', effect: 'ALLOW' }],
          })
        ).body,
      ),
    ).toBe('GRANT_EXCEEDS_CALLER');
    expect(
      reason(
        (await admin.agent.delete(`${base}/members/${otherAdmin.membershipId}`).expect(403)).body,
      ),
    ).toBe('ADMIN_MEMBERSHIP_OWNER_ONLY');

    // Within the limits the admin may manage an editor, and an owner may make an admin.
    await admin.agent
      .patch(`${base}/members/${editor.membershipId}`)
      .send({ role: 'VIEWER' })
      .expect(200);
    await owner.patch(`${base}/members/${editor.membershipId}`).send({ role: 'ADMIN' }).expect(200);

    const denied = (await owner.get(`${base}/audit-logs?action=PERMISSION_DENIED`).expect(200)).body
      .data as { metadata: { reason?: string; outcome: string } }[];
    expect(denied).toHaveLength(6);
    expect(denied.every((entry) => entry.metadata.outcome === 'DENIED')).toBe(true);
  });

  it('refuses a change without the specific MEMBERS action', async () => {
    const { weddingId, base } = await wedding();
    const admin = await member(weddingId, 'ADMIN', [
      { module: 'MEMBERS', action: 'VIEW', effect: 'ALLOW' },
    ]);
    const viewer = await member(weddingId, 'VIEWER');
    reason(
      (
        await admin.agent
          .patch(`${base}/members/${viewer.membershipId}`)
          .send({ role: 'EDITOR' })
          .expect(403)
      ).body,
    );
  });

  it('removes a member: no access from the next request, row kept, audited', async () => {
    const { agent: owner, weddingId, base, list } = await wedding();
    const viewer = await member(weddingId, 'VIEWER');

    await viewer.agent.get(`${base}/events`).expect(200);
    await owner.delete(`${base}/members/${viewer.membershipId}`).expect(204);
    await viewer.agent.get(`${base}/events`).expect(404);
    await owner.delete(`${base}/members/${viewer.membershipId}`).expect(404);

    const removed = await list(owner, '?status=REVOKED');
    expect(removed.map((m) => m.membershipId)).toEqual([viewer.membershipId]);
    const stored = await memberships().findOne({ _id: new Types.ObjectId(viewer.membershipId) });
    expect(stored).toMatchObject({ status: 'REVOKED' });
    const audit = (await owner.get(`${base}/audit-logs?action=MEMBER_REMOVED`).expect(200)).body
      .data;
    expect(audit).toHaveLength(1);
  });

  it('shows the audit history newest first, page by page, only with AUDIT:VIEW', async () => {
    const { agent: owner, weddingId, base } = await wedding();
    const viewer = await member(weddingId, 'VIEWER');
    for (const role of ['EDITOR', 'ORGANIZER', 'VIEWER']) {
      await owner.patch(`${base}/members/${viewer.membershipId}`).send({ role }).expect(200);
    }

    type Page = {
      data: { actorName: string | null; metadata: { newRole: string } }[];
      meta: { pagination: { nextCursor: string | null } };
    };
    const first = (await owner.get(`${base}/audit-logs?limit=2`).expect(200)).body as Page;
    expect(first.data.map((e) => e.metadata.newRole)).toEqual(['VIEWER', 'ORGANIZER']);
    expect(first.data[0]?.actorName).toBeTruthy();
    const cursor = first.meta.pagination.nextCursor!;
    const second = (
      await owner.get(`${base}/audit-logs?limit=2&cursor=${encodeURIComponent(cursor)}`).expect(200)
    ).body;
    expect(second.data).toHaveLength(1);
    expect(second.meta.pagination.nextCursor).toBeNull();

    await owner.get(`${base}/audit-logs?cursor=nonsense`).expect(400);
    reason((await viewer.agent.get(`${base}/audit-logs`).expect(403)).body);
  });

  it('lists each wedding with the caller’s own role, the owned one first', async () => {
    const mine = await wedding();
    const other = await wedding();
    const userId = (await mine.agent.get('/api/v1/me').expect(200)).body.data.user.id as string;
    await memberships().insertOne({
      weddingId: new Types.ObjectId(other.weddingId),
      userId: new Types.ObjectId(userId),
      memberType: 'MEMBER',
      role: 'ORGANIZER',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const weddings = (await mine.agent.get('/api/v1/weddings').expect(200)).body.data as {
      id: string;
      membership: { role: string; isOwner: boolean };
    }[];
    expect(weddings.map((w) => [w.id, w.membership.role, w.membership.isOwner])).toEqual([
      [mine.weddingId, 'OWNER', true],
      [other.weddingId, 'ORGANIZER', false],
    ]);
    const one = (await mine.agent.get(other.base).expect(200)).body.data;
    expect(one.membership).toMatchObject({ role: 'ORGANIZER', isOwner: false });
  });
});
