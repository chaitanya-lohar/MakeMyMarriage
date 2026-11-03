import { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  EmailSender,
  type EmailMessage,
  type EmailSendResult,
} from '../src/infrastructure/email/email-message.js';
import { startWorkspaceApp, type Agent, type WorkspaceApp } from './support/workspace-app.js';

class FakeEmailSender extends EmailSender {
  readonly providerName = 'TEST';
  readonly sent: EmailMessage[] = [];
  unreachable = false;

  send(message: EmailMessage): Promise<EmailSendResult> {
    if (this.unreachable) return Promise.reject(new Error('connect ECONNREFUSED'));
    this.sent.push(message);
    return Promise.resolve({ providerMessageId: `msg-${this.sent.length}` });
  }
}

/** Partner connection (decision 0038, Phase 16 PRD §10, API Design §7.2). */
describe('Partner connection', () => {
  let workspace: WorkspaceApp;
  const sender = new FakeEmailSender();
  let counter = 0;

  beforeAll(async () => {
    workspace = await startWorkspaceApp({}, { emailSender: sender });
  });

  beforeEach(async () => {
    await workspace.redis.flushdb();
    sender.sent.length = 0;
    sender.unreachable = false;
  });

  afterAll(async () => {
    await workspace?.stop();
  });

  const connections = () => workspace.connection.collection('partner_connections');
  const memberships = () => workspace.connection.collection('wedding_memberships');
  const transfers = () => workspace.connection.collection('ownership_transfers');
  const anonymous = () => request(workspace.server());
  const newEmail = () => `partner${++counter}.${Date.now()}@example.com`;

  async function account(email: string): Promise<Agent> {
    const agent = request.agent(workspace.server());
    await agent
      .post('/api/v1/auth/register')
      .send({ displayName: 'Aarav Mehta', email, password: 'correct horse battery' })
      .expect(201);
    return agent;
  }

  const userIdOf = async (agent: Agent) =>
    (await agent.get('/api/v1/me').expect(200)).body.data.user.id as string;

  function tokenFor(email: string): string {
    const message = sender.sent.filter((m) => m.to === email).at(-1);
    const match = /\/partner-invite\/([A-Za-z0-9_-]{43})/.exec(message?.text ?? '');
    if (!match) throw new Error(`no partner invitation email to ${email}`);
    return match[1]!;
  }

  async function wedding() {
    const owner = await workspace.owner();
    const base = `/api/v1/weddings/${owner.weddingId}`;
    const invite = (email: string, agent: Agent = owner.agent) =>
      agent.post(`${base}/partner/invitations`).send({ email });
    return { ...owner, base, invite };
  }

  /** A wedding whose partner has accepted. */
  async function connected() {
    const w = await wedding();
    const email = newEmail();
    const partner = await account(email);
    await w.invite(email).expect(201);
    const accepted = await partner
      .post(`/api/v1/partner-invitations/${tokenFor(email)}/accept`)
      .expect(200);
    return {
      ...w,
      partner,
      partnerEmail: email,
      partnerMembershipId: accepted.body.data.membershipId as string,
    };
  }

  const owners = async (weddingId: string) =>
    memberships()
      .find({ weddingId: new Types.ObjectId(weddingId), memberType: 'OWNER' })
      .toArray();

  it('invites by email; the invitee accepts and both are owners of the same wedding', async () => {
    const { agent, weddingId, base, invite } = await wedding();
    const email = newEmail();
    const before = Date.now();
    const created = (await invite(email).expect(201)).body.data;
    expect(created).toMatchObject({
      inviteeEmail: email,
      status: 'PENDING',
      emailSent: true,
      resendsLeft: 3,
    });
    const expiresIn = new Date(created.expiresAt as string).getTime() - before;
    expect(expiresIn).toBeGreaterThan(7 * 24 * 3600 * 1000 - 60_000);
    expect(expiresIn).toBeLessThanOrEqual(7 * 24 * 3600 * 1000 + 60_000);

    const token = tokenFor(email);
    const stored = await connections().findOne({ _id: new Types.ObjectId(created.id as string) });
    expect(stored?.tokenHash).not.toBe(token);
    expect(JSON.stringify(stored)).not.toContain(token);

    const details = (await anonymous().get(`/api/v1/partner-invitations/${token}`).expect(200)).body
      .data;
    expect(details).toMatchObject({
      status: 'PENDING',
      weddingDisplayName: 'Meera Sharma & Arjun Patel',
    });
    expect(details.emailHint).toMatch(/^pa\*\*\*@example\.com$/);

    const partner = await account(email);
    await partner.get(base).expect(404); // nothing before acceptance
    const accepted = (await partner.post(`/api/v1/partner-invitations/${token}/accept`).expect(200))
      .body.data;
    expect(accepted.weddingId).toBe(weddingId);

    expect((await owners(weddingId)).map((o) => o.ownerSeat as number).sort()).toEqual([1, 2]);
    await partner.get(`${base}/events`).expect(200);
    const state = (await agent.get(`${base}/partner`).expect(200)).body.data;
    expect(state.invitation).toBeNull();
    expect(state.partner).toMatchObject({ email, membershipId: accepted.membershipId });
    expect(state.partner.connectedAt).not.toBeNull();
    // The partner sees the inviter as their partner.
    const theirs = (await partner.get(`${base}/partner`).expect(200)).body.data;
    expect(theirs.partner.email).not.toBe(email);
    // The link is single-use.
    await partner.post(`/api/v1/partner-invitations/${token}/accept`).expect(409);
  });

  it('refuses another account, the own email, a second invitation and a two-owner wedding', async () => {
    const { agent, invite } = await wedding();
    const me = (await agent.get('/api/v1/me').expect(200)).body.data.user.email as string;
    const ownEmail = await invite(me.toUpperCase()).expect(400);
    expect(ownEmail.body.error.code).toBe('VALIDATION_FAILED');

    const email = newEmail();
    await invite(email).expect(201);
    expect((await invite(newEmail()).expect(409)).body.error.code).toBe(
      'PARTNER_INVITATION_ALREADY_PENDING',
    );
    const stranger = await account(newEmail());
    const mismatch = await stranger
      .post(`/api/v1/partner-invitations/${tokenFor(email)}/accept`)
      .expect(403);
    expect(mismatch.body.error.code).toBe('PARTNER_INVITATION_EMAIL_MISMATCH');

    const c = await connected();
    expect((await c.invite(newEmail()).expect(409)).body.error.code).toBe(
      'PARTNER_ALREADY_CONNECTED',
    );
  });

  it("hides one wedding's invitation from another wedding's owner", async () => {
    const { base, invite } = await wedding();
    const created = (await invite(newEmail()).expect(201)).body.data;
    const other = await wedding();
    await other.agent
      .post(`${base}/partner/invitations/${created.id as string}/resend`)
      .expect(404);
    await other.agent
      .post(`${other.base}/partner/invitations/${created.id as string}/revoke`)
      .expect(404);
  });

  it('resend issues a new token and resets the expiry; the fourth in a day is refused', async () => {
    const { agent, base, invite } = await wedding();
    const email = newEmail();
    const created = (await invite(email).expect(201)).body.data;
    const id = created.id as string;
    const first = tokenFor(email);
    await connections().updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: { expiresAt: new Date(Date.now() + 3600_000) } },
    );
    for (let i = 0; i < 3; i++) {
      const resent = (await agent.post(`${base}/partner/invitations/${id}/resend`).expect(200)).body
        .data;
      expect(resent.resendsLeft).toBe(2 - i);
      expect(new Date(resent.expiresAt as string).getTime()).toBeGreaterThan(
        Date.now() + 6 * 24 * 3600_000,
      );
    }
    expect(tokenFor(email)).not.toBe(first);
    await anonymous().get(`/api/v1/partner-invitations/${first}`).expect(404);
    expect(
      (await agent.post(`${base}/partner/invitations/${id}/resend`).expect(429)).body.error.code,
    ).toBe('RATE_LIMITED');

    await agent.post(`${base}/partner/invitations/${id}/revoke`).expect(204);
    const latest = tokenFor(email);
    const after = (await anonymous().get(`/api/v1/partner-invitations/${latest}`).expect(200)).body
      .data;
    expect(after.status).toBe('REVOKED');
    const partner = await account(email);
    expect(
      (await partner.post(`/api/v1/partner-invitations/${latest}/accept`).expect(409)).body.error
        .code,
    ).toBe('PARTNER_INVITATION_NOT_PENDING');
    // A new invitation can follow.
    await invite(newEmail()).expect(201);
  });

  it('expires after seven days and declines with the token alone', async () => {
    const { agent, base, invite } = await wedding();
    const email = newEmail();
    const created = (await invite(email).expect(201)).body.data;
    await connections().updateOne(
      { _id: new Types.ObjectId(created.id as string) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    const partner = await account(email);
    expect(
      (await partner.post(`/api/v1/partner-invitations/${tokenFor(email)}/accept`).expect(409)).body
        .error.code,
    ).toBe('PARTNER_INVITATION_EXPIRED');
    const state = (await agent.get(`${base}/partner`).expect(200)).body.data;
    expect(state.invitation).toMatchObject({ status: 'EXPIRED' });

    const next = newEmail();
    await invite(next).expect(201);
    await anonymous()
      .post(`/api/v1/partner-invitations/${tokenFor(next)}/decline`)
      .expect(204);
    await anonymous()
      .post(`/api/v1/partner-invitations/${tokenFor(next)}/decline`)
      .expect(409);
    expect((await agent.get(`${base}/partner`).expect(200)).body.data.invitation).toBeNull();
  });

  it('refuses an invitee who owns a wedding until they transfer it (D6)', async () => {
    const { invite } = await wedding();
    const email = newEmail();
    const partner = await account(email);
    await partner
      .post('/api/v1/weddings')
      .send({ brideName: 'Riya', groomName: 'Kabir' })
      .expect(201);
    await invite(email).expect(201);
    const refused = await partner
      .post(`/api/v1/partner-invitations/${tokenFor(email)}/accept`)
      .expect(409);
    expect(refused.body.error.code).toBe('PARTNER_INVITEE_OWNS_WEDDING');
    expect((await connections().findOne({ inviteeEmail: email }))?.status).toBe('PENDING');
  });

  it('promotes an existing organizer on the same membership, overrides cleared (D5)', async () => {
    const { weddingId, base, invite } = await wedding();
    const email = newEmail();
    const organizer = await account(email);
    const { insertedId } = await memberships().insertOne({
      weddingId: new Types.ObjectId(weddingId),
      userId: new Types.ObjectId(await userIdOf(organizer)),
      memberType: 'MEMBER',
      role: 'ORGANIZER',
      status: 'ACTIVE',
      permissionOverrides: [{ module: 'EXPENSES', action: 'VIEW', effect: 'DENY' }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await invite(email).expect(201);
    const accepted = (
      await organizer.post(`/api/v1/partner-invitations/${tokenFor(email)}/accept`).expect(200)
    ).body.data;
    expect(accepted.membershipId).toBe(insertedId.toHexString());
    const row = await memberships().findOne({ _id: insertedId });
    expect(row).toMatchObject({
      memberType: 'OWNER',
      role: 'OWNER',
      ownerSeat: 2,
      status: 'ACTIVE',
    });
    expect(row?.permissionOverrides).toBeUndefined();
    await organizer.get(`${base}/expenses`).expect(200);
    const audit = (
      await organizer.get(`${base}/audit-logs?action=MEMBER_PROMOTED_TO_OWNER`).expect(200)
    ).body.data;
    expect(audit).toHaveLength(1);
  });

  it('leaving: access ends at once, the other is sole owner, records stay (D7)', async () => {
    const c = await connected();
    const event = (
      await c.partner
        .post(`${c.base}/events`)
        .send({ name: 'Sangeet', type: 'SANGEET', date: '2027-02-16' })
        .expect(201)
    ).body.data;
    // A pending ownership offer from the partner to an organizer is cancelled by leaving.
    const organizer = await workspace.signedInUser();
    const { insertedId: organizerId } = await memberships().insertOne({
      weddingId: new Types.ObjectId(c.weddingId),
      userId: new Types.ObjectId(await userIdOf(organizer)),
      memberType: 'MEMBER',
      role: 'ORGANIZER',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await c.partner
      .post(`${c.base}/ownership-transfers`)
      .send({ toMembershipId: organizerId.toHexString() })
      .expect(201);

    await c.partner.post(`${c.base}/partner/leave`).expect(204);
    await c.partner.get(c.base).expect(404);
    await c.partner.get(`${c.base}/events`).expect(404);

    const row = await memberships().findOne({ _id: new Types.ObjectId(c.partnerMembershipId) });
    expect(row).toMatchObject({ memberType: 'MEMBER', role: 'VIEWER', status: 'REVOKED' });
    expect(row?.ownerSeat).toBeUndefined();
    expect((await owners(c.weddingId)).map((o) => o.ownerSeat as number)).toEqual([1]);
    expect(
      (await connections().findOne({ weddingId: new Types.ObjectId(c.weddingId) }))?.status,
    ).toBe('DISCONNECTED');
    expect(await transfers().findOne({ weddingId: new Types.ObjectId(c.weddingId) })).toMatchObject(
      {
        status: 'CANCELLED',
        cancelledReason: 'MEMBERSHIP_CHANGED',
      },
    );
    await c.agent.get(`${c.base}/events/${event.id as string}`).expect(200);
    const state = (await c.agent.get(`${c.base}/partner`).expect(200)).body.data;
    expect(state).toEqual({ partner: null, invitation: null });
    // The leaver no longer owns a wedding and may create one.
    await c.partner.post('/api/v1/weddings').send({ brideName: 'A', groomName: 'B' }).expect(201);
    // The sole owner cannot leave.
    expect((await c.agent.post(`${c.base}/partner/leave`).expect(409)).body.error.code).toBe(
      'PARTNER_NOT_CONNECTED',
    );
    const audit = (
      await c.agent.get(`${c.base}/audit-logs?action=PARTNER_DISCONNECTED`).expect(200)
    ).body.data;
    expect(audit).toHaveLength(1);
  });

  it('gives organizers no partner routes and offers no way to remove the other owner (D8)', async () => {
    const c = await connected();
    const organizer = await workspace.signedInUser();
    await memberships().insertOne({
      weddingId: new Types.ObjectId(c.weddingId),
      userId: new Types.ObjectId(await userIdOf(organizer)),
      memberType: 'MEMBER',
      role: 'ADMIN',
      status: 'ACTIVE',
      permissionOverrides: [{ module: 'PARTNER_SHARING', action: 'VIEW', effect: 'ALLOW' }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await organizer.get(`${c.base}/partner`).expect(403);
    await organizer.post(`${c.base}/partner/invitations`).send({ email: newEmail() }).expect(403);
    await organizer.post(`${c.base}/partner/leave`).expect(403);
    // Member management cannot remove an owner.
    await c.agent.delete(`${c.base}/members/${c.partnerMembershipId}`).expect(403);
    expect((await owners(c.weddingId)).length).toBe(2);
  });

  it('reconnects a former partner on the same membership; no access before accepting (D10)', async () => {
    const c = await connected();
    await c.partner.post(`${c.base}/partner/leave`).expect(204);
    await c.invite(c.partnerEmail).expect(201);
    await c.partner.get(c.base).expect(404);
    const again = (
      await c.partner
        .post(`/api/v1/partner-invitations/${tokenFor(c.partnerEmail)}/accept`)
        .expect(200)
    ).body.data;
    expect(again.membershipId).toBe(c.partnerMembershipId);
    await c.partner.get(c.base).expect(200);
    expect(await connections().countDocuments({ weddingId: new Types.ObjectId(c.weddingId) })).toBe(
      2,
    );
    const audit = (await c.agent.get(`${c.base}/audit-logs?action=MEMBER_REACTIVATED`).expect(200))
      .body.data;
    expect(audit).toHaveLength(1);
  });

  it('serializes owner changes: both owners leaving at once leaves exactly one owner', async () => {
    const c = await connected();
    const results = await Promise.all([
      c.agent.post(`${c.base}/partner/leave`),
      c.partner.post(`${c.base}/partner/leave`),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([204, 409]);
    const remaining = await owners(c.weddingId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.status).toBe('ACTIVE');
  });

  it('keeps the invitation pending when the email fails, so it can be resent', async () => {
    const { agent, base, invite } = await wedding();
    sender.unreachable = true;
    const created = (await invite(newEmail()).expect(201)).body.data;
    expect(created.emailSent).toBe(false);
    const state = (await agent.get(`${base}/partner`).expect(200)).body.data;
    expect(state.invitation).toMatchObject({ status: 'PENDING', emailSent: false });
  });

  it('records every step in the audit history', async () => {
    const c = await connected();
    const actions = (
      (await c.agent.get(`${c.base}/audit-logs?resourceType=partner_connection`).expect(200)).body
        .data as {
        action: string;
      }[]
    ).map((entry) => entry.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'PARTNER_INVITATION_CREATED',
        'PARTNER_INVITATION_ACCEPTED',
        'PARTNER_CONNECTED',
      ]),
    );
    const raw = JSON.stringify(
      await workspace.connection
        .collection('audit_logs')
        .find({ resourceType: 'partner_connection' })
        .toArray(),
    );
    expect(raw).not.toMatch(/tokenHash/);
  });
});
