import { describe, expect, it, vi } from 'vitest';
import type { EventsService } from '../../../events/index.js';
import type { ExpensesService } from '../../../expenses/index.js';
import type { GuestsService } from '../../../guests/index.js';
import type { TasksService } from '../../../tasks/index.js';
import type { VendorsService } from '../../../vendors/index.js';
import type { WeddingsService } from '../../../weddings/index.js';
import {
  EffectivePermissions,
  PermissionAction,
  type PermissionModule,
} from '../../../workspace/index.js';
import { GetDashboardUseCase } from './get-dashboard.use-case.js';

const WEDDING = 'wedding-1';
const event = { id: 'event-1', name: 'Mehendi' };

function services() {
  const calls = {
    listActiveFrom: vi.fn(() => Promise.resolve([event])),
    listActive: vi.fn(() => Promise.resolve([event])),
    countActive: vi.fn(() => Promise.resolve(86)),
    rsvpCounts: vi.fn(() => Promise.resolve({ PENDING: 1, ATTENDING: 2, DECLINED: 0, MAYBE: 0 })),
    attendingTotals: vi.fn(() => Promise.resolve(new Map([[event.id, 38]]))),
    tasks: vi.fn(() => Promise.resolve({ counts: {}, hasTasks: false, upcoming: [] })),
    expenses: vi.fn(() => Promise.resolve({ totalMinor: 0 })),
    vendors: vi.fn(() => Promise.resolve({ activeVendors: 0 })),
  };
  const useCase = new GetDashboardUseCase(
    {
      findById: () => Promise.resolve({ id: WEDDING, timezone: 'Asia/Kolkata' }),
    } as unknown as WeddingsService,
    {
      listActiveFrom: calls.listActiveFrom,
      listActive: calls.listActive,
    } as unknown as EventsService,
    {
      countActive: calls.countActive,
      rsvpCounts: calls.rsvpCounts,
      attendingTotals: calls.attendingTotals,
    } as unknown as GuestsService,
    { dashboard: calls.tasks } as unknown as TasksService,
    { dashboard: calls.expenses } as unknown as ExpensesService,
    { dashboard: calls.vendors } as unknown as VendorsService,
  );
  return { useCase, calls };
}

/** Effective permissions holding VIEW on exactly the given modules. */
function viewing(...modules: PermissionModule[]): EffectivePermissions {
  return new EffectivePermissions(
    false,
    new Map(modules.map((module) => [module, new Set([PermissionAction.View])])),
  );
}

describe('GetDashboardUseCase permissions (API Design §6, P10-8)', () => {
  it('returns every section to a member who can view every module', async () => {
    const { useCase } = services();
    const dashboard = await useCase.execute(
      WEDDING,
      viewing('EVENTS', 'GUESTS', 'INVITATIONS', 'TASKS', 'EXPENSES', 'VENDORS'),
    );
    expect(Object.keys(dashboard).sort()).toEqual([
      'expenses',
      'guests',
      'rsvpBreakdown',
      'tasks',
      'upcomingEvents',
      'vendorSummary',
    ]);
    expect(dashboard.upcomingEvents?.[0]?.expectedAttendees).toBe(38);
  });

  it('omits a section the member cannot view and never runs its queries', async () => {
    const { useCase, calls } = services();
    const dashboard = await useCase.execute(
      WEDDING,
      viewing('EVENTS', 'GUESTS', 'INVITATIONS', 'TASKS', 'VENDORS'),
    );
    expect(dashboard).not.toHaveProperty('expenses');
    expect(calls.expenses).not.toHaveBeenCalled();
  });

  it('returns nothing to a member who can view no module', async () => {
    const { useCase, calls } = services();
    expect(await useCase.execute(WEDDING, viewing())).toEqual({});
    for (const call of Object.values(calls)) expect(call).not.toHaveBeenCalled();
  });

  it('omits expected attendees and the RSVP breakdown without INVITATIONS:VIEW', async () => {
    const { useCase, calls } = services();
    const dashboard = await useCase.execute(WEDDING, viewing('EVENTS'));
    expect(dashboard.upcomingEvents).toEqual([{ event }]);
    expect(dashboard).not.toHaveProperty('rsvpBreakdown');
    expect(calls.rsvpCounts).not.toHaveBeenCalled();
    expect(calls.attendingTotals).not.toHaveBeenCalled();
  });

  it('gives the RSVP breakdown without listing upcoming events when EVENTS is not viewable', async () => {
    const { useCase, calls } = services();
    const dashboard = await useCase.execute(WEDDING, viewing('INVITATIONS'));
    expect(dashboard).toEqual({
      rsvpBreakdown: { PENDING: 1, ATTENDING: 2, DECLINED: 0, MAYBE: 0 },
    });
    expect(calls.listActiveFrom).not.toHaveBeenCalled();
  });
});
