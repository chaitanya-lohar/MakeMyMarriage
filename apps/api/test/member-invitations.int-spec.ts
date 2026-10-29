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

const DAY = 24 * 60 * 60 * 1000;

/** Organizer invitations (API Design §7.1, decision 0034 P10-1–P10-4, R1, R2, R5, R6). */
describe('Member invitations', () => {
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

  const invitations = () => workspace.connection.collection('member_invitations');
  const memberships = () => workspace.connection.collection('wedding_memberships');
  const anonymous = () => request(workspace.server());

  /** A signed-in account with this email. */
  async function account(email: string): Promise<Agent> {
    const agent = request.agent(workspace.server());
    await agent
      .post('/api/v1/auth/register')
      .send({ displayName: 'Kavita Verma', email, password: 'correct horse battery' })
      .expect(201);
    return agent;
  }

  const newEmail = () => `invitee${++counter}.${Date.now()}@example.com`;

  /** The token of the latest email sent to `email`. */
  function tokenFor(email: string): string {
    const message = sender.sent.filter((m) => m.to === email).at(-1);
    const match = /\/member-invite\/([A-Za-z0-9_-]{43})/.exec(message?.text ?? '');
    if (!match) throw new Error(`no invitation email to ${email}`);
    return match[1]!;
  }

  async function wedding() {
    const owner = await workspace.owner();
    const base = `/api/v1/weddings/${owner.weddingId}`;
    const invite = (agent: Agent, body: Record<string, unknown>) =>
      agent.post(`${base}/members/invitations`).send(body);
    return { ...owner, base, invite };
  }

  it('invites by email, expiring in seven days, and the invitee accepts', async () => {
    const { agent: owner, weddingId, base, invite } = await wedding();
    const email = newEmail();
    const before = Date.now();

    const created = (
      await invite(owner, { email, role: 'ORGANIZER', message: 'Help us!' }).expect(201)
    ).body.data;
    expect(created).toMatchObject({
      email,
      role: 'ORGANIZER',
      status: 'PENDING',
      emailSent: true,
      existingMembershipStatus: null,
    });
    const expiresAt = new Date(created.expiresAt as string).getTime();
    expect(expiresAt - before).toBeGreaterThanOrEqual(7 * DAY - 1000);
    expect(expiresAt - before).toBeLessThan(7 * DAY + 60_000);
    const token = tokenFor(email);

    const invitee = await account(email);
    // A pending invitation grants nothing.
    await invitee.get(`${base}/events`).expect(404);

    const details = (await anonymous().get(`/api/v1/member-invitations/${token}`).expect(200)).body
      .data;
    expect(details).toMatchObject({ role: 'ORGANIZER', status: 'PENDING', message: 'Help us!' });
    expect(details.emailHint).toMatch(/^in\*\*\*@example\.com$/);

    const accepted = (await invitee.post(`/api/v1/member-invitations/${token}/accept`).expect(200))
      .body.data;
    expect(accepted).toMatchObject({ weddingId, role: 'ORGANIZER' });
    await invitee.get(`${base}/events`).expect(200);

    // Single use.
    await invitee.post(`/api/v1/member-invitations/${token}/accept`).expect(409);
    await anonymous().post(`/api/v1/member-invitations/${token}/decline`).expect(409);
    const audit = (await owner.get(`${base}/audit-logs?resourceType=member_invitation`).expect(200))
      .body.data as { action: string }[];
    expect(audit.map((entry) => entry.action)).toEqual([
      'MEMBER_INVITATION_ACCEPTED',
      'MEMBER_INVITATION_CREATED',
    ]);
  });

  it('accepts only for the invited email, signed in, with no verification', async () => {
    const { agent: owner, invite } = await wedding();
    const email = newEmail();
    await invite(owner, { email, role: 'VIEWER' }).expect(201);
    const token = tokenFor(email);

    await anonymous().post(`/api/v1/member-invitations/${token}/accept`).expect(401);
    const other = await account(newEmail());
    const mismatch = await other.post(`/api/v1/member-invitations/${token}/accept`).expect(403);
    expect(mismatch.body.error.code).toBe('MEMBER_INVITATION_EMAIL_MISMATCH');
    const invitee = await account(email.toUpperCase());
    await invitee.post(`/api/v1/member-invitations/${token}/accept`).expect(200);
  });

  it('declines with the token alone, granting nothing (R6)', async () => {
    const { agent: owner, invite } = await wedding();
    const email = newEmail();
    await invite(owner, { email, role: 'EDITOR' }).expect(201);
    const token = tokenFor(email);

    await anonymous().post(`/api/v1/member-invitations/${token}/decline`).expect(204);
    const invitee = await account(email);
    const response = await invitee.post(`/api/v1/member-invitations/${token}/accept`).expect(409);
    expect(response.body.error).toMatchObject({
      code: 'MEMBER_INVITATION_NOT_PENDING',
      details: { status: 'DECLINED' },
    });
    await anonymous().get('/api/v1/member-invitations/not-a-token').expect(404);
  });

  it('expires after seven days, checked on use, and lets the email be invited again', async () => {
    const { agent: owner, base, invite } = await wedding();
    const email = newEmail();
    const id = (await invite(owner, { email, role: 'VIEWER' }).expect(201)).body.data.id as string;
    const token = tokenFor(email);
    await invitations().updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    const invitee = await account(email);
    const response = await invitee.post(`/api/v1/member-invitations/${token}/accept`).expect(409);
    expect(response.body.error.code).toBe('MEMBER_INVITATION_EXPIRED');
    expect(await invitations().findOne({ _id: new Types.ObjectId(id) })).toMatchObject({
      status: 'EXPIRED',
    });
    const expired = (await owner.get(`${base}/members/invitations?status=EXPIRED`).expect(200)).body
      .data as { id: string }[];
    expect(expired.map((i) => i.id)).toEqual([id]);
    await invite(owner, { email, role: 'VIEWER' }).expect(201);
  });

  it('resends with a new link and a fresh seven days, at most three times a day (R2, R5)', async () => {
    const { agent: owner, base, invite } = await wedding();
    const email = newEmail();
    const id = (await invite(owner, { email, role: 'VIEWER' }).expect(201)).body.data.id as string;
    const first = tokenFor(email);
    await invitations().updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: { expiresAt: new Date(Date.now() + DAY) } },
    );

    const resent = (await owner.post(`${base}/members/invitations/${id}/resend`).expect(200)).body
      .data;
    expect(new Date(resent.expiresAt as string).getTime() - Date.now()).toBeGreaterThan(6 * DAY);
    const second = tokenFor(email);
    expect(second).not.toBe(first);
    await anonymous().get(`/api/v1/member-invitations/${first}`).expect(404);
    await anonymous().get(`/api/v1/member-invitations/${second}`).expect(200);

    await owner.post(`${base}/members/invitations/${id}/resend`).expect(200);
    await owner.post(`${base}/members/invitations/${id}/resend`).expect(200);
    const limited = await owner.post(`${base}/members/invitations/${id}/resend`).expect(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(limited.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
    const stored = await invitations().findOne({ _id: new Types.ObjectId(id) });
    expect(stored?.resentAt).toHaveLength(3);
  });

  it('allows ten invitations per wedding per hour (R1)', async () => {
    const { agent: owner, base, invite } = await wedding();
    for (let i = 0; i < 10; i++)
      await invite(owner, { email: newEmail(), role: 'VIEWER' }).expect(201);
    const limited = await invite(owner, { email: newEmail(), role: 'VIEWER' }).expect(429);
    expect(limited.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
    const pending = (await owner.get(`${base}/members/invitations?limit=100`).expect(200)).body
      .data;
    expect(pending).toHaveLength(10);
  });

  it('refuses a second pending invitation and an active member', async () => {
    const { agent: owner, invite } = await wedding();
    const email = newEmail();
    await invite(owner, { email, role: 'VIEWER' }).expect(201);
    const again = await invite(owner, { email, role: 'EDITOR' }).expect(409);
    expect(again.body.error.code).toBe('MEMBER_INVITATION_ALREADY_PENDING');

    const invitee = await account(email);
    await invitee.post(`/api/v1/member-invitations/${tokenFor(email)}/accept`).expect(200);
    const active = await invite(owner, { email, role: 'EDITOR' }).expect(409);
    expect(active.body.error.code).toBe('MEMBER_ALREADY_ACTIVE');
  });

  it('keeps Admin invitations owner-only (P10-4)', async () => {
    const { agent: owner, weddingId, base, invite } = await wedding();
    const adminEmail = newEmail();
    await invite(owner, { email: adminEmail, role: 'ADMIN' }).expect(201);
    const adminInvite = (await owner.get(`${base}/members/invitations`).expect(200)).body.data[0];

    const admin = await account(newEmail());
    const adminId = (await admin.get('/api/v1/me').expect(200)).body.data.user.id as string;
    await memberships().insertOne({
      weddingId: new Types.ObjectId(weddingId),
      userId: new Types.ObjectId(adminId),
      memberType: 'MEMBER',
      role: 'ADMIN',
      status: 'ACTIVE',
      permissionOverrides: [
        { module: 'MEMBERS', action: 'VIEW', effect: 'ALLOW' },
        { module: 'MEMBERS', action: 'INVITE', effect: 'ALLOW' },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const refused = await invite(admin, { email: newEmail(), role: 'ADMIN' }).expect(403);
    expect(refused.body.error.details.reason).toBe('ADMIN_ROLE_OWNER_ONLY');
    await invite(admin, { email: newEmail(), role: 'ORGANIZER' }).expect(201);
    const resend = await admin
      .post(`${base}/members/invitations/${adminInvite.id as string}/resend`)
      .expect(403);
    expect(resend.body.error.details.reason).toBe('ADMIN_ROLE_OWNER_ONLY');
  });

  it('re-invites a removed member: same row, old overrides cleared, access only on acceptance', async () => {
    const { agent: owner, base, invite } = await wedding();
    const email = newEmail();
    await invite(owner, {
      email,
      role: 'ORGANIZER',
      permissionOverrides: [{ module: 'INVITATIONS', action: 'SEND', effect: 'ALLOW' }],
    }).expect(201);
    const invitee = await account(email);
    const { membershipId } = (
      await invitee.post(`/api/v1/member-invitations/${tokenFor(email)}/accept`).expect(200)
    ).body.data as { membershipId: string };
    await owner.delete(`${base}/members/${membershipId}`).expect(204);

    const again = (await invite(owner, { email, role: 'VIEWER' }).expect(201)).body.data;
    expect(again.existingMembershipStatus).toBe('REVOKED');
    await invitee.get(`${base}/events`).expect(404);

    const reaccepted = (
      await invitee.post(`/api/v1/member-invitations/${tokenFor(email)}/accept`).expect(200)
    ).body.data;
    expect(reaccepted).toMatchObject({ membershipId, role: 'VIEWER' });
    const row = await memberships().findOne({ _id: new Types.ObjectId(membershipId) });
    expect(row).toMatchObject({ status: 'ACTIVE', role: 'VIEWER' });
    expect(row?.permissionOverrides).toBeUndefined();
    expect(row?.revokedAt).toBeUndefined();
    await invitee.get(`${base}/events`).expect(200);
  });

  it('revokes a pending invitation; the link stops working', async () => {
    const { agent: owner, base, invite } = await wedding();
    const email = newEmail();
    const id = (await invite(owner, { email, role: 'VIEWER' }).expect(201)).body.data.id as string;
    await owner.post(`${base}/members/invitations/${id}/revoke`).expect(204);
    await owner.post(`${base}/members/invitations/${id}/revoke`).expect(409);
    const invitee = await account(email);
    await invitee.post(`/api/v1/member-invitations/${tokenFor(email)}/accept`).expect(409);
  });

  it('keeps the invitation when the email cannot be sent', async () => {
    const { agent: owner, invite } = await wedding();
    sender.unreachable = true;
    const created = (await invite(owner, { email: newEmail(), role: 'VIEWER' }).expect(201)).body
      .data;
    expect(created).toMatchObject({ status: 'PENDING', emailSent: false });
  });
});
