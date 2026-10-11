import { Injectable } from '@nestjs/common';
import { EventsService } from '../../../events/index.js';
import type { GuestListQuery, GuestPage } from '../../domain/types/guest.js';
import { GuestEventsRepository } from '../../infrastructure/repositories/guest-events.repository.js';
import {
  decodeCursor,
  GuestsRepository,
} from '../../infrastructure/repositories/guests.repository.js';
import { GuestsErrors } from '../guests-errors.js';

/**
 * Lists, searches and filters guests (API Design §9). The event filter keeps guests with an
 * active assignment to that event; the RSVP filter keeps guests with an assignment in that
 * status — to the chosen event, or to any active event.
 */
@Injectable()
export class ListGuestsUseCase {
  constructor(
    private readonly guests: GuestsRepository,
    private readonly assignments: GuestEventsRepository,
    private readonly events: EventsService,
  ) {}

  async execute(weddingId: string, query: GuestListQuery): Promise<GuestPage> {
    const cursor = query.cursor === undefined ? undefined : decodeCursor(query.cursor);
    if (cursor === null) throw GuestsErrors.invalidCursor();

    let guestIds: string[] | undefined;
    if (query.eventId !== undefined || query.rsvpStatus !== undefined) {
      const eventIds =
        query.eventId !== undefined
          ? [(await this.events.getActive(weddingId, query.eventId)).id]
          : (await this.events.listActive(weddingId)).map((event) => event.id);
      guestIds = await this.assignments.guestIdsAssignedTo(weddingId, eventIds, query.rsvpStatus);
      if (guestIds.length === 0) return { guests: [], nextCursor: null };
    }

    return this.guests.search(weddingId, {
      search: query.search,
      guestIds,
      limit: query.limit,
      cursor,
    });
  }
}
