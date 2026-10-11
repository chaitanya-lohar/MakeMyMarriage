import { Injectable } from '@nestjs/common';
import { EventsService } from '../../../events/index.js';
import type { GuestEvent } from '../../domain/types/guest.js';
import {
  GuestEventsRepository,
  type CreatedAssignment,
} from '../../infrastructure/repositories/guest-events.repository.js';
import { GuestsRepository } from '../../infrastructure/repositories/guests.repository.js';
import { GuestsErrors } from '../guests-errors.js';

/** Assigning guests to events and removing assignments (Phase 4 PRD §5). */
@Injectable()
export class GuestAssignmentsUseCase {
  constructor(
    private readonly guests: GuestsRepository,
    private readonly assignments: GuestEventsRepository,
    private readonly events: EventsService,
  ) {}

  /** The guest's active assignments to active events, in event order. */
  async list(weddingId: string, guestId: string): Promise<GuestEvent[]> {
    await this.requireGuest(weddingId, guestId);
    const assignments = await this.assignments.listActiveForGuest(weddingId, guestId);
    const events = await this.events.findActiveMany(
      weddingId,
      assignments.map((assignment) => assignment.eventId),
    );
    const byEvent = new Map(assignments.map((assignment) => [assignment.eventId, assignment]));
    return events.flatMap((event) => {
      const assignment = byEvent.get(event.id);
      return assignment ? [assignment] : [];
    });
  }

  /** Assigns the guest; assigning the same pair again returns the existing assignment. */
  async assign(weddingId: string, guestId: string, eventId: string): Promise<CreatedAssignment> {
    await this.requireGuest(weddingId, guestId);
    await this.events.getActive(weddingId, eventId);
    return this.assignments.createOrGet(weddingId, guestId, eventId);
  }

  /**
   * Removes an active assignment. An assignment whose event or guest is deleted is no longer
   * active and is left untouched as history (0017 #12, Database Design §10.2).
   */
  async remove(weddingId: string, guestEventId: string, userId: string): Promise<void> {
    const current = await this.assignments.findActive(weddingId, guestEventId);
    if (
      !current ||
      !(await this.guests.findActive(weddingId, current.guestId)) ||
      !(await this.events.findActive(weddingId, current.eventId)) ||
      !(await this.assignments.remove(weddingId, guestEventId, userId))
    ) {
      throw GuestsErrors.assignmentNotFound();
    }
  }

  private async requireGuest(weddingId: string, guestId: string): Promise<void> {
    if (!(await this.guests.findActive(weddingId, guestId))) throw GuestsErrors.notFound();
  }
}
