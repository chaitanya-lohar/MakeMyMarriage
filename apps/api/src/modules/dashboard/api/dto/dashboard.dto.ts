import { ApiProperty } from '@nestjs/swagger';
import { EVENT_TYPES } from '../../../events/index.js';
import { ExpenseSummaryDto } from '../../../expenses/index.js';
import { isDueToday, isOverdue, TASK_PRIORITIES, TASK_STATUSES } from '../../../tasks/index.js';
import type { Dashboard } from '../../application/use-cases/get-dashboard.use-case.js';
import type { VendorSummary } from '../../../vendors/index.js';

class VendorServiceDto {
  @ApiProperty() bookingId!: string;
  @ApiProperty() vendorId!: string;
  @ApiProperty() vendorName!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ format: 'date' }) serviceDate!: string;
  @ApiProperty({ type: String, nullable: true }) eventId!: string | null;
  @ApiProperty({ type: String, nullable: true }) eventName!: string | null;
}
class VendorSummaryDto {
  @ApiProperty() activeVendors!: number;
  @ApiProperty() bookedVendors!: number;
  @ApiProperty() bookingsNeedingFollowUp!: number;
  @ApiProperty({ type: [VendorServiceDto] }) upcomingServices!: VendorSummary['upcomingServices'];
}

class DashboardEventDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Mehendi' })
  name!: string;

  @ApiProperty({ enum: EVENT_TYPES })
  type!: string;

  @ApiProperty({ format: 'date', example: '2027-02-16' })
  date!: string;

  @ApiProperty({ type: String, nullable: true, example: '16:00' })
  startTime!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '20:00' })
  endTime!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Garden Palace' })
  venueName!: string | null;

  @ApiProperty({
    required: false,
    example: 38,
    description:
      'Sum of attendeeCount over counted ATTENDING assignments for this event. Only with ' +
      'INVITATIONS:VIEW.',
  })
  expectedAttendees?: number;
}

class GuestTotalsDto {
  @ApiProperty({ example: 86, description: 'Including guests not assigned to any event.' })
  guests!: number;
}

class RsvpBreakdownDto {
  @ApiProperty({ example: 58 })
  pending!: number;

  @ApiProperty({ example: 96 })
  attending!: number;

  @ApiProperty({ example: 21 })
  declined!: number;

  @ApiProperty({ example: 9 })
  maybe!: number;
}

class TaskCountsDto {
  @ApiProperty({ example: 7, description: 'TODO and IN_PROGRESS.' })
  pending!: number;

  @ApiProperty({ example: 1 })
  blocked!: number;

  @ApiProperty({ example: 4 })
  completed!: number;

  @ApiProperty({
    example: 2,
    description: 'Overlaps pending and blocked; CANCELLED is in no count.',
  })
  overdue!: number;
}

class DashboardTaskDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Book mehendi artist' })
  title!: string;

  @ApiProperty({ enum: TASK_STATUSES })
  status!: string;

  @ApiProperty({ enum: TASK_PRIORITIES })
  priority!: string;

  @ApiProperty({ format: 'date', example: '2027-02-05' })
  dueDate!: string;

  @ApiProperty()
  isOverdue!: boolean;

  @ApiProperty()
  isDueToday!: boolean;
}

/** GET /weddings/{weddingId}/dashboard (API Design §6, decisions 0022 and 0026). */
export class DashboardDto {
  @ApiProperty({
    type: [DashboardEventDto],
    required: false,
    description:
      'At most five events dated today or later (wedding timezone), by date then start time, ' +
      'untimed first. A dashboard limit only. Only with EVENTS:VIEW.',
  })
  upcomingEvents?: DashboardEventDto[];

  @ApiProperty({ type: GuestTotalsDto, required: false, description: 'Only with GUESTS:VIEW.' })
  guestTotals?: GuestTotalsDto;

  @ApiProperty({
    type: RsvpBreakdownDto,
    required: false,
    description:
      'Counted assignments per status across all counted events, past and future. Only with ' +
      'INVITATIONS:VIEW.',
  })
  rsvpBreakdown?: RsvpBreakdownDto;

  @ApiProperty({
    type: TaskCountsDto,
    required: false,
    description: 'Over tasks that are not deleted (0026 #20). Only with TASKS:VIEW.',
  })
  taskCounts?: TaskCountsDto;

  @ApiProperty({
    required: false,
    description:
      'Whether the wedding has any task that is not deleted, Cancelled included, so a wedding ' +
      'whose tasks are all cancelled is told apart from one with none (0026 #20). Only with ' +
      'TASKS:VIEW.',
  })
  hasTasks?: boolean;

  @ApiProperty({
    type: [DashboardTaskDto],
    required: false,
    description:
      'Open tasks due up to seven days after today, every overdue task included; by due date ' +
      '(overdue first), then priority. At most five; never undated tasks. Only with TASKS:VIEW.',
  })
  upcomingTasks?: DashboardTaskDto[];

  @ApiProperty({
    type: ExpenseSummaryDto,
    required: false,
    description:
      'Over expenses that are not deleted: Total, Paid, Pending; by category and by event, ' +
      'largest first (0028 #23). Only with EXPENSES:VIEW.',
  })
  expenseSummary?: ExpenseSummaryDto;

  @ApiProperty({ type: VendorSummaryDto, required: false, description: 'Only with VENDORS:VIEW.' })
  vendorSummary?: VendorSummaryDto;

  /** Copies only the sections the dashboard computed (API Design §6, P10-8). */
  static from(dashboard: Dashboard): DashboardDto {
    const { upcomingEvents, guests, rsvpBreakdown, tasks, expenses, vendorSummary } = dashboard;
    return {
      ...(upcomingEvents && {
        upcomingEvents: upcomingEvents.map(({ event, expectedAttendees }) => ({
          id: event.id,
          name: event.name,
          type: event.type,
          date: event.date,
          startTime: event.startTime,
          endTime: event.endTime,
          venueName: event.venue.name,
          ...(expectedAttendees !== undefined && { expectedAttendees }),
        })),
      }),
      ...(guests !== undefined && { guestTotals: { guests } }),
      ...(rsvpBreakdown && {
        rsvpBreakdown: {
          pending: rsvpBreakdown.PENDING,
          attending: rsvpBreakdown.ATTENDING,
          declined: rsvpBreakdown.DECLINED,
          maybe: rsvpBreakdown.MAYBE,
        },
      }),
      ...(tasks && {
        taskCounts: { ...tasks.counts },
        hasTasks: tasks.hasTasks,
        upcomingTasks: tasks.upcoming.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate as string,
          isOverdue: isOverdue(task.dueDate, task.status, tasks.today),
          isDueToday: isDueToday(task.dueDate, task.status, tasks.today),
        })),
      }),
      ...(expenses && { expenseSummary: ExpenseSummaryDto.from(expenses) }),
      ...(vendorSummary && { vendorSummary }),
    };
  }
}
