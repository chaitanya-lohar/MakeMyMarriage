import { Injectable } from '@nestjs/common';
import { EventsService, type WeddingEvent } from '../../../events/index.js';
import { ExpensesService, type ExpenseSummary } from '../../../expenses/index.js';
import { GuestsService, type RsvpStatus } from '../../../guests/index.js';
import { TasksService, type TaskDashboard } from '../../../tasks/index.js';
import { WeddingsService } from '../../../weddings/index.js';
import {
  PermissionAction,
  PermissionModule,
  weddingNotFound,
  type EffectivePermissions,
} from '../../../workspace/index.js';
import { todayIn, UPCOMING_EVENTS_LIMIT } from '../../domain/rules/dashboard-rules.js';
import { VendorsService } from '../../../vendors/index.js';
import type { VendorSummary } from '../../../vendors/index.js';

export interface UpcomingEventSummary {
  event: WeddingEvent;
  /** Only with INVITATIONS:VIEW (API Design §6, P10-8). */
  expectedAttendees?: number;
}

/**
 * Each section is present only when the caller may view its module (API Design §6, P10-8);
 * an absent section was not computed.
 */
export interface Dashboard {
  upcomingEvents?: UpcomingEventSummary[];
  guests?: number;
  rsvpBreakdown?: Record<RsvpStatus, number>;
  /** Task counts and up to five upcoming tasks (Phase 7 PRD §8, decision 0026 #20). */
  tasks?: TaskDashboard;
  /** Total, Paid, Pending and the two breakdowns (Phase 8 PRD §8, decision 0028 #23). */
  expenses?: ExpenseSummary;
  vendorSummary?: VendorSummary;
}

const skip = Promise.resolve(undefined);

/**
 * The four Phase 4 dashboard summaries (Phase 4 PRD §10.2, decision 0022), computed from
 * current data on every request. Only counted records take part: events and guests that are
 * not deleted, and active assignments whose event and guest both count. A section the
 * caller may not view is neither computed nor returned, so no count leaks through another
 * section (API Design §6, P10-8).
 */
@Injectable()
export class GetDashboardUseCase {
  constructor(
    private readonly weddings: WeddingsService,
    private readonly events: EventsService,
    private readonly guests: GuestsService,
    private readonly tasks: TasksService,
    private readonly expenses: ExpensesService,
    private readonly vendors: VendorsService,
  ) {}

  async execute(
    weddingId: string,
    permissions: EffectivePermissions,
    now: Date = new Date(),
  ): Promise<Dashboard> {
    const wedding = await this.weddings.findById(weddingId);
    if (!wedding) throw weddingNotFound();
    const canView = (module: PermissionModule) => permissions.has(module, PermissionAction.View);
    const rsvp = canView(PermissionModule.Invitations);

    const [upcoming, activeEvents, guests, tasks, expenses, vendorSummary] = await Promise.all([
      // At most five, in date and start-time order, untimed first (0022 #1, #3).
      canView(PermissionModule.Events)
        ? this.events.listActiveFrom(
            weddingId,
            todayIn(wedding.timezone, now),
            UPCOMING_EVENTS_LIMIT,
          )
        : skip,
      // The counted events the RSVP breakdown runs over; never returned.
      rsvp ? this.events.listActive(weddingId) : skip,
      canView(PermissionModule.Guests) ? this.guests.countActive(weddingId) : skip,
      canView(PermissionModule.Tasks) ? this.tasks.dashboard(weddingId, now) : skip,
      canView(PermissionModule.Expenses) ? this.expenses.dashboard(weddingId) : skip,
      canView(PermissionModule.Vendors)
        ? this.vendors.dashboard(weddingId, wedding.timezone, now)
        : skip,
    ]);
    const [rsvpBreakdown, attending] = await Promise.all([
      // Across all counted events, past and future; a guest counts once per event.
      activeEvents
        ? this.guests.rsvpCounts(
            weddingId,
            activeEvents.map((event) => event.id),
          )
        : skip,
      // Only for the returned events; never a wedding-wide total (0022 #2).
      upcoming && rsvp
        ? this.guests.attendingTotals(
            weddingId,
            upcoming.map((event) => event.id),
          )
        : skip,
    ]);

    return {
      ...(upcoming && {
        upcomingEvents: upcoming.map((event) => ({
          event,
          ...(attending && { expectedAttendees: attending.get(event.id) ?? 0 }),
        })),
      }),
      ...(guests !== undefined && { guests }),
      ...(rsvpBreakdown && { rsvpBreakdown }),
      ...(tasks && { tasks }),
      ...(expenses && { expenses }),
      ...(vendorSummary && { vendorSummary }),
    };
  }
}
