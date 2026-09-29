import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { requestIdOf } from '../http/request-id.js';
import { AppException } from './app.exception.js';
import { defaultMessageFor, ErrorCode, errorCodeForStatus } from './error-codes.js';
import { ValidationFailedException } from './validation-failed.exception.js';

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
    requestId: string;
  };
}

/**
 * Renders every error into the standard contract (API Design §21). Stack traces,
 * database errors and provider errors are logged server-side and never returned.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const { status, code, message, details } = this.describe(exception);

    if (status >= 500) {
      this.logger.error({ err: exception, status, code }, 'Unhandled error while processing request');
    }

    const body: ErrorBody = {
      error: { code, message, details, requestId: requestIdOf(request) },
    };
    response.status(status).json(body);
  }

  private describe(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details: Record<string, unknown>;
  } {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof ValidationFailedException) {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: ErrorCode.ValidationFailed,
        message: defaultMessageFor(ErrorCode.ValidationFailed),
        details: { fields: exception.fields },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = errorCodeForStatus(status);
      return { status, code, message: defaultMessageFor(code), details: {} };
    }

    // Errors raised by Express middleware before Nest routing (e.g. malformed JSON
    // body, oversized payload) carry an HTTP status of their own.
    const middlewareStatus = middlewareErrorStatus(exception);
    if (middlewareStatus !== undefined) {
      const code = errorCodeForStatus(middlewareStatus);
      return { status: middlewareStatus, code, message: defaultMessageFor(code), details: {} };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.InternalError,
      message: defaultMessageFor(ErrorCode.InternalError),
      details: {},
    };
  }
}

function middlewareErrorStatus(exception: unknown): number | undefined {
  if (typeof exception !== 'object' || exception === null) return undefined;
  const status = (exception as { status?: unknown }).status;
  if (typeof status === 'number' && status >= 400 && status < 500) return status;
  return undefined;
}
