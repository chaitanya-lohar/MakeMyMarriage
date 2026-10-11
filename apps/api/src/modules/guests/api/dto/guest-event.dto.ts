import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, ValidateBy } from 'class-validator';
import {
  RSVP_STATUSES,
  RsvpMessages,
  rsvpCountError,
  type RsvpStatus,
} from '../../domain/rules/rsvp-rules.js';
import type { GuestEvent } from '../../domain/types/guest.js';

/**
 * `attendeeCount` must be sent on every RSVP write (null where there is none) and must match
 * the status (0017 #2–3). Exported for the guest RSVP request, which allows fewer statuses.
 */
export function IsAttendeeCountFor(statusProperty = 'rsvpStatus'): PropertyDecorator {
  return ValidateBy({
    name: 'isAttendeeCountFor',
    validator: {
      validate: (value: unknown, args) => {
        if (value === undefined) return false;
        const status = (args?.object as Record<string, unknown>)[statusProperty];
        // An invalid status is reported on its own field.
        if (!RSVP_STATUSES.includes(status as RsvpStatus)) return true;
        return rsvpCountError(status as RsvpStatus, value) === null;
      },
      defaultMessage: (args) => {
        if (args?.value === undefined) return RsvpMessages.countRequired;
        const status = (args?.object as Record<string, unknown>)[statusProperty] as RsvpStatus;
        return rsvpCountError(status, args?.value) ?? RsvpMessages.countRequired;
      },
    },
  });
}

/** POST /weddings/{weddingId}/guests/{guestId}/events */
export class AssignGuestDto {
  @ApiProperty({ example: '6650f0c2a1b2c3d4e5f60719' })
  @IsString()
  eventId!: string;
}

/** PATCH /weddings/{weddingId}/guest-events/{guestEventId} — organizer RSVP update. */
export class UpdateRsvpDto {
  @ApiProperty({ enum: RSVP_STATUSES, example: 'ATTENDING' })
  @IsIn(RSVP_STATUSES, { message: RsvpMessages.status })
  rsvpStatus!: RsvpStatus;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 4,
    description: 'PENDING/MAYBE: null; DECLINED: 0; ATTENDING: an integer ≥ 1. Always sent.',
  })
  @IsAttendeeCountFor()
  attendeeCount!: number | null;
}

/** A guest–event assignment and its RSVP (API Design §9). */
export class GuestEventDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  guestId!: string;

  @ApiProperty()
  eventId!: string;

  @ApiProperty({ enum: RSVP_STATUSES })
  rsvpStatus!: RsvpStatus;

  @ApiProperty({ type: Number, nullable: true })
  attendeeCount!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  respondedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  rsvpUpdatedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static from(assignment: GuestEvent): GuestEventDto {
    return {
      id: assignment.id,
      guestId: assignment.guestId,
      eventId: assignment.eventId,
      rsvpStatus: assignment.rsvpStatus,
      attendeeCount: assignment.attendeeCount,
      respondedAt: assignment.respondedAt?.toISOString() ?? null,
      rsvpUpdatedAt: assignment.rsvpUpdatedAt?.toISOString() ?? null,
      createdAt: assignment.createdAt.toISOString(),
    };
  }
}
