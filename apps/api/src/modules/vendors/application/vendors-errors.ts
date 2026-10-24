import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception.js';
export const VendorsErrors = {
  notFound: () =>
    new AppException({
      code: 'VENDOR_NOT_FOUND',
      message: 'The requested vendor was not found.',
      status: HttpStatus.NOT_FOUND,
    }),
  bookingNotFound: () =>
    new AppException({
      code: 'VENDOR_BOOKING_NOT_FOUND',
      message: 'The requested booking was not found.',
      status: HttpStatus.NOT_FOUND,
    }),
  activeBookings: (activeBookings: unknown[]) =>
    new AppException({
      code: 'VENDOR_HAS_ACTIVE_BOOKINGS',
      message: 'Cancel the vendor’s active bookings before deleting this vendor.',
      status: HttpStatus.CONFLICT,
      details: { activeBookings },
    }),
};
