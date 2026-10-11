import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, mongo, trusted, Types, type PipelineStage } from 'mongoose';
import { sessionOf, type Transaction } from '../../../../infrastructure/database/transaction.js';
import { RsvpStatus } from '../../domain/rules/rsvp-rules.js';
import type { GuestEvent, RsvpAnswer } from '../../domain/types/guest.js';
import { GuestRecord } from '../schemas/guest.schema.js';
import { GuestEventRecord, type GuestEventDocument } from '../schemas/guest-event.schema.js';

/** Filters on ObjectId fields need ObjectIds: strings are not cast under sanitizeFilter. */
const oid = (id: string) => new Types.ObjectId(id);

function toGuestEvent(document: GuestEventDocument): GuestEvent {
  return {
    id: document._id.toString(),
    weddingId: document.weddingId.toString(),
    guestId: document.guestId.toString(),
    eventId: document.eventId.toString(),
    rsvpStatus: document.rsvpStatus,
    attendeeCount: document.attendeeCount ?? null,
    respondedAt: document.respondedAt ?? null,
    rsvpUpdatedAt: document.rsvpUpdatedAt ?? null,
    isActive: document.isActive,
    createdAt: document.createdAt,
  };
}

export interface CreatedAssignment {
  assignment: GuestEvent;
  /** False when an active assignment already existed and was returned unchanged. */
  created: boolean;
}

export type RsvpCounts = Record<RsvpStatus, number>;

/**
 * Data access for `guest_events`, always scoped to one wedding. "Active" means not removed;
 * callers also exclude assignments whose event is deleted, and the counting queries exclude
 * deleted guests (Phase 4 PRD §10.2).
 */
@Injectable()
export class GuestEventsRepository {
  constructor(
    @InjectModel(GuestEventRecord.name) private readonly assignments: Model<GuestEventRecord>,
    @InjectModel(GuestRecord.name) private readonly guests: Model<GuestRecord>,
  ) {}

  /**
   * Creates an active PENDING assignment, or returns the existing active one. The partial
   * unique index settles concurrent requests: the loser reads the winner's record.
   */
  async createOrGet(
    weddingId: string,
    guestId: string,
    eventId: string,
  ): Promise<CreatedAssignment> {
    const key = { weddingId: oid(weddingId), guestId: oid(guestId), eventId: oid(eventId) };
    const existing = await this.assignments.findOne({ ...key, isActive: true });
    if (existing) return { assignment: toGuestEvent(existing), created: false };
    try {
      const document = await this.assignments.create({
        ...key,
        rsvpStatus: RsvpStatus.Pending,
        attendeeCount: null,
        isActive: true,
      });
      return { assignment: toGuestEvent(document), created: true };
    } catch (error) {
      if (error instanceof mongo.MongoServerError && error.code === 11000) {
        const winner = await this.assignments.findOne({ ...key, isActive: true });
        if (winner) return { assignment: toGuestEvent(winner), created: false };
      }
      throw error;
    }
  }

  async findActive(weddingId: string, guestEventId: string): Promise<GuestEvent | null> {
    if (!isValidObjectId(guestEventId)) return null;
    const document = await this.assignments.findOne({
      _id: oid(guestEventId),
      weddingId: oid(weddingId),
      isActive: true,
    });
    return document ? toGuestEvent(document) : null;
  }

  /** The guest's active assignments, oldest first. */
  async listActiveForGuest(weddingId: string, guestId: string): Promise<GuestEvent[]> {
    const documents = await this.assignments
      .find({ weddingId: oid(weddingId), guestId: oid(guestId), isActive: true })
      .sort({ createdAt: 1, _id: 1 });
    return documents.map(toGuestEvent);
  }

  /** Guests with an active assignment to one of these events, optionally in one status. */
  async guestIdsAssignedTo(
    weddingId: string,
    eventIds: string[],
    rsvpStatus?: RsvpStatus,
  ): Promise<string[]> {
    if (eventIds.length === 0) return [];
    const ids = await this.assignments.distinct('guestId', {
      weddingId: oid(weddingId),
      eventId: trusted({ $in: eventIds.map(oid) }),
      isActive: true,
      ...(rsvpStatus ? { rsvpStatus } : {}),
    });
    return ids.map((id) => String(id));
  }

  /** Writes an RSVP. Organizer writes record who and when; guest writes record when. */
  async updateRsvp(
    weddingId: string,
    guestEventId: string,
    answer: RsvpAnswer,
    by: { organizerId: string } | { guest: true },
    transaction?: Transaction,
  ): Promise<GuestEvent | null> {
    const now = new Date();
    const document = await this.assignments.findOneAndUpdate(
      { _id: oid(guestEventId), weddingId: oid(weddingId), isActive: true },
      {
        $set: {
          rsvpStatus: answer.rsvpStatus,
          attendeeCount: answer.attendeeCount,
          ...('organizerId' in by
            ? { rsvpUpdatedBy: oid(by.organizerId), rsvpUpdatedAt: now }
            : { respondedAt: now }),
        },
      },
      { returnDocument: 'after', session: sessionOf(transaction) },
    );
    return document ? toGuestEvent(document) : null;
  }

  /** Marks the assignment removed; the record and its RSVP stay (0017 #18). */
  async remove(weddingId: string, guestEventId: string, removedBy: string): Promise<boolean> {
    if (!isValidObjectId(guestEventId)) return false;
    const result = await this.assignments.updateOne(
      { _id: oid(guestEventId), weddingId: oid(weddingId), isActive: true },
      { $set: { isActive: false, removedAt: new Date(), removedBy: oid(removedBy) } },
    );
    return result.modifiedCount === 1;
  }

  /**
   * Counted assignments per RSVP status over these events (Phase 4 PRD §10.2): active
   * assignments whose guest is not deleted. Callers pass only active event IDs.
   */
  async countByStatus(weddingId: string, eventIds: string[]): Promise<RsvpCounts> {
    const counts: RsvpCounts = { PENDING: 0, ATTENDING: 0, DECLINED: 0, MAYBE: 0 };
    if (eventIds.length === 0) return counts;
    const rows = await this.assignments.aggregate<{ _id: RsvpStatus; count: number }>([
      ...this.countedAssignments(weddingId, eventIds),
      { $group: { _id: '$rsvpStatus', count: { $sum: 1 } } },
    ]);
    for (const row of rows) counts[row._id] = row.count;
    return counts;
  }

  /** Per event: the sum of attendeeCount over counted ATTENDING assignments. */
  async attendingTotals(weddingId: string, eventIds: string[]): Promise<Map<string, number>> {
    const totals = new Map(eventIds.map((id) => [id, 0]));
    if (eventIds.length === 0) return totals;
    const rows = await this.assignments.aggregate<{ _id: Types.ObjectId; total: number }>([
      ...this.countedAssignments(weddingId, eventIds),
      { $match: { rsvpStatus: RsvpStatus.Attending } },
      { $group: { _id: '$eventId', total: { $sum: '$attendeeCount' } } },
    ]);
    for (const row of rows) totals.set(row._id.toString(), row.total);
    return totals;
  }

  private countedAssignments(weddingId: string, eventIds: string[]): PipelineStage[] {
    return [
      {
        $match: {
          weddingId: oid(weddingId),
          eventId: { $in: eventIds.map(oid) },
          isActive: true,
        },
      },
      {
        $lookup: {
          from: this.guests.collection.name,
          localField: 'guestId',
          foreignField: '_id',
          as: 'guest',
          pipeline: [{ $match: { deletedAt: { $exists: false } } }, { $project: { _id: 1 } }],
        },
      },
      { $match: { 'guest.0': { $exists: true } } },
    ];
  }
}
