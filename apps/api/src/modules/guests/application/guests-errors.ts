import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception.js';
import { ValidationFailedException } from '../../../common/errors/validation-failed.exception.js';

/** Guest and assignment error responses (API Design §9). IDs from another wedding are 404. */
export const GuestsErrors = {
  notFound: () =>
    new AppException({
      code: 'GUEST_NOT_FOUND',
      message: 'The requested guest was not found.',
      status: HttpStatus.NOT_FOUND,
    }),

  assignmentNotFound: () =>
    new AppException({
      code: 'GUEST_EVENT_NOT_FOUND',
      message: 'The requested guest-event relationship was not found.',
      status: HttpStatus.NOT_FOUND,
    }),

  invalidCursor: () => new ValidationFailedException({ cursor: ['The cursor is not valid.'] }),
};
