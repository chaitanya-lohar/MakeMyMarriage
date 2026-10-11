import { Injectable } from '@nestjs/common';
import type { WeddingEvent } from '../../domain/types/event.js';
import { EventsRepository } from '../../infrastructure/repositories/events.repository.js';
import { EventsErrors } from '../events-errors.js';

/**
 * Event reads for the events controller and for other modules (guests, invitations,
 * dashboard). Every method is scoped to one wedding; deleted events are never returned.
 */
@Injectable()
export class EventsService {
  constructor(private readonly events: EventsRepository) {}

  listActive(weddingId: string): Promise<WeddingEvent[]> {
    return this.events.listActive(weddingId);
  }

  /** The active event, or EVENT_NOT_FOUND. */
  async getActive(weddingId: string, eventId: string): Promise<WeddingEvent> {
    const event = await this.events.findActive(weddingId, eventId);
    if (!event) throw EventsErrors.notFound();
    return event;
  }

  findActive(weddingId: string, eventId: string): Promise<WeddingEvent | null> {
    return this.events.findActive(weddingId, eventId);
  }

  /** The active events among these IDs, in event order. */
  findActiveMany(weddingId: string, eventIds: string[]): Promise<WeddingEvent[]> {
    return this.events.findActiveMany(weddingId, eventIds);
  }

  /** Up to `limit` active events dated `fromDate` (YYYY-MM-DD) or later, in event order. */
  listActiveFrom(weddingId: string, fromDate: string, limit: number): Promise<WeddingEvent[]> {
    return this.events.listActiveFrom(weddingId, fromDate, limit);
  }

  async delete(weddingId: string, eventId: string, userId: string): Promise<void> {
    if (!(await this.events.softDelete(weddingId, eventId, userId))) throw EventsErrors.notFound();
  }
}
