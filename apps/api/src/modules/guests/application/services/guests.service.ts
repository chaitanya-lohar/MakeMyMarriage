import { Injectable } from '@nestjs/common';
import { TransactionRunner } from '../../../../infrastructure/database/transaction.js';
import { EventsService, type WeddingEvent } from '../../../events/index.js';
import type { RsvpStatus } from '../../domain/rules/rsvp-rules.js';
import type { Guest, RsvpAnswer } from '../../domain/types/guest.js';
import { GuestEventsRepository } from '../../infrastructure/repositories/guest-events.repository.js';
import { GuestsRepository } from '../../infrastructure/repositories/guests.repository.js';
import { GuestsErrors } from '../guests-errors.js';
import { GuestInvitations } from '../ports/guest-invitations.port.js';

/** An event on a guest's invitation, with the guest's RSVP for it. */
export interface InvitedEvent {
  guestEventId: string;
  rsvpStatus: RsvpStatus;
  attendeeCount: number | null;
  event: WeddingEvent;
}

export interface GuestResponse extends RsvpAnswer {
  guestEventId: string;
}

/**
 * Guest reads and changes for the guests controllers and for other modules (invitations,
 * dashboard). Every method is scoped to one wedding; deleted guests are never returned.
 */
@Injectable()
export class GuestsService {
  constructor(
    private readonly guests: GuestsRepository,
    private readonly assignments: GuestEventsRepository,
    private readonly events: EventsService,
    private readonly invitations: GuestInvitations,
    private readonly transactions: TransactionRunner,
  ) {}

  /** The active guest, or GUEST_NOT_FOUND. */
  async getActive(weddingId: string, guestId: string): Promise<Guest> {
    const guest = await this.guests.findActive(weddingId, guestId);
    if (!guest) throw GuestsErrors.notFound();
    return guest;
  }

  findActive(weddingId: string, guestId: string): Promise<Guest | null> {
    return this.guests.findActive(weddingId, guestId);
  }

  /**
   * Soft-deletes the guest and revokes their invitation token in one transaction; their
   * assignments, RSVPs and invitation history are kept (Phase 4 PRD §4, 0018 #9).
   */
  async delete(weddingId: string, guestId: string, userId: string): Promise<void> {
    const deleted = await this.transactions.run(async (transaction) => {
      if (!(await this.guests.softDelete(weddingId, guestId, userId, transaction))) return false;
      await this.invitations.revokeForDeletedGuest(weddingId, guestId, userId, transaction);
      return true;
    });
    if (!deleted) throw GuestsErrors.notFound();
  }

  /**
   * The guest's active assignments to active events, in event order — the events their
   * invitation covers (Phase 4 PRD §5).
   */
  async invitedEvents(weddingId: string, guestId: string): Promise<InvitedEvent[]> {
    const assignments = await this.assignments.listActiveForGuest(weddingId, guestId);
    const events = await this.events.findActiveMany(
      weddingId,
      assignments.map((assignment) => assignment.eventId),
    );
    const byEvent = new Map(assignments.map((assignment) => [assignment.eventId, assignment]));
    return events.flatMap((event) => {
      const assignment = byEvent.get(event.id);
      return assignment
        ? [
            {
              guestEventId: assignment.id,
              rsvpStatus: assignment.rsvpStatus,
              attendeeCount: assignment.attendeeCount,
              event,
            },
          ]
        : [];
    });
  }

  /**
   * Applies a guest's RSVP responses, all or nothing (API Design §10). Returns false — and
   * changes nothing — when any response names an assignment that is not one of the guest's
   * active assignments to an active event. Callers have validated the answers.
   */
  async respondAsGuest(
    weddingId: string,
    guestId: string,
    responses: GuestResponse[],
  ): Promise<boolean> {
    const allowed = new Set(
      (await this.invitedEvents(weddingId, guestId)).map((item) => item.guestEventId),
    );
    if (!responses.every((response) => allowed.has(response.guestEventId))) return false;

    return this.transactions.run(async (transaction) => {
      for (const response of responses) {
        const updated = await this.assignments.updateRsvp(
          weddingId,
          response.guestEventId,
          { rsvpStatus: response.rsvpStatus, attendeeCount: response.attendeeCount },
          { guest: true },
          transaction,
        );
        if (!updated) throw GuestsErrors.assignmentNotFound();
      }
      return true;
    });
  }

  /** Counted guests, including guests not assigned to any event (Phase 4 PRD §10.2). */
  countActive(weddingId: string): Promise<number> {
    return this.guests.countActive(weddingId);
  }

  /** Counted assignments per RSVP status over these (active) events. */
  rsvpCounts(weddingId: string, eventIds: string[]): Promise<Record<RsvpStatus, number>> {
    return this.assignments.countByStatus(weddingId, eventIds);
  }

  /** Per event, the attendee total of its counted ATTENDING assignments. */
  attendingTotals(weddingId: string, eventIds: string[]): Promise<Map<string, number>> {
    return this.assignments.attendingTotals(weddingId, eventIds);
  }
}
