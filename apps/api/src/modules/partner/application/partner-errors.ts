import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { ValidationFailedException } from '../../../common/errors/validation-failed.exception.js';
import type { PartnerConnectionStatus } from '../domain/types/partner-connection.js';

/** Partner connection errors (API Design §7.2, §21; decision 0038). */
export const PartnerErrors = {
  /** Unknown, malformed or another wedding's — never told apart. */
  notFound: () =>
    new AppException({
      code: 'PARTNER_INVITATION_NOT_FOUND',
      message: 'This invitation was not found.',
      status: HttpStatus.NOT_FOUND,
    }),
  alreadyConnected: () =>
    new AppException({
      code: 'PARTNER_ALREADY_CONNECTED',
      message: 'This wedding already has two owners.',
      status: HttpStatus.CONFLICT,
    }),
  alreadyPending: () =>
    new AppException({
      code: 'PARTNER_INVITATION_ALREADY_PENDING',
      message: 'A partner invitation is already pending.',
      status: HttpStatus.CONFLICT,
    }),
  notPending: (status: PartnerConnectionStatus) =>
    new AppException({
      code: 'PARTNER_INVITATION_NOT_PENDING',
      message: 'This invitation is no longer pending.',
      status: HttpStatus.CONFLICT,
      details: { status },
    }),
  expired: () =>
    new AppException({
      code: 'PARTNER_INVITATION_EXPIRED',
      message: 'This invitation has expired.',
      status: HttpStatus.CONFLICT,
    }),
  emailMismatch: () =>
    new AppException({
      code: 'PARTNER_INVITATION_EMAIL_MISMATCH',
      message: 'This invitation is for another email address.',
      status: HttpStatus.FORBIDDEN,
    }),
  /** D6: the invitee transfers their own wedding's ownership first. */
  inviteeOwnsWedding: () =>
    new AppException({
      code: 'PARTNER_INVITEE_OWNS_WEDDING',
      message: 'You already own a wedding. Transfer its ownership before accepting.',
      status: HttpStatus.CONFLICT,
    }),
  seatUnavailable: () =>
    new AppException({
      code: 'PARTNER_SEAT_UNAVAILABLE',
      message: 'This wedding already has two owners.',
      status: HttpStatus.CONFLICT,
    }),
  /** Leaving needs a second owner to remain. */
  notConnected: () =>
    new AppException({
      code: 'PARTNER_NOT_CONNECTED',
      message: 'You are the only owner of this wedding.',
      status: HttpStatus.CONFLICT,
    }),
  ownEmail: () => new ValidationFailedException({ email: ["You can't invite your own email."] }),
  rateLimited: (retryAfterSeconds?: number) =>
    new AppException({
      code: ErrorCode.RateLimited,
      message: 'Too many attempts. Please try again later.',
      status: HttpStatus.TOO_MANY_REQUESTS,
      ...(retryAfterSeconds !== undefined && { details: { retryAfterSeconds } }),
    }),
};
