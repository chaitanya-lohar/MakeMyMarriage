import { Injectable } from '@nestjs/common';
import { eventTimesError } from '../../domain/rules/event-rules.js';
import type { EventChanges, WeddingEvent } from '../../domain/types/event.js';
import { EventsRepository } from '../../infrastructure/repositories/events.repository.js';
import { EventsErrors } from '../events-errors.js';

/** Updates an event. The time rule is checked against the event as it will be saved. */
@Injectable()
export class UpdateEventUseCase {
  constructor(private readonly events: EventsRepository) {}

  async execute(weddingId: string, eventId: string, changes: EventChanges): Promise<WeddingEvent> {
    const current = await this.events.findActive(weddingId, eventId);
    if (!current) throw EventsErrors.notFound();

    const startTime = changes.startTime === undefined ? current.startTime : changes.startTime;
    const endTime = changes.endTime === undefined ? current.endTime : changes.endTime;
    const timesError = eventTimesError(startTime, endTime);
    if (timesError) throw EventsErrors.invalidTimes(timesError);

    const updated = await this.events.update(weddingId, eventId, changes);
    if (!updated) throw EventsErrors.notFound();
    return updated;
  }
}
