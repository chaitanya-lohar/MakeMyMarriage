import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { trim, trimToNull } from '../../../../common/http/dto-transforms.js';
import { IsRequiredText, Matches } from '../../../../common/http/dto-validators.js';
import {
  GuestLimits,
  GuestMessages,
  isValidMobile,
  normalizeMobile,
} from '../../domain/rules/guest-rules.js';
import { RSVP_STATUSES, type RsvpStatus } from '../../domain/rules/rsvp-rules.js';
import type { GuestInvitationSummary } from '../../application/ports/guest-invitations.port.js';
import type { DuplicateMobileGuest, Guest, GuestSaveResult } from '../../domain/types/guest.js';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

/** Optional email: trimmed and lower-cased; empty means "not set". */
const emailToNull = ({ value }: { value: unknown }): unknown => {
  const trimmed = trimToNull({ value });
  return typeof trimmed === 'string' ? trimmed.toLowerCase() : trimmed;
};

const mobileDoc = {
  example: '+91 98765-43210',
  description:
    '7–15 digits, optional leading "+", spaces and hyphens allowed. Stored and returned ' +
    'with the separators removed.',
};

class GuestOptionalFields {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: GuestLimits.emailMaxLength,
    example: 'raju.sharma@example.com',
  })
  @Transform(emailToNull)
  @IsOptional()
  @MaxLength(GuestLimits.emailMaxLength, {
    message: GuestMessages.tooLong(GuestLimits.emailMaxLength),
  })
  @IsEmail({}, { message: GuestMessages.email })
  email?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: GuestLimits.relationMaxLength,
    example: 'Cousin',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(GuestLimits.relationMaxLength, {
    message: GuestMessages.tooLong(GuestLimits.relationMaxLength),
  })
  relation?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: GuestLimits.notesMaxLength,
    description: 'Organizer-only; never in guest-facing responses.',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(GuestLimits.notesMaxLength, {
    message: GuestMessages.tooLong(GuestLimits.notesMaxLength),
  })
  notes?: string | null;
}

/** POST /weddings/{weddingId}/guests (API Design §9). */
export class CreateGuestDto extends GuestOptionalFields {
  @ApiProperty({ example: 'Raju Sharma', maxLength: GuestLimits.nameMaxLength })
  @Transform(trim)
  @IsRequiredText(GuestLimits.nameMaxLength, GuestMessages.name, GuestMessages.nameTooLong)
  name!: string;

  @ApiProperty(mobileDoc)
  @Transform(trim)
  @Matches(isValidMobile, GuestMessages.mobile)
  mobile!: string;
}

/** PATCH /weddings/{weddingId}/guests/{guestId}: send only the fields that change. */
export class UpdateGuestDto extends GuestOptionalFields {
  @ApiPropertyOptional({ example: 'Raju Sharma', maxLength: GuestLimits.nameMaxLength })
  @Transform(trim)
  @ValidateIf((dto: UpdateGuestDto) => dto.name !== undefined)
  @IsRequiredText(GuestLimits.nameMaxLength, GuestMessages.name, GuestMessages.nameTooLong)
  name?: string;

  @ApiPropertyOptional(mobileDoc)
  @Transform(trim)
  @ValidateIf((dto: UpdateGuestDto) => dto.mobile !== undefined)
  @Matches(isValidMobile, GuestMessages.mobile)
  mobile?: string;
}

/** GET /weddings/{weddingId}/guests query (API Design §9, §24). */
export class ListGuestsQueryDto {
  @ApiPropertyOptional({ description: 'Matches the name or the mobile number.' })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(GuestLimits.nameMaxLength)
  search?: string | null;

  @ApiPropertyOptional({ description: 'Guests assigned to this event.' })
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiPropertyOptional({
    enum: RSVP_STATUSES,
    description: 'Guests with an RSVP in this status (to the chosen event, or any event).',
  })
  @IsOptional()
  @IsIn(RSVP_STATUSES)
  rsvpStatus?: RsvpStatus;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({ description: '`meta.pagination.nextCursor` of the previous page.' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

/** The mobile as the server stores and compares it. */
export function normalizedMobile<T extends { mobile?: string }>(dto: T): T {
  return dto.mobile === undefined ? dto : { ...dto, mobile: normalizeMobile(dto.mobile) };
}

export class GuestInvitationSummaryDto {
  @ApiProperty({ enum: ['DRAFT', 'SENT', 'DELIVERED', 'FAILED'] })
  deliveryStatus!: string;

  @ApiProperty()
  isRevoked!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastSentAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  firstOpenedAt!: string | null;

  static from(summary: GuestInvitationSummary): GuestInvitationSummaryDto {
    return {
      deliveryStatus: summary.deliveryStatus,
      isRevoked: summary.isRevoked,
      lastSentAt: summary.lastSentAt?.toISOString() ?? null,
      firstOpenedAt: summary.firstOpenedAt?.toISOString() ?? null,
    };
  }
}

/** A guest as returned to organizers (API Design §9). */
export class GuestDto {
  @ApiProperty({ example: '6650f0c2a1b2c3d4e5f6071a' })
  id!: string;

  @ApiProperty({ example: 'Raju Sharma' })
  name!: string;

  @ApiProperty({ example: '+919876543210', description: 'Normalized.' })
  mobile!: string;

  @ApiProperty({ type: String, nullable: true, example: 'raju.sharma@example.com' })
  email!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Cousin' })
  relation!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Organizer-only.' })
  notes!: string | null;

  @ApiProperty({
    type: GuestInvitationSummaryDto,
    nullable: true,
    description: 'null until the invitation is created.',
  })
  invitation!: GuestInvitationSummaryDto | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  static from(guest: Guest, invitation: GuestInvitationSummaryDto | null = null): GuestDto {
    return {
      id: guest.id,
      name: guest.name,
      mobile: guest.mobile,
      email: guest.email,
      relation: guest.relation,
      notes: guest.notes,
      invitation,
      createdAt: guest.createdAt.toISOString(),
      updatedAt: guest.updatedAt.toISOString(),
    };
  }
}

export class DuplicateMobileGuestDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Sunita Sharma' })
  name!: string;

  static from(guest: DuplicateMobileGuest): DuplicateMobileGuestDto {
    return { id: guest.id, name: guest.name };
  }
}

/** Create and update response: the guest plus the duplicate-mobile warning. */
export class GuestSaveResultDto {
  @ApiProperty({ type: GuestDto })
  guest!: GuestDto;

  @ApiProperty({
    type: [DuplicateMobileGuestDto],
    description: 'Other active guests with the same normalized mobile. A warning only.',
  })
  duplicateMobileGuests!: DuplicateMobileGuestDto[];

  static from(result: GuestSaveResult, guest: GuestDto): GuestSaveResultDto {
    return {
      guest,
      duplicateMobileGuests: result.duplicateMobileGuests.map((guest) =>
        DuplicateMobileGuestDto.from(guest),
      ),
    };
  }
}
