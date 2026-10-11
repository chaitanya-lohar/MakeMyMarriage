import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { trim, trimToNull } from '../../../../common/http/dto-transforms.js';
import { IsRequiredText, Matches } from '../../../../common/http/dto-validators.js';
import { isCalendarDate } from '../../../weddings/index.js';
import {
  EVENT_TYPES,
  EventLimits,
  EventMessages,
  isLocalTime,
  type EventType,
} from '../../domain/rules/event-rules.js';
import type { WeddingEvent } from '../../domain/types/event.js';

const timeDoc = {
  type: String,
  nullable: true,
  pattern: '^([01]\\d|2[0-3]):[0-5]\\d$',
  description: 'HH:mm in the wedding timezone.',
};

/** Venue fields; in PATCH, each field present changes and null clears it. */
export class EventVenueInputDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: EventLimits.venueNameMaxLength,
    example: 'Garden Palace',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(EventLimits.venueNameMaxLength, {
    message: EventMessages.tooLong(EventLimits.venueNameMaxLength),
  })
  name?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: EventLimits.venueAddressMaxLength,
    example: 'Amer Road, Jaipur',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(EventLimits.venueAddressMaxLength, {
    message: EventMessages.tooLong(EventLimits.venueAddressMaxLength),
  })
  address?: string | null;
}

/** Optional fields shared by create and update. */
class EventOptionalFields {
  @ApiPropertyOptional({ ...timeDoc, example: '16:00' })
  @Transform(trimToNull)
  @IsOptional()
  @Matches(isLocalTime, EventMessages.time)
  startTime?: string | null;

  @ApiPropertyOptional({ ...timeDoc, example: '20:00' })
  @Transform(trimToNull)
  @IsOptional()
  @Matches(isLocalTime, EventMessages.time)
  endTime?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: EventLimits.descriptionMaxLength,
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(EventLimits.descriptionMaxLength, {
    message: EventMessages.tooLong(EventLimits.descriptionMaxLength),
  })
  description?: string | null;

  @ApiPropertyOptional({ type: EventVenueInputDto, nullable: true })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => EventVenueInputDto)
  venue?: EventVenueInputDto | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: EventLimits.dressCodeMaxLength,
    example: 'Pastels',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(EventLimits.dressCodeMaxLength, {
    message: EventMessages.tooLong(EventLimits.dressCodeMaxLength),
  })
  dressCode?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: EventLimits.notesMaxLength,
    description: 'Organizer-only; never shown to guests.',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(EventLimits.notesMaxLength, {
    message: EventMessages.tooLong(EventLimits.notesMaxLength),
  })
  notes?: string | null;
}

/** POST /weddings/{weddingId}/events (API Design §8). */
export class CreateEventDto extends EventOptionalFields {
  @ApiProperty({ example: 'Mehendi', maxLength: EventLimits.nameMaxLength })
  @Transform(trim)
  @IsRequiredText(EventLimits.nameMaxLength, EventMessages.name, EventMessages.nameTooLong)
  name!: string;

  @ApiProperty({ enum: EVENT_TYPES, example: 'MEHENDI' })
  @IsIn(EVENT_TYPES, { message: EventMessages.type })
  type!: EventType;

  @ApiProperty({
    format: 'date',
    example: '2027-02-16',
    description: 'YYYY-MM-DD in the wedding timezone. Past dates are allowed.',
  })
  @Transform(trim)
  @Matches(isCalendarDate, EventMessages.date)
  date!: string;
}

/** PATCH /weddings/{weddingId}/events/{eventId}: send only the fields that change. */
export class UpdateEventDto extends EventOptionalFields {
  @ApiPropertyOptional({ example: 'Mehendi', maxLength: EventLimits.nameMaxLength })
  @Transform(trim)
  @ValidateIf((dto: UpdateEventDto) => dto.name !== undefined)
  @IsRequiredText(EventLimits.nameMaxLength, EventMessages.name, EventMessages.nameTooLong)
  name?: string;

  @ApiPropertyOptional({ enum: EVENT_TYPES })
  @ValidateIf((dto: UpdateEventDto) => dto.type !== undefined)
  @IsIn(EVENT_TYPES, { message: EventMessages.type })
  type?: EventType;

  @ApiPropertyOptional({ format: 'date', example: '2027-02-16' })
  @Transform(trim)
  @ValidateIf((dto: UpdateEventDto) => dto.date !== undefined)
  @Matches(isCalendarDate, EventMessages.date)
  date?: string;
}

export class EventVenueDto {
  @ApiProperty({ type: String, nullable: true, example: 'Garden Palace' })
  name!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Amer Road, Jaipur' })
  address!: string | null;
}

/** An event as returned to organizers (API Design §8). */
export class EventDto {
  @ApiProperty({ example: '6650f0c2a1b2c3d4e5f60719' })
  id!: string;

  @ApiProperty({ example: 'Mehendi' })
  name!: string;

  @ApiProperty({ enum: EVENT_TYPES, example: 'MEHENDI' })
  type!: EventType;

  @ApiProperty({ format: 'date', example: '2027-02-16' })
  date!: string;

  @ApiProperty({ ...timeDoc, example: '16:00' })
  startTime!: string | null;

  @ApiProperty({ ...timeDoc, example: '20:00' })
  endTime!: string | null;

  @ApiProperty({ example: 'Asia/Kolkata' })
  timezone!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: EventVenueDto })
  venue!: EventVenueDto;

  @ApiProperty({ type: String, nullable: true, example: 'Pastels' })
  dressCode!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Organizer-only.' })
  notes!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  static from(event: WeddingEvent): EventDto {
    return {
      id: event.id,
      name: event.name,
      type: event.type,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      timezone: event.timezone,
      description: event.description,
      venue: { ...event.venue },
      dressCode: event.dressCode,
      notes: event.notes,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }
}
