import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import type { MemberInvitationStatus } from '../domain/types/member-invitation.js';

/** Organizer invitation and ownership-transfer errors (API Design §7.1, §21). */
export const InvitationsErrors = {
  /** Unknown, malformed or another wedding's — never told apart. */
  notFound: () =>
    new AppException({
      code: 'MEMBER_INVITATION_NOT_FOUND',
      message: 'This invitation was not found.',
      status: HttpStatus.NOT_FOUND,
    }),
  alreadyActive: () =>
    new AppException({
      code: 'MEMBER_ALREADY_ACTIVE',
      message: 'This person is already a member of the wedding.',
      status: HttpStatus.CONFLICT,
    }),
  alreadyPending: () =>
    new AppException({
      code: 'MEMBER_INVITATION_ALREADY_PENDING',
      message: 'An invitation to this email is already pending.',
      status: HttpStatus.CONFLICT,
    }),
  notPending: (status: MemberInvitationStatus) =>
    new AppException({
      code: 'MEMBER_INVITATION_NOT_PENDING',
      message: 'This invitation is no longer pending.',
      status: HttpStatus.CONFLICT,
      details: { status },
    }),
  expired: () =>
    new AppException({
      code: 'MEMBER_INVITATION_EXPIRED',
      message: 'This invitation has expired.',
      status: HttpStatus.CONFLICT,
    }),
  emailMismatch: () =>
    new AppException({
      code: 'MEMBER_INVITATION_EMAIL_MISMATCH',
      message: 'This invitation is for another email address.',
      status: HttpStatus.FORBIDDEN,
    }),
  /** 0034 R1, R2 and the token-route limits (API Design §28). */
  rateLimited: (retryAfterSeconds?: number) =>
    new AppException({
      code: ErrorCode.RateLimited,
      message: 'Too many attempts. Please try again later.',
      status: HttpStatus.TOO_MANY_REQUESTS,
      ...(retryAfterSeconds !== undefined && { details: { retryAfterSeconds } }),
    }),

  transferNotFound: () =>
    new AppException({
      code: 'OWNERSHIP_TRANSFER_NOT_FOUND',
      message: 'This ownership offer was not found.',
      status: HttpStatus.NOT_FOUND,
    }),
  transferAlreadyPending: () =>
    new AppException({
      code: 'OWNERSHIP_TRANSFER_ALREADY_PENDING',
      message: 'There is already a pending ownership offer.',
      status: HttpStatus.CONFLICT,
    }),
  transferNotPending: () =>
    new AppException({
      code: 'OWNERSHIP_TRANSFER_NOT_PENDING',
      message: 'This offer is no longer available.',
      status: HttpStatus.CONFLICT,
    }),
  weddingAlreadyOwned: () =>
    new AppException({
      code: 'WEDDING_ALREADY_OWNED',
      message: 'This person already owns another wedding.',
      status: HttpStatus.CONFLICT,
    }),
};
