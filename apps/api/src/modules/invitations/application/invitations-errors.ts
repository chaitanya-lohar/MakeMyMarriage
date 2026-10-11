import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { ValidationFailedException } from '../../../common/errors/validation-failed.exception.js';

/** Invitation error responses (API Design §10). */
export const InvitationsErrors = {
  /**
   * Before the invitation exists; and, on guest routes, for every unknown, revoked or
   * regenerated token and every deleted guest's token — never told apart.
   */
  notFound: () =>
    new AppException({
      code: 'INVITATION_NOT_FOUND',
      message: 'This invitation link isn’t working.',
      status: HttpStatus.NOT_FOUND,
    }),

  alreadyExists: () =>
    new AppException({
      code: 'INVITATION_ALREADY_EXISTS',
      message: 'This guest already has an invitation.',
      status: HttpStatus.CONFLICT,
    }),

  revoked: () =>
    new AppException({
      code: 'INVITATION_REVOKED',
      message: 'This invitation link has been revoked. Create a new link first.',
      status: HttpStatus.CONFLICT,
    }),

  emailRequired: () =>
    new AppException({
      code: 'GUEST_EMAIL_REQUIRED',
      message: 'Add an email address for this guest to send the invitation by email.',
      status: HttpStatus.UNPROCESSABLE_ENTITY,
    }),

  rateLimited: () =>
    new AppException({
      code: ErrorCode.RateLimited,
      message: 'Too many attempts. Please wait a few minutes and try again.',
      status: HttpStatus.TOO_MANY_REQUESTS,
    }),

  /** A guest RSVP names an assignment that is not one of theirs (DRAFT wording). */
  notOnInvitation: () =>
    new ValidationFailedException({
      responses: ['One of these events is no longer on your invitation. Please reload the page.'],
    }),

  invalidIdempotencyKey: () =>
    new ValidationFailedException({
      'Idempotency-Key': ['Use 1–200 visible characters.'],
    }),
};
