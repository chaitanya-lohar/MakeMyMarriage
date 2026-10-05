import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  ValidateBy,
  ValidateIf,
  type ValidationOptions,
} from 'class-validator';
import { isCalendarDate, WeddingLimits } from '../../domain/rules/wedding-rules.js';
import type { Wedding } from '../../domain/types/wedding.js';

// Field messages match the approved form copy (decision 0016).
const Messages = {
  bride: "Enter the bride's name.",
  groom: "Enter the groom's name.",
  name: 'Use 100 characters or fewer.',
  place: 'Use 120 characters or fewer.',
  description: 'Use 1,000 characters or fewer.',
  date: 'Enter a valid date.',
} as const;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Optional text: trimmed, and an empty value means "not set". */
const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * A required name: one check, so a missing name reports only "Enter the … name." and a long
 * one only "Use 100 characters or fewer." (decision 0016).
 */
function IsCoupleName(requiredMessage: string): PropertyDecorator {
  return ValidateBy({
    name: 'isCoupleName',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= WeddingLimits.nameMaxLength,
      defaultMessage: (args) =>
        typeof args?.value === 'string' && args.value.length > WeddingLimits.nameMaxLength
          ? Messages.name
          : requiredMessage,
    },
  });
}

function IsCalendarDate(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isCalendarDate',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isCalendarDate(value),
        defaultMessage: () => Messages.date,
      },
    },
    options,
  );
}

const dateDoc = {
  type: String,
  format: 'date',
  nullable: true,
  example: '2027-02-18',
  description: 'Calendar date (YYYY-MM-DD) in the wedding timezone. Past dates are allowed.',
};

/** POST /weddings (decision 0016). */
export class CreateWeddingDto {
  @ApiProperty({ example: 'Meera Sharma', maxLength: WeddingLimits.nameMaxLength })
  @Transform(trim)
  @IsCoupleName(Messages.bride)
  brideName!: string;

  @ApiProperty({ example: 'Arjun Patel', maxLength: WeddingLimits.nameMaxLength })
  @Transform(trim)
  @IsCoupleName(Messages.groom)
  groomName!: string;

  @ApiPropertyOptional(dateDoc)
  @Transform(trimToNull)
  @IsOptional()
  @IsCalendarDate()
  startDate?: string | null;

  @ApiPropertyOptional({
    example: 'Lakeside Garden',
    maxLength: WeddingLimits.venueNameMaxLength,
    nullable: true,
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(WeddingLimits.venueNameMaxLength, { message: Messages.place })
  venueName?: string | null;

  @ApiPropertyOptional({
    example: 'Jaipur',
    maxLength: WeddingLimits.primaryCityMaxLength,
    nullable: true,
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(WeddingLimits.primaryCityMaxLength, { message: Messages.place })
  primaryCity?: string | null;

  @ApiPropertyOptional({
    example: "Two families, one celebration. We can't wait to share it with you.",
    maxLength: WeddingLimits.descriptionMaxLength,
    nullable: true,
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(WeddingLimits.descriptionMaxLength, { message: Messages.description })
  description?: string | null;
}

/** PATCH /weddings/{id}: send only the fields that change; null clears an optional field. */
export class UpdateWeddingDto {
  @ApiPropertyOptional({ example: 'Meera Sharma', maxLength: WeddingLimits.nameMaxLength })
  @Transform(trim)
  @ValidateIf((dto: UpdateWeddingDto) => dto.brideName !== undefined)
  @IsCoupleName(Messages.bride)
  brideName?: string;

  @ApiPropertyOptional({ example: 'Arjun Patel', maxLength: WeddingLimits.nameMaxLength })
  @Transform(trim)
  @ValidateIf((dto: UpdateWeddingDto) => dto.groomName !== undefined)
  @IsCoupleName(Messages.groom)
  groomName?: string;

  @ApiPropertyOptional(dateDoc)
  @Transform(trimToNull)
  @IsOptional()
  @IsCalendarDate()
  startDate?: string | null;

  @ApiPropertyOptional({ maxLength: WeddingLimits.venueNameMaxLength, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(WeddingLimits.venueNameMaxLength, { message: Messages.place })
  venueName?: string | null;

  @ApiPropertyOptional({ maxLength: WeddingLimits.primaryCityMaxLength, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(WeddingLimits.primaryCityMaxLength, { message: Messages.place })
  primaryCity?: string | null;

  @ApiPropertyOptional({ maxLength: WeddingLimits.descriptionMaxLength, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(WeddingLimits.descriptionMaxLength, { message: Messages.description })
  description?: string | null;
}

/** A wedding as returned by the API. */
export class WeddingDto {
  @ApiProperty({ example: '6650f0c2a1b2c3d4e5f60718' })
  id!: string;

  @ApiProperty({
    example: 'Meera Sharma & Arjun Patel',
    description: 'Always "{brideName} & {groomName}"; generated, never set directly.',
  })
  displayName!: string;

  @ApiProperty({ example: 'Meera Sharma' })
  brideName!: string;

  @ApiProperty({ example: 'Arjun Patel' })
  groomName!: string;

  @ApiProperty({ ...dateDoc, type: String })
  startDate!: string | null;

  @ApiProperty({ type: String, example: 'Lakeside Garden', nullable: true })
  venueName!: string | null;

  @ApiProperty({ type: String, example: 'Jaipur', nullable: true })
  primaryCity!: string | null;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ example: 'Asia/Kolkata' })
  timezone!: string;

  static from(wedding: Wedding): WeddingDto {
    return { ...wedding };
  }
}
