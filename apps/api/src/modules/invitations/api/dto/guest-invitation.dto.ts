import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  ValidateBy,
  ValidateNested,
} from 'class-validator';
import { EVENT_TYPES } from '../../../events/index.js';
import {
  GUEST_RSVP_STATUSES,
  RSVP_STATUSES,
  RsvpMessages,
  rsvpCountError,
  type RsvpStatus,
} from '../../../guests/index.js';
import type { GuestInvitationView } from '../../application/use-cases/guest-invitation-access.use-case.js';

/** attendeeCount must be sent and match the status (0017 #2–3). */
function IsGuestAttendeeCount(): PropertyDecorator {
  return ValidateBy({
    name: 'isGuestAttendeeCount',
    validator: {
      validate: (value: unknown, args) => {
        if (value === undefined) return false;
        const status = (args?.object as GuestRsvpResponseDto).rsvpStatus;
        if (!GUEST_RSVP_STATUSES.includes(status)) return true;
        return rsvpCountError(status, value) === null;
      },
      defaultMessage: (args) =>
        args?.value === undefined
          ? RsvpMessages.countRequired
          : (rsvpCountError((args?.object as GuestRsvpResponseDto).rsvpStatus, args?.value) ??
            RsvpMessages.countRequired),
    },
  });
}

export class GuestRsvpResponseDto {
  @ApiProperty()
  @IsString()
  guestEventId!: string;

  @ApiProperty({
    enum: GUEST_RSVP_STATUSES,
    description: 'A guest can never send PENDING (0017 #4).',
  })
  @IsIn(GUEST_RSVP_STATUSES, { message: RsvpMessages.status })
  rsvpStatus!: RsvpStatus;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'MAYBE: null; DECLINED: 0; ATTENDING: an integer ≥ 1, including the guest.',
  })
  @IsGuestAttendeeCount()
  attendeeCount!: number | null;
}

/** PATCH /guest/invitations/{token}/rsvp — all responses apply, or none (API Design §10). */
export class GuestRsvpDto {
  @ApiProperty({ type: [GuestRsvpResponseDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((response: GuestRsvpResponseDto) => response.guestEventId, {
    message: 'Answer each event once.',
  })
  @ValidateNested({ each: true })
  @Type(() => GuestRsvpResponseDto)
  responses!: GuestRsvpResponseDto[];
}

class GuestViewNameDto {
  @ApiProperty({ example: 'Raju Sharma' })
  name!: string;
}

class GuestViewWeddingDto {
  @ApiProperty({ example: 'Meera Sharma & Arjun Patel' })
  displayName!: string;

  @ApiProperty({ type: String, format: 'date', nullable: true, example: '2027-02-18' })
  startDate!: string | null;

  @ApiProperty({ example: 'Asia/Kolkata' })
  timezone!: string;
}

class GuestViewVenueDto {
  @ApiProperty({ type: String, nullable: true })
  name!: string | null;

  @ApiProperty({ type: String, nullable: true })
  address!: string | null;
}

class GuestViewEventDto {
  @ApiProperty({ description: "The guest's own assignment, for the RSVP request." })
  guestEventId!: string;

  @ApiProperty({ example: 'Haldi' })
  name!: string;

  @ApiProperty({ enum: EVENT_TYPES })
  type!: string;

  @ApiProperty({ format: 'date', example: '2027-02-17' })
  date!: string;

  @ApiProperty({ type: String, nullable: true, example: '10:00' })
  startTime!: string | null;

  @ApiProperty({ type: String, nullable: true })
  endTime!: string | null;

  @ApiProperty({ type: GuestViewVenueDto })
  venue!: GuestViewVenueDto;

  @ApiProperty({ type: String, nullable: true })
  dressCode!: string | null;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ enum: RSVP_STATUSES })
  rsvpStatus!: string;

  @ApiProperty({ type: Number, nullable: true })
  attendeeCount!: number | null;
}

/**
 * The guest's view (API Design §10): their own active events only. Never organizer notes,
 * mobile, email, other guests, the wedding ID or event IDs.
 */
export class GuestInvitationViewDto {
  @ApiProperty({ type: GuestViewNameDto })
  guest!: GuestViewNameDto;

  @ApiProperty({ type: GuestViewWeddingDto })
  wedding!: GuestViewWeddingDto;

  @ApiProperty({ type: [GuestViewEventDto] })
  events!: GuestViewEventDto[];

  static from(view: GuestInvitationView): GuestInvitationViewDto {
    return {
      guest: { name: view.guestName },
      wedding: { ...view.wedding },
      events: view.events.map(({ guestEventId, rsvpStatus, attendeeCount, event }) => ({
        guestEventId,
        name: event.name,
        type: event.type,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        venue: { name: event.venue.name, address: event.venue.address },
        dressCode: event.dressCode,
        description: event.description,
        rsvpStatus,
        attendeeCount,
      })),
    };
  }
}
