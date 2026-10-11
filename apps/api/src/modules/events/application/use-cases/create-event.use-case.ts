import { Injectable } from '@nestjs/common';
import { WeddingsService } from '../../../weddings/index.js';
import { weddingNotFound } from '../../../workspace/index.js';
import { eventTimesError } from '../../domain/rules/event-rules.js';
import type { EventDetails, WeddingEvent } from '../../domain/types/event.js';
import { EventsRepository } from '../../infrastructure/repositories/events.repository.js';
import { EventsErrors } from '../events-errors.js';

/** Creates an event; it takes the wedding's timezone (Database Design §9). */
@Injectable()
export class CreateEventUseCase {
  constructor(
    private readonly events: EventsRepository,
    private readonly weddings: WeddingsService,
  ) {}

  async execute(weddingId: string, userId: string, details: EventDetails): Promise<WeddingEvent> {
    const timesError = eventTimesError(details.startTime, details.endTime);
    if (timesError) throw EventsErrors.invalidTimes(timesError);

    const wedding = await this.weddings.findById(weddingId);
    if (!wedding) throw weddingNotFound();

    return this.events.create({
      ...details,
      weddingId,
      timezone: wedding.timezone,
      createdBy: userId,
    });
  }
}
