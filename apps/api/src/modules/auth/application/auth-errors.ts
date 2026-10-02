import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';

/** Auth error responses, worded as approved in decision 0015. */
export const AuthErrors = {
  invalidCredentials: () =>
    new AppException({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid credentials. Please verify your email and try again.',
      status: HttpStatus.UNAUTHORIZED,
    }),

  emailAlreadyRegistered: () =>
    new AppException({
      code: 'EMAIL_ALREADY_REGISTERED',
      message: 'An account with this email already exists. Sign in or reset your password.',
      status: HttpStatus.CONFLICT,
    }),

  resetTokenInvalid: () =>
    new AppException({
      code: 'RESET_TOKEN_INVALID',
      message: 'This link has expired or has already been used.',
      status: HttpStatus.BAD_REQUEST,
    }),

  tooManyAttempts: () =>
    new AppException({
      code: ErrorCode.RateLimited,
      message: 'Too many attempts. Please wait a few minutes and try again.',
      status: HttpStatus.TOO_MANY_REQUESTS,
    }),

  unauthenticated: () =>
    new AppException({
      code: ErrorCode.Unauthenticated,
      message: 'Authentication is required.',
      status: HttpStatus.UNAUTHORIZED,
    }),
};
