import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  ValidateIf,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { trim, trimToNull } from '../../../../common/http/dto-transforms.js';
import { Matches as MatchesPredicate } from '../../../../common/http/dto-validators.js';
import { PaginatedMetaDto } from '../../../../common/http/api-envelope.decorator.js';
import {
  VENDOR_CATEGORIES,
  BOOKING_STATUSES,
  VENDOR_LIMITS,
  type VendorCategory,
  type BookingStatus,
} from '../../domain/rules/vendor-rules.js';
import type { Booking, Vendor, VendorCounts, VendorView } from '../../domain/types/vendor.js';
import { isCalendarDate } from '../../../weddings/index.js';
export class VendorDetailsDto {
  @ApiProperty({ maxLength: 150 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;
  @ApiProperty({ enum: VENDOR_CATEGORIES }) @IsIn(VENDOR_CATEGORIES) category!: VendorCategory;
  @ApiPropertyOptional({ type: String, maxLength: 150, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  contactPerson?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @Matches(/^\+?(?=(?:[ -]*\d){7,15}[ -]*$)[0-9 -]+$/)
  phone?: string | null;
  @ApiPropertyOptional({ type: String, maxLength: 254, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;
  @ApiPropertyOptional({ type: String, maxLength: 500, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;
  @ApiPropertyOptional({ type: String, maxLength: 500, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  website?: string | null;
  @ApiPropertyOptional({ type: String, maxLength: 1000, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
export class UpdateVendorDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @ValidateIf((dto: UpdateVendorDto) => dto.name !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;
  @ApiPropertyOptional({ enum: VENDOR_CATEGORIES })
  @ValidateIf((dto: UpdateVendorDto) => dto.category !== undefined)
  @IsIn(VENDOR_CATEGORIES)
  category?: VendorCategory;
  @ApiPropertyOptional({ type: String, maxLength: 150, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  contactPerson?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @Matches(/^\+?(?=(?:[ -]*\d){7,15}[ -]*$)[0-9 -]+$/)
  phone?: string | null;
  @ApiPropertyOptional({ type: String, maxLength: 254, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;
  @ApiPropertyOptional({ type: String, maxLength: 500, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;
  @ApiPropertyOptional({ type: String, maxLength: 500, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  website?: string | null;
  @ApiPropertyOptional({ type: String, maxLength: 1000, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
export class BookingDetailsDto {
  @ApiProperty({ maxLength: 150 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title!: string;
  @ApiPropertyOptional({ enum: BOOKING_STATUSES, default: 'NOT_CONTACTED' })
  @ValidateIf((dto: BookingDetailsDto) => dto.status !== undefined)
  @IsIn(BOOKING_STATUSES)
  status?: BookingStatus;
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @MatchesPredicate(isCalendarDate, 'Enter a valid calendar date.')
  bookingDate?: string | null;
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @MatchesPredicate(isCalendarDate, 'Enter a valid calendar date.')
  serviceDate?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) @IsOptional() @IsString() eventId?:
    string | null;
  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: VENDOR_LIMITS.priceMinor,
    nullable: true,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(VENDOR_LIMITS.priceMinor)
  agreedPriceMinor?: number | null;
  @ApiPropertyOptional({ type: String, maxLength: 1000, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
export class UpdateBookingDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @ValidateIf((dto: UpdateBookingDto) => dto.title !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title?: string;
  @ApiPropertyOptional({ enum: BOOKING_STATUSES })
  @ValidateIf((dto: UpdateBookingDto) => dto.status !== undefined)
  @IsIn(BOOKING_STATUSES)
  status?: BookingStatus;
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @MatchesPredicate(isCalendarDate, 'Enter a valid calendar date.')
  bookingDate?: string | null;
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @MatchesPredicate(isCalendarDate, 'Enter a valid calendar date.')
  serviceDate?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  eventId?: string | null;
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: VENDOR_LIMITS.priceMinor, nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(VENDOR_LIMITS.priceMinor)
  agreedPriceMinor?: number | null;
  @ApiPropertyOptional({ type: String, maxLength: 1000, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
export class VendorListQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ enum: VENDOR_CATEGORIES })
  @IsOptional()
  @IsIn(VENDOR_CATEGORIES)
  category?: VendorCategory;
  @ApiPropertyOptional({ enum: BOOKING_STATUSES })
  @IsOptional()
  @IsIn(BOOKING_STATUSES)
  bookingStatus?: BookingStatus;
  @ApiPropertyOptional({ description: 'Event ID, or none for whole-wedding bookings' })
  @IsOptional()
  @IsString()
  eventId?: string;
  @ApiPropertyOptional({ type: Number, default: 25, minimum: 1, maximum: 25 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25)
  limit = 25;
  @ApiPropertyOptional() @IsOptional() @IsString() cursor?: string;
}
export class VendorCountsDto implements VendorCounts {
  @ApiProperty() booked!: number;
  @ApiProperty() inProgress!: number;
  @ApiProperty() cancelled!: number;
}
export class VendorListMetaDto extends PaginatedMetaDto {}
export class VendorDto implements Vendor {
  @ApiProperty() id!: string;
  @ApiProperty() weddingId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: VENDOR_CATEGORIES }) category!: VendorCategory;
  @ApiProperty({ type: String, nullable: true }) contactPerson!: string | null;
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
  @ApiProperty({ type: String, nullable: true }) address!: string | null;
  @ApiProperty({ type: String, nullable: true }) website!: string | null;
  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  static from(v: Vendor) {
    return v;
  }
}
export class VendorViewDto extends VendorDto {
  @ApiProperty({ type: VendorCountsDto }) bookingCounts!: VendorCountsDto;
  static fromView(x: VendorView) {
    return { ...x.vendor, bookingCounts: x.bookingCounts };
  }
}
export class BookingDto implements Booking {
  @ApiProperty() id!: string;
  @ApiProperty() weddingId!: string;
  @ApiProperty() vendorId!: string;
  @ApiProperty({ type: String }) vendorName!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: BOOKING_STATUSES }) status!: BookingStatus;
  @ApiProperty({ type: String, nullable: true }) bookingDate!: string | null;
  @ApiProperty({ type: String, nullable: true }) serviceDate!: string | null;
  @ApiProperty({ type: String, nullable: true }) eventId!: string | null;
  @ApiProperty({ type: String, nullable: true }) eventName!: string | null;
  @ApiProperty({ type: Number, nullable: true }) agreedPriceMinor!: number | null;
  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  static from(x: Booking) {
    return x;
  }
}
