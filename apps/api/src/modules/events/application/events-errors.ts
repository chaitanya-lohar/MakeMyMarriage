import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception.js';
import { ValidationFailedException } from '../../../common/errors/validation-failed.exception.js';

/** Event error responses (API Design §8). */
export const EventsErrors = {
  /** Missing, deleted or in another wedding — never told apart. */
  notFound: () =>
    new AppException({
      code: 'EVENT_NOT_FOUND',
      message: 'The requested event was not found.',
      status: HttpStatus.NOT_FOUND,
    }),

  invalidTimes: (message: string) => new ValidationFailedException({ endTime: [message] }),
};
