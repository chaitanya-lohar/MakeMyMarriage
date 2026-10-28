import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type RequestAuth } from '../../../../common/auth/request-auth.js';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
  ApiPaginatedResponse,
} from '../../../../common/http/api-envelope.decorator.js';
import { Paginated } from '../../../../common/http/paginated.js';
import {
  PermissionAction,
  PermissionModule,
  RequirePermission,
  WeddingAccessGuard,
} from '../../../workspace/index.js';
import { VendorsService } from '../../application/services/vendors.service.js';
import {
  BookingDetailsDto,
  BookingDto,
  UpdateBookingDto,
  UpdateVendorDto,
  VendorDetailsDto,
  VendorDto,
  VendorListMetaDto,
  VendorListQueryDto,
  VendorViewDto,
} from '../dto/vendor.dto.js';
import type { VendorDetails, BookingDetails } from '../../domain/types/vendor.js';

@ApiTags('Vendors')
@ApiCookieAuth('session')
@UseGuards(WeddingAccessGuard)
@Controller('weddings/:weddingId/vendors')
export class VendorsController {
  constructor(private readonly vendors: VendorsService) {}
  @Get()
  @RequirePermission(PermissionModule.Vendors, PermissionAction.View)
  @ApiOperation({ summary: 'List vendors in name order' })
  @ApiPaginatedResponse(VendorViewDto, VendorListMetaDto)
  async list(@Param('weddingId') w: string, @Query() q: VendorListQueryDto) {
    const result = await this.vendors.list(w, q);
    return new Paginated(
      result.items.map((vendor) => VendorViewDto.fromView(vendor)),
      result.nextCursor,
    );
  }
  @Post()
  @RequirePermission(PermissionModule.Vendors, PermissionAction.Create)
  @ApiEnvelopeResponse(201, VendorDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED' },
    { status: 404, description: 'WEDDING_NOT_FOUND' },
  )
  async create(
    @Param('weddingId') w: string,
    @CurrentAuth() a: RequestAuth,
    @Body() b: VendorDetailsDto,
  ) {
    return VendorDto.from(await this.vendors.create(w, a.userId, this.details(b) as VendorDetails));
  }
  @Get(':vendorId')
  @RequirePermission(PermissionModule.Vendors, PermissionAction.View)
  @ApiEnvelopeResponse(200, VendorViewDto)
  async get(@Param('weddingId') w: string, @Param('vendorId') id: string) {
    return VendorViewDto.fromView(await this.vendors.get(w, id));
  }
  @Patch(':vendorId')
  @RequirePermission(PermissionModule.Vendors, PermissionAction.Edit)
  @ApiEnvelopeResponse(200, VendorDto)
  async update(
    @Param('weddingId') w: string,
    @Param('vendorId') id: string,
    @CurrentAuth() a: RequestAuth,
    @Body() b: UpdateVendorDto,
  ) {
    return VendorDto.from(await this.vendors.update(w, id, a.userId, this.details(b)));
  }
  @Delete(':vendorId')
  @RequirePermission(PermissionModule.Vendors, PermissionAction.Delete)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiEnvelopeResponse(204)
  async delete(
    @Param('weddingId') w: string,
    @Param('vendorId') id: string,
    @CurrentAuth() a: RequestAuth,
  ) {
    await this.vendors.delete(w, id, a.userId);
  }
  @Get(':vendorId/bookings')
  @RequirePermission(PermissionModule.Vendors, PermissionAction.View)
  @ApiEnvelopeResponse(200, [BookingDto])
  async bookings(@Param('weddingId') w: string, @Param('vendorId') id: string) {
    return (await this.vendors.bookings(w, id)).map((booking) => BookingDto.from(booking));
  }
  @Post(':vendorId/bookings')
  @RequirePermission(PermissionModule.Vendors, PermissionAction.Create)
  @ApiEnvelopeResponse(201, BookingDto)
  async createBooking(
    @Param('weddingId') w: string,
    @Param('vendorId') id: string,
    @CurrentAuth() a: RequestAuth,
    @Body() b: BookingDetailsDto,
  ) {
    return BookingDto.from(
      await this.vendors.createBooking(w, id, a.userId, this.booking(b, true) as BookingDetails),
    );
  }
  @Get(':vendorId/bookings/:bookingId')
  @RequirePermission(PermissionModule.Vendors, PermissionAction.View)
  @ApiEnvelopeResponse(200, BookingDto)
  async getBooking(
    @Param('weddingId') w: string,
    @Param('vendorId') id: string,
    @Param('bookingId') bid: string,
  ) {
    return BookingDto.from(await this.vendors.booking(w, id, bid));
  }
  @Patch(':vendorId/bookings/:bookingId')
  @RequirePermission(PermissionModule.Vendors, PermissionAction.Edit)
  @ApiEnvelopeResponse(200, BookingDto)
  async updateBooking(
    @Param('weddingId') w: string,
    @Param('vendorId') id: string,
    @Param('bookingId') bid: string,
    @CurrentAuth() a: RequestAuth,
    @Body() b: UpdateBookingDto,
  ) {
    return BookingDto.from(
      await this.vendors.updateBooking(w, id, bid, a.userId, this.booking(b, false)),
    );
  }
  private details(b: Partial<VendorDetailsDto>): Partial<VendorDetails> {
    const d: Partial<VendorDetails> = {};
    for (const key of [
      'name',
      'category',
      'contactPerson',
      'phone',
      'email',
      'address',
      'website',
      'notes',
    ] as const)
      if (b[key] !== undefined)
        Object.assign(d, {
          [key]: key === 'email' && b[key] ? String(b[key]).toLowerCase() : b[key],
        });
    return d;
  }
  private booking(b: Partial<BookingDetailsDto>, create: boolean): Partial<BookingDetails> {
    const d: Partial<BookingDetails> = {};
    for (const key of [
      'title',
      'status',
      'bookingDate',
      'serviceDate',
      'eventId',
      'agreedPriceMinor',
      'notes',
    ] as const)
      if (b[key] !== undefined) Object.assign(d, { [key]: b[key] });
    if (create && d.status === undefined) d.status = 'NOT_CONTACTED';
    return d;
  }
}
