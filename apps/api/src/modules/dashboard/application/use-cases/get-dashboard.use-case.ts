import { Injectable } from '@nestjs/common';
import { EventsService, type WeddingEvent } from '../../../events/index.js';
import { GuestsService, type RsvpStatus } from '../../../guests/index.js';
import { TasksService, type TaskDashboard } from '../../../tasks/index.js';
import { WeddingsService } from '../../../weddings/index.js';
import { weddingNotFound } from '../../../workspace/index.js';
import { todayIn, UPCOMING_EVENTS_LIMIT } from '../../domain/rules/dashboard-rules.js';

export interface UpcomingEventSummary {
  event: WeddingEvent;
  expectedAttendees: number;
}

export interface Dashboard {
  upcomingEvents: UpcomingEventSummary[];
  guests: number;
  rsvpBreakdown: Record<RsvpStatus, number>;
  /** Task counts and up to five upcoming tasks (Phase 7 PRD §8, decision 0026 #20). */
  tasks: TaskDashboard;
}

/**
 * The four Phase 4 dashboard summaries (Phase 4 PRD §10.2, decision 0022), computed from
 * current data on every request. Only counted records take part: events and guests that are
 * not deleted, and active assignments whose event and guest both count.
 */
@Injectable()
export class GetDashboardUseCase {
  constructor(
    private readonly weddings: WeddingsService,
    private readonly events: EventsService,
    private readonly guests: GuestsService,
    private readonly tasks: TasksService,
  ) {}

  async execute(weddingId: string, now: Date = new Date()): Promise<Dashboard> {
    const wedding = await this.weddings.findById(weddingId);
    if (!wedding) throw weddingNotFound();

    const [upcoming, activeEvents, guests, tasks] = await Promise.all([
      // At most five, in date and start-time order, untimed first (0022 #1, #3).
      this.events.listActiveFrom(weddingId, todayIn(wedding.timezone, now), UPCOMING_EVENTS_LIMIT),
      this.events.listActive(weddingId),
      this.guests.countActive(weddingId),
      this.tasks.dashboard(weddingId, now),
    ]);
    const [rsvpBreakdown, attending] = await Promise.all([
      // Across all counted events, past and future; a guest counts once per event.
      this.guests.rsvpCounts(
        weddingId,
        activeEvents.map((event) => event.id),
      ),
      // Only for the returned events; never a wedding-wide total (0022 #2).
      this.guests.attendingTotals(
        weddingId,
        upcoming.map((event) => event.id),
      ),
    ]);

    return {
      upcomingEvents: upcoming.map((event) => ({
        event,
        expectedAttendees: attending.get(event.id) ?? 0,
      })),
      guests,
      rsvpBreakdown,
      tasks,
    };
  }
}
