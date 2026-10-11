import { ApiProperty } from '@nestjs/swagger';
import { EVENT_TYPES } from '../../../events/index.js';
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

/** GET /weddings/{weddingId}/dashboard (API Design §6, decision 0022). */
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
    };
  }
}
