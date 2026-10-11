import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  EmailRejectedError,
  EmailSender,
  type EmailMessage,
  type EmailSendResult,
} from '../src/infrastructure/email/email-message.js';
import { QueueName } from '../src/infrastructure/queue/queue-names.js';
import { WorkerModule } from '../src/worker/worker.module.js';
import { TEST_REDIS_URL } from './support/test-environment.js';
import { startWorkspaceApp, type Agent, type WorkspaceApp } from './support/workspace-app.js';

/** Records sent messages; the next send can be told to reject. */
class FakeEmailSender extends EmailSender {
  readonly providerName = 'TEST';
  readonly sent: EmailMessage[] = [];
  rejectNext: string | null = null;
  /** While true, every send fails as if the email service could not be reached. */
  unreachable = false;
  /** Runs while the provider is "sending", to change things mid-send. */
  duringSend: (() => Promise<unknown>) | null = null;

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (this.duringSend) {
      const action = this.duringSend;
      this.duringSend = null;
      await action();
    }
    return this.deliver(message);
  }

  private deliver(message: EmailMessage): Promise<EmailSendResult> {
    if (this.unreachable) return Promise.reject(new Error('connect ECONNREFUSED'));
    if (this.rejectNext) {
      const reason = this.rejectNext;
      this.rejectNext = null;
      return Promise.reject(new EmailRejectedError(reason));
    }
    this.sent.push(message);
    return Promise.resolve({ providerMessageId: `msg-${this.sent.length}` });
  }
}

interface Owner {
  agent: Agent;
  weddingId: string;
}

function pluck(list: unknown, key: string): unknown[] {
  return (list as Record<string, unknown>[]).map((item) => item[key]);
}

const tokenOf = (url: string) => url.split('/invite/')[1] as string;

describe('Invitations', () => {
  let workspace: WorkspaceApp;
  let worker: TestingModule;
  const sender = new FakeEmailSender();

  const guestUrl = (owner: Owner, guestId: string) =>
    `/api/v1/weddings/${owner.weddingId}/guests/${guestId}`;
  const invitationUrl = (owner: Owner, guestId: string, suffix = '') =>
    `${guestUrl(owner, guestId)}/invitation${suffix}`;
  const guestApi = (token: string, suffix = '') =>
    request(workspace.server()).get(`/api/v1/guest/invitations/${token}${suffix}`);
  const guestRsvp = (token: string, responses: unknown[]) =>
    request(workspace.server())
      .patch(`/api/v1/guest/invitations/${token}/rsvp`)
      .send({ responses });

  /** A wedding with dates and a city, a guest with an email, and three events. */
  async function weddingWithGuest(guest: Record<string, unknown> = {}) {
    const owner = await workspace.owner({
      brideName: 'Meera Sharma',
      groomName: 'Arjun Patel',
      startDate: '2027-02-18',
      primaryCity: 'Jaipur',
    });
    const created = await owner.agent
      .post(`/api/v1/weddings/${owner.weddingId}/guests`)
      .send({
        name: 'Raju Sharma',
        mobile: '+91 98765 43210',
        email: 'raju.sharma@example.com',
        notes: 'Organizer-only note',
        ...guest,
      })
      .expect(201);
    const guestId = created.body.data.guest.id as string;
    const event = async (body: Record<string, unknown>) =>
      (
        await owner.agent
          .post(`/api/v1/weddings/${owner.weddingId}/events`)
          .send({ notes: 'Caterer arrives early', ...body })
          .expect(201)
      ).body.data.id as string;
    const haldi = await event({
      name: 'Haldi',
      type: 'HALDI',
      date: '2027-02-17',
      startTime: '10:00',
      venue: { name: 'Lakeside Garden', address: 'Amer Road, Jaipur' },
    });
    const sangeet = await event({
      name: 'Sangeet',
      type: 'SANGEET',
      date: '2027-02-17',
      startTime: '19:00',
    });
    const mehendi = await event({ name: 'Mehendi', type: 'MEHENDI', date: '2027-02-16' });
    const assign = async (eventId: string) =>
      (
        await owner.agent
          .post(`${guestUrl(owner, guestId)}/events`)
          .send({ eventId })
          .expect(201)
      ).body.data.id as string;
    return {
      owner,
      guestId,
      events: { haldi, sangeet, mehendi },
      assignments: { haldi: await assign(haldi), sangeet: await assign(sangeet) },
    };
  }

  async function createInvitation(owner: Owner, guestId: string) {
    const response = await owner.agent.post(invitationUrl(owner, guestId)).expect(201);
    return response.body.data as { invitationUrl: string } & Record<string, unknown>;
  }

  async function deliveriesOf(owner: Owner, guestId: string) {
    const response = await owner.agent
      .get(invitationUrl(owner, guestId, '/deliveries'))
      .expect(200);
    return response.body.data as {
      deliveries: Record<string, unknown>[];
      activities: Record<string, unknown>[];
    };
  }

  /** Waits for the worker to record `count` attempts. */
  async function waitForAttempts(owner: Owner, guestId: string, count: number) {
    for (let i = 0; i < 100; i++) {
      const { deliveries } = await deliveriesOf(owner, guestId);
      if (deliveries.length >= count) return deliveries;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for ${count} delivery attempt(s)`);
  }

  async function auditActions(resourceId: string) {
    const entries = await workspace.connection
      .collection('audit_logs')
      .find({ resourceId: new Types.ObjectId(resourceId) })
      .sort({ createdAt: 1, _id: 1 })
      .toArray();
    return entries.map((entry) => entry.action as string);
  }

  async function storedInvitation(guestId: string) {
    return workspace.connection
      .collection('guest_invitations')
      .findOne({ guestId: new Types.ObjectId(guestId) });
  }

  beforeAll(async () => {
    workspace = await startWorkspaceApp({ WORKER_HEALTH_PORT: '3903' });
    worker = await Test.createTestingModule({ imports: [WorkerModule] })
      .overrideProvider(EmailSender)
      .useValue(sender)
      .compile();
    await worker.init();
  });

  beforeEach(async () => {
    await workspace.redis.flushdb();
    sender.sent.length = 0;
    sender.rejectNext = null;
  });

  afterAll(async () => {
    await worker?.close();
    await workspace?.stop();
  });

  describe('creating the invitation and its token', () => {
    it('creates a token only when the flow starts, stored as a hash and a ciphertext', async () => {
      const { owner, guestId } = await weddingWithGuest();
      expect(await storedInvitation(guestId)).toBeNull();
      const before = await owner.agent.get(guestUrl(owner, guestId)).expect(200);
      expect(before.body.data.invitation).toBeNull();

      const created = await createInvitation(owner, guestId);
      expect(created).toEqual({
        guestId,
        deliveryStatus: 'DRAFT',
        isRevoked: false,
        tokenCreatedAt: expect.any(String),
        lastSentAt: null,
        firstOpenedAt: null,
        invitationUrl: expect.stringMatching(/^http:\/\/localhost:3000\/invite\/[\w-]{43}$/),
      });

      const token = tokenOf(created.invitationUrl);
      const stored = await storedInvitation(guestId);
      expect(stored).toMatchObject({
        tokenHash: expect.any(String),
        tokenCiphertext: expect.any(String),
        tokenKeyVersion: 'v1',
        deliveryStatus: 'DRAFT',
      });
      expect(JSON.stringify(stored)).not.toContain(token);

      const guest = await owner.agent.get(guestUrl(owner, guestId)).expect(200);
      expect(guest.body.data.invitation).toEqual({
        deliveryStatus: 'DRAFT',
        isRevoked: false,
        lastSentAt: null,
        firstOpenedAt: null,
      });
    });

    it('refuses a second invitation and operations before the first', async () => {
      const { owner, guestId } = await weddingWithGuest();
      for (const [method, suffix] of [
        ['post', '/regenerate'],
        ['post', '/revoke'],
        ['post', '/send'],
        ['get', '/link'],
        ['get', '/deliveries'],
      ] as const) {
        const response = await owner.agent[method](invitationUrl(owner, guestId, suffix)).expect(
          404,
        );
        expect(response.body.error.code).toBe('INVITATION_NOT_FOUND');
      }
      await createInvitation(owner, guestId);
      const again = await owner.agent.post(invitationUrl(owner, guestId)).expect(409);
      expect(again.body.error.code).toBe('INVITATION_ALREADY_EXISTS');
    });

    it('returns the same current link every time, audited, without a new token', async () => {
      const { owner, guestId } = await weddingWithGuest();
      const created = await createInvitation(owner, guestId);
      const hash = (await storedInvitation(guestId))?.tokenHash as string;

      for (let i = 0; i < 2; i++) {
        const link = await owner.agent.get(invitationUrl(owner, guestId, '/link')).expect(200);
        expect(link.body.data).toEqual({ invitationUrl: created.invitationUrl });
      }
      const stored = await storedInvitation(guestId);
      expect(stored?.tokenHash).toBe(hash);
      expect(await auditActions(String(stored?._id))).toEqual([
        'INVITATION_LINK_RETRIEVED',
        'INVITATION_LINK_RETRIEVED',
      ]);
    });
  });

  describe('the guest view', () => {
    it('shows only the guest’s own active events and nothing organizer-only', async () => {
      const { owner, guestId, events, assignments } = await weddingWithGuest();
      const token = tokenOf((await createInvitation(owner, guestId)).invitationUrl);

      const response = await guestApi(token).expect(200);
      expect(response.body.data).toEqual({
        guest: { name: 'Raju Sharma' },
        wedding: {
          displayName: 'Meera Sharma & Arjun Patel',
          startDate: '2027-02-18',
          timezone: 'Asia/Kolkata',
        },
        events: [
          {
            guestEventId: assignments.haldi,
            name: 'Haldi',
            type: 'HALDI',
            date: '2027-02-17',
            startTime: '10:00',
            endTime: null,
            venue: { name: 'Lakeside Garden', address: 'Amer Road, Jaipur' },
            dressCode: null,
            description: null,
            rsvpStatus: 'PENDING',
            attendeeCount: null,
          },
          expect.objectContaining({ guestEventId: assignments.sangeet, name: 'Sangeet' }),
        ],
      });
      const body = JSON.stringify(response.body);
      for (const secret of [
        'Organizer-only note',
        'Caterer arrives early',
        '9876543210',
        'raju.sharma@example.com',
        owner.weddingId,
        guestId,
        events.haldi,
        events.mehendi,
      ]) {
        expect(body).not.toContain(secret);
      }
    });

    it('records each open as activity without changing the delivery status', async () => {
      const { owner, guestId } = await weddingWithGuest();
      const token = tokenOf((await createInvitation(owner, guestId)).invitationUrl);
      await guestApi(token).expect(200);
      const first = await owner.agent.get(guestUrl(owner, guestId)).expect(200);
      await guestApi(token).expect(200);

      const second = await owner.agent.get(guestUrl(owner, guestId)).expect(200);
      expect(second.body.data.invitation).toMatchObject({
        deliveryStatus: 'DRAFT',
        firstOpenedAt: first.body.data.invitation.firstOpenedAt,
      });
      const { activities } = await deliveriesOf(owner, guestId);
      expect(pluck(activities, 'type')).toEqual(['OPENED', 'OPENED']);
    });

    it('answers unknown and malformed tokens with the same 404', async () => {
      for (const token of ['a'.repeat(43), 'short', '%2E%2E']) {
        const response = await guestApi(token).expect(404);
        expect(response.body.error.code).toBe('INVITATION_NOT_FOUND');
      }
    });
  });

  describe('guest RSVP', () => {
    it('applies every response, never PENDING, and returns the updated view', async () => {
      const { owner, guestId, assignments } = await weddingWithGuest();
      const token = tokenOf((await createInvitation(owner, guestId)).invitationUrl);

      const response = await guestRsvp(token, [
        { guestEventId: assignments.haldi, rsvpStatus: 'ATTENDING', attendeeCount: 4 },
      ]).expect(200);
      expect(pluck(response.body.data.events, 'rsvpStatus')).toEqual(['ATTENDING', 'PENDING']);
      expect(pluck(response.body.data.events, 'attendeeCount')).toEqual([4, null]);

      const stored = await workspace.connection
        .collection('guest_events')
        .findOne({ _id: new Types.ObjectId(assignments.haldi) });
      expect(stored).toMatchObject({ respondedAt: expect.any(Date) });
      expect(stored).not.toHaveProperty('rsvpUpdatedBy');

      const pending = await guestRsvp(token, [
        { guestEventId: assignments.haldi, rsvpStatus: 'PENDING', attendeeCount: null },
      ]).expect(400);
      expect(pending.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('rejects the whole request when one response is invalid or not the guest’s', async () => {
      const { owner, guestId, assignments } = await weddingWithGuest();
      const token = tokenOf((await createInvitation(owner, guestId)).invitationUrl);
      const other = await weddingWithGuest({ name: 'Other', mobile: '9000000000' });

      await guestRsvp(token, [
        { guestEventId: assignments.haldi, rsvpStatus: 'ATTENDING', attendeeCount: 2 },
        { guestEventId: assignments.sangeet, rsvpStatus: 'DECLINED', attendeeCount: 3 },
      ]).expect(400);
      const foreign = await guestRsvp(token, [
        { guestEventId: assignments.haldi, rsvpStatus: 'ATTENDING', attendeeCount: 2 },
        { guestEventId: other.assignments.haldi, rsvpStatus: 'DECLINED', attendeeCount: 0 },
      ]).expect(400);
      expect(Object.keys(foreign.body.error.details.fields)).toEqual(['responses']);
      await guestRsvp(token, []).expect(400);

      const view = await guestApi(token).expect(200);
      expect(pluck(view.body.data.events, 'rsvpStatus')).toEqual(['PENDING', 'PENDING']);
    });

    it('drops events whose assignment was removed or whose event was deleted', async () => {
      const { owner, guestId, events, assignments } = await weddingWithGuest();
      const token = tokenOf((await createInvitation(owner, guestId)).invitationUrl);
      await owner.agent
        .delete(`/api/v1/weddings/${owner.weddingId}/guest-events/${assignments.haldi}`)
        .expect(204);
      await owner.agent
        .delete(`/api/v1/weddings/${owner.weddingId}/events/${events.sangeet}`)
        .expect(204);
      const view = await guestApi(token).expect(200);
      expect(view.body.data.events).toEqual([]);
      await guestRsvp(token, [
        { guestEventId: assignments.haldi, rsvpStatus: 'MAYBE', attendeeCount: null },
      ]).expect(400);
    });
  });

  describe('regenerating, revoking and deleting the guest', () => {
    it('regenerates: the old link stops working, the new one works, status back to DRAFT', async () => {
      const { owner, guestId, assignments } = await weddingWithGuest();
      const old = tokenOf((await createInvitation(owner, guestId)).invitationUrl);
      await owner.agent.post(invitationUrl(owner, guestId, '/send')).expect(202);
      await waitForAttempts(owner, guestId, 1);

      const regenerated = await owner.agent
        .post(invitationUrl(owner, guestId, '/regenerate'))
        .expect(200);
      expect(regenerated.body.data).toMatchObject({ deliveryStatus: 'DRAFT', isRevoked: false });
      const fresh = tokenOf(regenerated.body.data.invitationUrl as string);
      expect(fresh).not.toBe(old);
      await guestApi(old).expect(404);
      await guestRsvp(old, [
        { guestEventId: assignments.haldi, rsvpStatus: 'MAYBE', attendeeCount: null },
      ]).expect(404);
      await guestApi(fresh).expect(200);

      // History is kept (0020).
      const { deliveries } = await deliveriesOf(owner, guestId);
      expect(pluck(deliveries, 'status')).toEqual(['SENT']);
      const id = String((await storedInvitation(guestId))?._id);
      expect(await auditActions(id)).toEqual(['INVITATION_TOKEN_REGENERATED']);
    });

    it('revokes: the link stops working, the status stays, send and link are refused', async () => {
      const { owner, guestId, assignments } = await weddingWithGuest();
      const token = tokenOf((await createInvitation(owner, guestId)).invitationUrl);
      await owner.agent.post(invitationUrl(owner, guestId, '/send')).expect(202);
      await waitForAttempts(owner, guestId, 1);

      const revoked = await owner.agent.post(invitationUrl(owner, guestId, '/revoke')).expect(200);
      expect(revoked.body.data).toMatchObject({ deliveryStatus: 'SENT', isRevoked: true });
      await guestApi(token).expect(404);
      await guestRsvp(token, [
        { guestEventId: assignments.haldi, rsvpStatus: 'MAYBE', attendeeCount: null },
      ]).expect(404);
      for (const [method, suffix] of [
        ['get', '/link'],
        ['post', '/send'],
        ['post', '/resend'],
      ] as const) {
        const response = await owner.agent[method](invitationUrl(owner, guestId, suffix)).expect(
          409,
        );
        expect(response.body.error.code).toBe('INVITATION_REVOKED');
      }
      const stored = await storedInvitation(guestId);
      expect(stored).not.toHaveProperty('tokenHash');
      expect(stored).not.toHaveProperty('tokenCiphertext');

      // Revoking again changes nothing; regenerating works from a revoked link (0020).
      await owner.agent.post(invitationUrl(owner, guestId, '/revoke')).expect(200);
      const regenerated = await owner.agent
        .post(invitationUrl(owner, guestId, '/regenerate'))
        .expect(200);
      expect(regenerated.body.data).toMatchObject({ deliveryStatus: 'DRAFT', isRevoked: false });
      expect(await auditActions(String(stored?._id))).toEqual([
        'INVITATION_TOKEN_REVOKED',
        'INVITATION_TOKEN_REGENERATED',
      ]);
    });

    it('does not mark a link regenerated during the send as Sent (review M1, 0020)', async () => {
      const { owner, guestId } = await weddingWithGuest();
      const created = await createInvitation(owner, guestId);
      sender.duringSend = () =>
        owner.agent.post(invitationUrl(owner, guestId, '/regenerate')).expect(200);

      await owner.agent.post(invitationUrl(owner, guestId, '/send')).expect(202);
      const deliveries = await waitForAttempts(owner, guestId, 1);

      // The attempt happened and is recorded, with the old link…
      expect(pluck(deliveries, 'status')).toEqual(['SENT']);
      expect(sender.sent[0]?.text).toContain(created.invitationUrl);
      await guestApi(tokenOf(created.invitationUrl)).expect(404);
      // …but the current link was never emailed, so its status stays Draft.
      const guest = await owner.agent.get(guestUrl(owner, guestId)).expect(200);
      expect(guest.body.data.invitation).toMatchObject({
        deliveryStatus: 'DRAFT',
        lastSentAt: null,
      });
    });

    it('skips a queued email whose link was revoked and replaced before sending (review M2)', async () => {
      const { owner, guestId } = await weddingWithGuest();
      await createInvitation(owner, guestId);
      const queue = new Queue(QueueName.Invitations, { connection: { url: TEST_REDIS_URL } });
      try {
        await queue.pause();
        await owner.agent.post(invitationUrl(owner, guestId, '/send')).expect(202);
        await owner.agent.post(invitationUrl(owner, guestId, '/revoke')).expect(200);
        await owner.agent.post(invitationUrl(owner, guestId, '/regenerate')).expect(200);
        await queue.resume();
        // Give the worker time to pick the job up and skip it.
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } finally {
        await queue.resume();
        await queue.close();
      }
      expect(sender.sent).toHaveLength(0);
      expect((await deliveriesOf(owner, guestId)).deliveries).toEqual([]);
      const guest = await owner.agent.get(guestUrl(owner, guestId)).expect(200);
      expect(guest.body.data.invitation.deliveryStatus).toBe('DRAFT');
    });

    it('revokes the token when the guest is deleted, keeping the history', async () => {
      const { owner, guestId } = await weddingWithGuest();
      const token = tokenOf((await createInvitation(owner, guestId)).invitationUrl);
      await owner.agent.delete(guestUrl(owner, guestId)).expect(204);
      await guestApi(token).expect(404);

      const stored = await storedInvitation(guestId);
      expect(stored).toMatchObject({ revokedAt: expect.any(Date), deliveryStatus: 'DRAFT' });
      const entry = await workspace.connection
        .collection('audit_logs')
        .findOne({ resourceId: stored?._id });
      expect(entry).toMatchObject({
        action: 'INVITATION_TOKEN_REVOKED',
        metadata: { reason: 'GUEST_DELETED' },
      });
      await owner.agent.post(invitationUrl(owner, guestId, '/regenerate')).expect(404);
    });

    it('keeps the token when the guest’s contact details change', async () => {
      const { owner, guestId } = await weddingWithGuest();
      const token = tokenOf((await createInvitation(owner, guestId)).invitationUrl);
      await owner.agent
        .patch(guestUrl(owner, guestId))
        .send({ mobile: '9000011111', email: 'raju.new@example.com' })
        .expect(200);
      await guestApi(token).expect(200);
    });
  });

  describe('sending the email', () => {
    it('needs the guest’s email address', async () => {
      const { owner, guestId } = await weddingWithGuest({ email: null });
      await createInvitation(owner, guestId);
      const response = await owner.agent.post(invitationUrl(owner, guestId, '/send')).expect(422);
      expect(response.body.error.code).toBe('GUEST_EMAIL_REQUIRED');
    });

    it('sends, then resends with the same link; each attempt is recorded as SENT', async () => {
      const { owner, guestId } = await weddingWithGuest();
      const created = await createInvitation(owner, guestId);

      const queued = await owner.agent.post(invitationUrl(owner, guestId, '/send')).expect(202);
      expect(queued.body.data.deliveryStatus).toBe('DRAFT');
      await waitForAttempts(owner, guestId, 1);
      await owner.agent.post(invitationUrl(owner, guestId, '/resend')).expect(202);
      const deliveries = await waitForAttempts(owner, guestId, 2);

      expect(deliveries).toEqual([
        expect.objectContaining({ attemptNumber: 1, kind: 'SEND', status: 'SENT', failedAt: null }),
        expect.objectContaining({ attemptNumber: 2, kind: 'RESEND', status: 'SENT' }),
      ]);
      expect(sender.sent).toHaveLength(2);
      for (const message of sender.sent) {
        expect(message.to).toBe('raju.sharma@example.com');
        expect(message.subject).toBe("You're invited: Meera Sharma & Arjun Patel");
        expect(message.text).toContain(created.invitationUrl);
        expect(message.text).toContain('on Thursday, 18 February 2027 in Jaipur.');
      }
      const guest = await owner.agent.get(guestUrl(owner, guestId)).expect(200);
      expect(guest.body.data.invitation).toMatchObject({
        deliveryStatus: 'SENT',
        lastSentAt: expect.any(String),
      });
      const stored = await workspace.connection
        .collection('invitation_deliveries')
        .find({ guestInvitationId: (await storedInvitation(guestId))?._id })
        .toArray();
      expect(pluck(stored, 'providerMessageId')).toEqual(['msg-1', 'msg-2']);

      // Resending never creates guests or assignments.
      const guests = await owner.agent
        .get(`/api/v1/weddings/${owner.weddingId}/guests`)
        .expect(200);
      expect(guests.body.data).toHaveLength(1);
    });

    it('queues an email at most once per Idempotency-Key', async () => {
      const { owner, guestId } = await weddingWithGuest();
      await createInvitation(owner, guestId);
      for (let i = 0; i < 3; i++) {
        await owner.agent
          .post(invitationUrl(owner, guestId, '/send'))
          .set('Idempotency-Key', 'send-raju-1')
          .expect(202);
      }
      await waitForAttempts(owner, guestId, 1);
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect((await deliveriesOf(owner, guestId)).deliveries).toHaveLength(1);
      expect(sender.sent).toHaveLength(1);
    });

    it('records an immediate rejection as FAILED with the reason', async () => {
      const { owner, guestId } = await weddingWithGuest();
      await createInvitation(owner, guestId);
      await owner.agent.post(invitationUrl(owner, guestId, '/send')).expect(202);
      await waitForAttempts(owner, guestId, 1);

      sender.rejectNext = 'SMTP 550';
      await owner.agent.post(invitationUrl(owner, guestId, '/resend')).expect(202);
      const deliveries = await waitForAttempts(owner, guestId, 2);
      expect(deliveries[1]).toMatchObject({
        status: 'FAILED',
        sentAt: null,
        failedAt: expect.any(String),
        failureReason: 'SMTP 550',
      });
      const guest = await owner.agent.get(guestUrl(owner, guestId)).expect(200);
      expect(guest.body.data.invitation.deliveryStatus).toBe('FAILED');
      // The earlier attempt is unchanged (0020).
      expect(deliveries[0]).toMatchObject({ status: 'SENT' });
    });
  });

  describe('an unreachable email service (0023)', () => {
    it('records one FAILED attempt after every retry fails, touching nothing else', async () => {
      const { owner, guestId, assignments } = await weddingWithGuest();
      await createInvitation(owner, guestId);
      await owner.agent
        .patch(`/api/v1/weddings/${owner.weddingId}/guest-events/${assignments.haldi}`)
        .send({ rsvpStatus: 'ATTENDING', attendeeCount: 2 })
        .expect(200);

      sender.unreachable = true;
      try {
        await owner.agent.post(invitationUrl(owner, guestId, '/send')).expect(202);
        // The queue retries twice with backoff (1 s, then 2 s) before giving up.
        const deliveries = await waitForAttempts(owner, guestId, 1);
        expect(deliveries).toEqual([
          expect.objectContaining({
            attemptNumber: 1,
            status: 'FAILED',
            sentAt: null,
            failedAt: expect.any(String),
            failureReason: 'The email service could not be reached.',
          }),
        ]);
      } finally {
        sender.unreachable = false;
      }

      const guest = await owner.agent.get(guestUrl(owner, guestId)).expect(200);
      expect(guest.body.data.invitation.deliveryStatus).toBe('FAILED');
      const rsvps = await owner.agent.get(`${guestUrl(owner, guestId)}/events`).expect(200);
      expect(pluck(rsvps.body.data, 'rsvpStatus')).toEqual(['ATTENDING', 'PENDING']);

      // A later send works normally.
      await owner.agent.post(invitationUrl(owner, guestId, '/resend')).expect(202);
      const after = await waitForAttempts(owner, guestId, 2);
      expect(pluck(after, 'status')).toEqual(['FAILED', 'SENT']);
    });
  });

  describe('protection', () => {
    it('rate-limits the guest routes to 60 requests a minute per link (0023)', async () => {
      const { owner, guestId } = await weddingWithGuest();
      const token = tokenOf((await createInvitation(owner, guestId)).invitationUrl);
      for (let i = 0; i < 60; i++) await guestApi(token).expect(200);
      const limited = await guestApi(token).expect(429);
      expect(limited.body.error.code).toBe('RATE_LIMITED');
    });

    it('rate-limits to 120 requests a minute per IP, counting invalid links (0023)', async () => {
      // Each request uses a different unknown link, so only the per-IP limit applies.
      const unknown = (i: number) => `${String(i).padStart(43, 'a')}`;
      for (let i = 0; i < 120; i++) await guestApi(unknown(i)).expect(404);
      const limited = await guestApi(unknown(999)).expect(429);
      expect(limited.body.error.code).toBe('RATE_LIMITED');
    });

    it('keeps another wedding out of a guest’s invitation', async () => {
      const { owner, guestId } = await weddingWithGuest();
      await createInvitation(owner, guestId);
      const other = await workspace.owner();
      await other.agent.get(invitationUrl(owner, guestId, '/link')).expect(404);
      const viaOwnWedding = await other.agent
        .get(`/api/v1/weddings/${other.weddingId}/guests/${guestId}/invitation/link`)
        .expect(404);
      expect(viaOwnWedding.body.error.code).toBe('GUEST_NOT_FOUND');
      await other.agent
        .post(`/api/v1/weddings/${other.weddingId}/guests/${guestId}/invitation/revoke`)
        .expect(404);
    });

    it('requires a signed-in organizer for the organizer routes', async () => {
      const { owner, guestId } = await weddingWithGuest();
      await request(workspace.server()).post(invitationUrl(owner, guestId)).expect(401);
    });
  });
});
