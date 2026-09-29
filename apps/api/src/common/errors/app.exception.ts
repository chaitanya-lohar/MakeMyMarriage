import { HttpException, HttpStatus } from '@nestjs/common';

export interface AppExceptionOptions {
  /** Stable, machine-readable code, e.g. GUEST_EVENT_NOT_FOUND. */
  code: string;
  /** Client-safe message. Must not contain internal details. */
  message: string;
  status: HttpStatus;
  details?: Record<string, unknown>;
}

/**
 * The single exception type application code should throw for expected failures.
 * It is rendered into the standard error contract by AllExceptionsFilter.
 */
export class AppException extends HttpException {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(options: AppExceptionOptions) {
    super(options.message, options.status);
    this.code = options.code;
    this.details = options.details ?? {};
  }
}
