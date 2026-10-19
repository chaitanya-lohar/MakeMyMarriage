import { ApiProperty } from '@nestjs/swagger';
import { EVENT_TYPES } from '../../../events/index.js';
import { isDueToday, isOverdue, TASK_PRIORITIES, TASK_STATUSES } from '../../../tasks/index.js';
import type { Dashboard } from '../../application/use-cases/get-dashboard.use-case.js';

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
    example: 38,
    description: 'Sum of attendeeCount over counted ATTENDING assignments for this event.',
  })
  expectedAttendees!: number;
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
    description:
      'At most five events dated today or later (wedding timezone), by date then start time, ' +
      'untimed first. A dashboard limit only.',
  })
  upcomingEvents!: DashboardEventDto[];

  @ApiProperty({ type: GuestTotalsDto })
  guestTotals!: GuestTotalsDto;

  @ApiProperty({
    type: RsvpBreakdownDto,
    description: 'Counted assignments per status across all counted events, past and future.',
  })
  rsvpBreakdown!: RsvpBreakdownDto;

  @ApiProperty({ type: TaskCountsDto, description: 'Over tasks that are not deleted (0026 #20).' })
  taskCounts!: TaskCountsDto;

  @ApiProperty({
    type: [DashboardTaskDto],
    description:
      'Open tasks due up to seven days after today, every overdue task included; by due date ' +
      '(overdue first), then priority. At most five; never undated tasks.',
  })
  upcomingTasks!: DashboardTaskDto[];

  static from(dashboard: Dashboard): DashboardDto {
    const { PENDING, ATTENDING, DECLINED, MAYBE } = dashboard.rsvpBreakdown;
    return {
      upcomingEvents: dashboard.upcomingEvents.map(({ event, expectedAttendees }) => ({
        id: event.id,
        name: event.name,
        type: event.type,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        venueName: event.venue.name,
        expectedAttendees,
      })),
      guestTotals: { guests: dashboard.guests },
      rsvpBreakdown: { pending: PENDING, attending: ATTENDING, declined: DECLINED, maybe: MAYBE },
      taskCounts: { ...dashboard.tasks.counts },
      upcomingTasks: dashboard.tasks.upcoming.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate as string,
        isOverdue: isOverdue(task.dueDate, task.status, dashboard.tasks.today),
        isDueToday: isDueToday(task.dueDate, task.status, dashboard.tasks.today),
      })),
    };
  }
}
