import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startWorkspaceApp, type Agent, type WorkspaceApp } from './support/workspace-app.js';

const RAJU = {
  name: 'Raju Sharma',
  mobile: '+91 98765-43210',
  email: ' Raju.Sharma@Example.com ',
  relation: 'Cousin',
  notes: 'Prefers a call',
};

/** One field of every item in a response list. */
function pluck(list: unknown, key: string): unknown[] {
  return (list as Record<string, unknown>[]).map((item) => item[key]);
}

interface Ids {
  agent: Agent;
  weddingId: string;
}

describe('Guests, assignments and RSVP', () => {
  let workspace: WorkspaceApp;

  const guestsUrl = ({ weddingId }: Ids) => `/api/v1/weddings/${weddingId}/guests`;

  async function createGuest(owner: Ids, body: Record<string, unknown> = RAJU) {
    const response = await owner.agent.post(guestsUrl(owner)).send(body).expect(201);
    return response.body.data as {
      guest: { id: string } & Record<string, unknown>;
      duplicateMobileGuests: { id: string; name: string }[];
    };
  }

  async function createEvent(owner: Ids, body: Record<string, unknown>) {
    const response = await owner.agent
      .post(`/api/v1/weddings/${owner.weddingId}/events`)
      .send(body)
      .expect(201);
    return response.body.data.id as string;
  }

  async function assign(owner: Ids, guestId: string, eventId: string, status = 201) {
    const response = await owner.agent
      .post(`${guestsUrl(owner)}/${guestId}/events`)
      .send({ eventId })
      .expect(status);
    return response.body.data as { id: string } & Record<string, unknown>;
  }

  const rsvp = (owner: Ids, guestEventId: string, body: Record<string, unknown>) =>
    owner.agent
      .patch(`/api/v1/weddings/${owner.weddingId}/guest-events/${guestEventId}`)
      .send(body);

  beforeAll(async () => {
    workspace = await startWorkspaceApp();
  });

  beforeEach(async () => {
    await workspace.redis.flushdb();
  });

  afterAll(async () => {
    await workspace?.stop();
  });

  describe('guests', () => {
    it('creates a guest with the mobile normalized and the email lower-cased', async () => {
      const owner = await workspace.owner();
      const { guest, duplicateMobileGuests } = await createGuest(owner);
      expect(guest).toEqual({
        id: expect.any(String),
        name: 'Raju Sharma',
        mobile: '+919876543210',
        email: 'raju.sharma@example.com',
        relation: 'Cousin',
        notes: 'Prefers a call',
        invitation: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(duplicateMobileGuests).toEqual([]);

      const one = await owner.agent.get(`${guestsUrl(owner)}/${guest.id}`).expect(200);
      expect(one.body.data).toEqual(guest);
    });

    it('needs only the name and mobile', async () => {
      const owner = await workspace.owner();
      const { guest } = await createGuest(owner, {
        name: 'Sunita',
        mobile: '9876543211',
        email: '',
      });
      expect(guest).toMatchObject({ email: null, relation: null, notes: null });
    });

    it('reports invalid fields with the field messages', async () => {
      const owner = await workspace.owner();
      const response = await owner.agent
        .post(guestsUrl(owner))
        .send({
          name: '',
          mobile: '12345',
          email: 'not-an-email',
          relation: 'R'.repeat(101),
          notes: 'N'.repeat(1001),
        })
        .expect(400);
      expect(response.body.error.details.fields).toEqual({
        name: ["Enter the guest's name."],
        mobile: ['Enter a valid mobile number.'],
        email: ['Enter a valid email address.'],
        relation: ['Use 100 characters or fewer.'],
        notes: ['Use 1,000 characters or fewer.'],
      });
    });

    it('warns about another guest with the same mobile, saves, and never merges', async () => {
      const owner = await workspace.owner();
      const sunita = await createGuest(owner, { name: 'Sunita Sharma', mobile: '+919876543210' });
      const raju = await createGuest(owner);
      expect(raju.duplicateMobileGuests).toEqual([{ id: sunita.guest.id, name: 'Sunita Sharma' }]);

      // The warning also comes back on update, and a different number clears it.
      const updated = await owner.agent
        .patch(`${guestsUrl(owner)}/${raju.guest.id}`)
        .send({ relation: 'Brother' })
        .expect(200);
      expect(updated.body.data.duplicateMobileGuests).toHaveLength(1);
      const changed = await owner.agent
        .patch(`${guestsUrl(owner)}/${raju.guest.id}`)
        .send({ mobile: '98765 00000', notes: null })
        .expect(200);
      expect(changed.body.data).toMatchObject({
        guest: { mobile: '9876500000', notes: null, relation: 'Brother' },
        duplicateMobileGuests: [],
      });

      // Another wedding's guests never count.
      const other = await workspace.owner();
      const elsewhere = await createGuest(other, { name: 'Sunita', mobile: '+919876543210' });
      expect(elsewhere.duplicateMobileGuests).toEqual([]);
    });

    it('lists alphabetically with cursor pagination and searches by name or mobile', async () => {
      const owner = await workspace.owner();
      for (const [name, mobile] of [
        ['vikram Malhotra', '9811122334'],
        ['Raju Sharma', '9876543210'],
        ['Kavita Verma', '9822233445'],
        ['anita Rao', '9833344556'],
      ]) {
        await createGuest(owner, { name, mobile });
      }

      const first = await owner.agent.get(`${guestsUrl(owner)}?limit=3`).expect(200);
      expect(pluck(first.body.data, 'name')).toEqual(['anita Rao', 'Kavita Verma', 'Raju Sharma']);
      expect(first.body.meta.pagination).toEqual({
        nextCursor: expect.any(String),
        hasNextPage: true,
      });
      const second = await owner.agent
        .get(`${guestsUrl(owner)}?limit=3&cursor=${first.body.meta.pagination.nextCursor}`)
        .expect(200);
      expect(pluck(second.body.data, 'name')).toEqual(['vikram Malhotra']);
      expect(second.body.meta.pagination).toEqual({ nextCursor: null, hasNextPage: false });

      const byName = await owner.agent.get(`${guestsUrl(owner)}?search=SHAR`).expect(200);
      expect(pluck(byName.body.data, 'name')).toEqual(['Raju Sharma']);
      const byMobile = await owner.agent.get(`${guestsUrl(owner)}?search=98222 33`).expect(200);
      expect(pluck(byMobile.body.data, 'name')).toEqual(['Kavita Verma']);
      // Regex characters are matched literally.
      const literal = await owner.agent.get(`${guestsUrl(owner)}?search=.*`).expect(200);
      expect(literal.body.data).toEqual([]);

      await owner.agent.get(`${guestsUrl(owner)}?cursor=garbage`).expect(400);
      await owner.agent.get(`${guestsUrl(owner)}?limit=101`).expect(400);
    });

    it('soft-deletes a guest: gone from reads and counts, kept in the database', async () => {
      const owner = await workspace.owner();
      const { guest } = await createGuest(owner);
      await owner.agent.delete(`${guestsUrl(owner)}/${guest.id}`).expect(204);

      const gone = await owner.agent.get(`${guestsUrl(owner)}/${guest.id}`).expect(404);
      expect(gone.body.error.code).toBe('GUEST_NOT_FOUND');
      await owner.agent.delete(`${guestsUrl(owner)}/${guest.id}`).expect(404);
      const list = await owner.agent.get(guestsUrl(owner)).expect(200);
      expect(list.body.data).toEqual([]);
      const stored = await workspace.connection
        .collection('guests')
        .findOne({ _id: new Types.ObjectId(guest.id) });
      expect(stored).toMatchObject({ name: 'Raju Sharma', deletedAt: expect.any(Date) });

      // A deleted guest no longer warns as a duplicate.
      const again = await createGuest(owner);
      expect(again.duplicateMobileGuests).toEqual([]);
    });
  });

  describe('assignments', () => {
    it('assigns a guest to several events; the same pair twice returns the existing one', async () => {
      const owner = await workspace.owner();
      const { guest } = await createGuest(owner);
      const haldi = await createEvent(owner, {
        name: 'Haldi',
        type: 'HALDI',
        date: '2027-02-17',
        startTime: '10:00',
      });
      const mehendi = await createEvent(owner, {
        name: 'Mehendi',
        type: 'MEHENDI',
        date: '2027-02-16',
      });

      const first = await assign(owner, guest.id, haldi);
      expect(first).toEqual({
        id: expect.any(String),
        guestId: guest.id,
        eventId: haldi,
        rsvpStatus: 'PENDING',
        attendeeCount: null,
        respondedAt: null,
        rsvpUpdatedAt: null,
        createdAt: expect.any(String),
      });
      const again = await assign(owner, guest.id, haldi, 200);
      expect(again).toEqual(first);
      await assign(owner, guest.id, mehendi);

      // Concurrent assignment of the same pair still leaves one active record.
      const sangeet = await createEvent(owner, {
        name: 'Sangeet',
        type: 'SANGEET',
        date: '2027-02-17',
      });
      const statuses = await Promise.all(
        [0, 1, 2].map(() =>
          owner.agent.post(`${guestsUrl(owner)}/${guest.id}/events`).send({ eventId: sangeet }),
        ),
      ).then((responses) => responses.map((response) => response.status).sort());
      expect(statuses.filter((status) => status === 201)).toHaveLength(1);

      const list = await owner.agent.get(`${guestsUrl(owner)}/${guest.id}/events`).expect(200);
      // Event order: Mehendi (16th), Haldi (17th, 10:00), Sangeet (17th, untimed → first).
      expect(pluck(list.body.data, 'eventId')).toEqual([mehendi, sangeet, haldi]);
    });

    it('removes an assignment as history and allows assigning again', async () => {
      const owner = await workspace.owner();
      const { guest } = await createGuest(owner);
      const haldi = await createEvent(owner, { name: 'Haldi', type: 'HALDI', date: '2027-02-17' });
      const assignment = await assign(owner, guest.id, haldi);
      await rsvp(owner, assignment.id, { rsvpStatus: 'ATTENDING', attendeeCount: 2 }).expect(200);

      const url = `/api/v1/weddings/${owner.weddingId}/guest-events/${assignment.id}`;
      await owner.agent.delete(url).expect(204);
      await owner.agent.delete(url).expect(404);
      const list = await owner.agent.get(`${guestsUrl(owner)}/${guest.id}/events`).expect(200);
      expect(list.body.data).toEqual([]);

      const stored = await workspace.connection
        .collection('guest_events')
        .findOne({ _id: new Types.ObjectId(assignment.id) });
      expect(stored).toMatchObject({
        isActive: false,
        removedAt: expect.any(Date),
        rsvpStatus: 'ATTENDING',
        attendeeCount: 2,
      });

      const reassigned = await assign(owner, guest.id, haldi);
      expect(reassigned.id).not.toBe(assignment.id);
      expect(reassigned.rsvpStatus).toBe('PENDING');
    });

    it('hides assignments to deleted events and refuses deleted events and guests', async () => {
      const owner = await workspace.owner();
      const { guest } = await createGuest(owner);
      const haldi = await createEvent(owner, { name: 'Haldi', type: 'HALDI', date: '2027-02-17' });
      const assignment = await assign(owner, guest.id, haldi);
      await owner.agent.delete(`/api/v1/weddings/${owner.weddingId}/events/${haldi}`).expect(204);

      const list = await owner.agent.get(`${guestsUrl(owner)}/${guest.id}/events`).expect(200);
      expect(list.body.data).toEqual([]);
      const refused = await owner.agent
        .post(`${guestsUrl(owner)}/${guest.id}/events`)
        .send({ eventId: haldi })
        .expect(404);
      expect(refused.body.error.code).toBe('EVENT_NOT_FOUND');
      const stale = await rsvp(owner, assignment.id, { rsvpStatus: 'MAYBE', attendeeCount: null });
      expect(stale.status).toBe(404);
      expect(stale.body.error.code).toBe('GUEST_EVENT_NOT_FOUND');
      // Removing it is refused too, so its history stays as it was (review M3).
      const removed = await owner.agent
        .delete(`/api/v1/weddings/${owner.weddingId}/guest-events/${assignment.id}`)
        .expect(404);
      expect(removed.body.error.code).toBe('GUEST_EVENT_NOT_FOUND');

      // The assignment record itself is untouched (0017 #12).
      const stored = await workspace.connection
        .collection('guest_events')
        .findOne({ _id: new Types.ObjectId(assignment.id) });
      expect(stored).toMatchObject({ isActive: true, rsvpStatus: 'PENDING' });
    });
  });

  describe('RSVP', () => {
    async function assignedGuest() {
      const owner = await workspace.owner();
      const { guest } = await createGuest(owner);
      const haldi = await createEvent(owner, { name: 'Haldi', type: 'HALDI', date: '2027-02-17' });
      const sangeet = await createEvent(owner, {
        name: 'Sangeet',
        type: 'SANGEET',
        date: '2027-02-17',
      });
      return {
        owner,
        guestId: guest.id,
        haldi: await assign(owner, guest.id, haldi),
        sangeet: await assign(owner, guest.id, sangeet),
      };
    }

    it('accepts only the four status/count combinations', async () => {
      const { owner, haldi } = await assignedGuest();
      for (const body of [
        { rsvpStatus: 'ATTENDING', attendeeCount: 4 },
        { rsvpStatus: 'DECLINED', attendeeCount: 0 },
        { rsvpStatus: 'MAYBE', attendeeCount: null },
        { rsvpStatus: 'ATTENDING', attendeeCount: 120 },
      ]) {
        const response = await rsvp(owner, haldi.id, body).expect(200);
        expect(response.body.data).toMatchObject({
          ...body,
          rsvpUpdatedAt: expect.any(String),
          respondedAt: null,
        });
      }

      for (const body of [
        { rsvpStatus: 'ATTENDING', attendeeCount: 0 },
        { rsvpStatus: 'ATTENDING', attendeeCount: null },
        { rsvpStatus: 'ATTENDING' },
        { rsvpStatus: 'DECLINED', attendeeCount: null },
        { rsvpStatus: 'MAYBE', attendeeCount: 2 },
        { rsvpStatus: 'PENDING', attendeeCount: 0 },
        { rsvpStatus: 'ATTENDING', attendeeCount: 1.5 },
      ]) {
        const response = await rsvp(owner, haldi.id, body).expect(400);
        expect(response.body.error.code).toBe('VALIDATION_FAILED');
        expect(Object.keys(response.body.error.details.fields)).toEqual(['attendeeCount']);
      }
      const badStatus = await rsvp(owner, haldi.id, { rsvpStatus: 'YES', attendeeCount: 1 });
      expect(badStatus.body.error.details.fields).toEqual({ rsvpStatus: ['Choose a response.'] });
    });

    it('keeps each assignment’s RSVP independent', async () => {
      const { owner, guestId, haldi, sangeet } = await assignedGuest();
      await rsvp(owner, haldi.id, { rsvpStatus: 'ATTENDING', attendeeCount: 4 }).expect(200);
      await rsvp(owner, sangeet.id, { rsvpStatus: 'DECLINED', attendeeCount: 0 }).expect(200);
      const list = await owner.agent.get(`${guestsUrl(owner)}/${guestId}/events`).expect(200);
      expect(pluck(list.body.data, 'rsvpStatus')).toEqual(['ATTENDING', 'DECLINED']);
      expect(pluck(list.body.data, 'attendeeCount')).toEqual([4, 0]);
    });

    it('lets an organizer reset to PENDING and records the reset in the audit history', async () => {
      const { owner, haldi } = await assignedGuest();
      await rsvp(owner, haldi.id, { rsvpStatus: 'ATTENDING', attendeeCount: 3 }).expect(200);
      const reset = await rsvp(owner, haldi.id, {
        rsvpStatus: 'PENDING',
        attendeeCount: null,
      }).expect(200);
      expect(reset.body.data).toMatchObject({ rsvpStatus: 'PENDING', attendeeCount: null });

      const entries = await workspace.connection
        .collection('audit_logs')
        .find({ resourceId: new Types.ObjectId(haldi.id) })
        .toArray();
      expect(entries).toEqual([
        expect.objectContaining({
          weddingId: new Types.ObjectId(owner.weddingId),
          action: 'RSVP_RESET_TO_PENDING',
          resourceType: 'guest_event',
          metadata: { previousStatus: 'ATTENDING', previousAttendeeCount: 3 },
          createdAt: expect.any(Date),
        }),
      ]);
    });

    it('filters guests by event and RSVP status', async () => {
      const owner = await workspace.owner();
      const haldi = await createEvent(owner, { name: 'Haldi', type: 'HALDI', date: '2027-02-17' });
      const sangeet = await createEvent(owner, {
        name: 'Sangeet',
        type: 'SANGEET',
        date: '2027-02-17',
      });
      const raju = (await createGuest(owner)).guest.id;
      const sunita = (await createGuest(owner, { name: 'Sunita Sharma', mobile: '9876543211' }))
        .guest.id;
      await createGuest(owner, { name: 'Kavita Verma', mobile: '9822233445' });

      const rajuHaldi = await assign(owner, raju, haldi);
      await assign(owner, sunita, sangeet);
      await rsvp(owner, rajuHaldi.id, { rsvpStatus: 'ATTENDING', attendeeCount: 2 }).expect(200);

      const names = async (query: string) => {
        const response = await owner.agent.get(`${guestsUrl(owner)}?${query}`).expect(200);
        return pluck(response.body.data, 'name') as string[];
      };
      expect(await names(`eventId=${haldi}`)).toEqual(['Raju Sharma']);
      expect(await names('rsvpStatus=PENDING')).toEqual(['Sunita Sharma']);
      expect(await names('rsvpStatus=ATTENDING')).toEqual(['Raju Sharma']);
      expect(await names(`eventId=${sangeet}&rsvpStatus=ATTENDING`)).toEqual([]);

      await owner.agent.delete(`/api/v1/weddings/${owner.weddingId}/events/${haldi}`).expect(204);
      expect(await names('rsvpStatus=ATTENDING')).toEqual([]);
      const filterDeleted = await owner.agent
        .get(`${guestsUrl(owner)}?eventId=${haldi}`)
        .expect(404);
      expect(filterDeleted.body.error.code).toBe('EVENT_NOT_FOUND');
    });
  });

  describe('tenant isolation', () => {
    it('never lets another wedding’s IDs read or change records', async () => {
      const owner = await workspace.owner();
      const { guest } = await createGuest(owner);
      const haldi = await createEvent(owner, { name: 'Haldi', type: 'HALDI', date: '2027-02-17' });
      const assignment = await assign(owner, guest.id, haldi);

      const other = await workspace.owner();
      const otherGuest = (await createGuest(other, { name: 'Other', mobile: '9000000000' })).guest
        .id;
      const otherEvent = await createEvent(other, {
        name: 'X',
        type: 'CUSTOM',
        date: '2027-01-01',
      });

      // The other owner cannot reach the first wedding at all.
      await other.agent.get(guestsUrl(owner)).expect(404);

      // Nor use its IDs through their own wedding.
      const base = guestsUrl(other);
      expect((await other.agent.get(`${base}/${guest.id}`).expect(404)).body.error.code).toBe(
        'GUEST_NOT_FOUND',
      );
      await other.agent.patch(`${base}/${guest.id}`).send({ name: 'X' }).expect(404);
      await other.agent.delete(`${base}/${guest.id}`).expect(404);
      await other.agent.get(`${base}/${guest.id}/events`).expect(404);
      // Their own guest, with the first wedding's event.
      const crossEvent = await other.agent
        .post(`${base}/${otherGuest}/events`)
        .send({ eventId: haldi })
        .expect(404);
      expect(crossEvent.body.error.code).toBe('EVENT_NOT_FOUND');
      // The first wedding's guest, with their own event.
      await other.agent
        .post(`${base}/${guest.id}/events`)
        .send({ eventId: otherEvent })
        .expect(404);
      const crossRsvp = await rsvp(other, assignment.id, {
        rsvpStatus: 'MAYBE',
        attendeeCount: null,
      });
      expect(crossRsvp.status).toBe(404);
      expect(crossRsvp.body.error.code).toBe('GUEST_EVENT_NOT_FOUND');
      await other.agent
        .delete(`/api/v1/weddings/${other.weddingId}/guest-events/${assignment.id}`)
        .expect(404);
      const list = await other.agent.get(base).expect(200);
      expect(pluck(list.body.data, 'id')).toEqual([otherGuest]);
    });
  });
});
