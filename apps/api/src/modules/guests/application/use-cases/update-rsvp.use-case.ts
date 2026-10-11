import { Injectable } from '@nestjs/common';
import { TransactionRunner } from '../../../../infrastructure/database/transaction.js';
import { AuditAction, AuditService } from '../../../audit/index.js';
import { EventsService } from '../../../events/index.js';
import { RsvpStatus } from '../../domain/rules/rsvp-rules.js';
import type { GuestEvent, RsvpAnswer } from '../../domain/types/guest.js';
import { GuestEventsRepository } from '../../infrastructure/repositories/guest-events.repository.js';
import { GuestsRepository } from '../../infrastructure/repositories/guests.repository.js';
import { GuestsErrors } from '../guests-errors.js';

/**
 * Organizer RSVP update (API Design §9). Organizers may set any of the four combinations,
 * including a reset to PENDING, which is recorded in the audit history in the same
 * transaction (0018 #7). It never changes other assignments or the invitation.
 */
@Injectable()
export class UpdateRsvpUseCase {
  constructor(
    private readonly assignments: GuestEventsRepository,
    private readonly guests: GuestsRepository,
    private readonly events: EventsService,
    private readonly audit: AuditService,
    private readonly transactions: TransactionRunner,
  ) {}

  async execute(
    weddingId: string,
    guestEventId: string,
    userId: string,
    answer: RsvpAnswer,
  ): Promise<GuestEvent> {
    const current = await this.assignments.findActive(weddingId, guestEventId);
    // An assignment whose guest or event is deleted is no longer active.
    if (
      !current ||
      !(await this.guests.findActive(weddingId, current.guestId)) ||
      !(await this.events.findActive(weddingId, current.eventId))
    ) {
      throw GuestsErrors.assignmentNotFound();
    }

    const updated = await this.transactions.run(async (transaction) => {
      const result = await this.assignments.updateRsvp(
        weddingId,
        guestEventId,
        answer,
        { organizerId: userId },
        transaction,
      );
      if (result && answer.rsvpStatus === RsvpStatus.Pending) {
        await this.audit.record(
          {
            weddingId,
            actorUserId: userId,
            action: AuditAction.RsvpResetToPending,
            resourceType: 'guest_event',
            resourceId: guestEventId,
            metadata: {
              previousStatus: current.rsvpStatus,
              previousAttendeeCount: current.attendeeCount,
            },
          },
          transaction,
        );
      }
      return result;
    });
    if (!updated) throw GuestsErrors.assignmentNotFound();
    return updated;
  }
}
