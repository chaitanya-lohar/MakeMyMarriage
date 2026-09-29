/**
 * Generic, transport-level error codes. Domain modules add their own specific codes
 * (e.g. GUEST_EVENT_NOT_FOUND, API Design §21) by throwing AppException.
 */
export const ErrorCode = {
  BadRequest: 'BAD_REQUEST',
  ValidationFailed: 'VALIDATION_FAILED',
  Unauthenticated: 'UNAUTHENTICATED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  PayloadTooLarge: 'PAYLOAD_TOO_LARGE',
  UnprocessableEntity: 'UNPROCESSABLE_ENTITY',
  RateLimited: 'RATE_LIMITED',
  InternalError: 'INTERNAL_ERROR',
  UpstreamError: 'UPSTREAM_ERROR',
  ServiceUnavailable: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const codeByStatus: Record<number, ErrorCode> = {
  400: ErrorCode.BadRequest,
  401: ErrorCode.Unauthenticated,
  403: ErrorCode.Forbidden,
  404: ErrorCode.NotFound,
  409: ErrorCode.Conflict,
  413: ErrorCode.PayloadTooLarge,
  422: ErrorCode.UnprocessableEntity,
  429: ErrorCode.RateLimited,
  502: ErrorCode.UpstreamError,
  503: ErrorCode.ServiceUnavailable,
};

/** Client-safe default messages; internal error text is never forwarded to clients. */
const messageByCode: Record<ErrorCode, string> = {
  BAD_REQUEST: 'The request is malformed.',
  VALIDATION_FAILED: 'The request contains invalid input.',
  UNAUTHENTICATED: 'Authentication is required.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'The request conflicts with the current state of the resource.',
  PAYLOAD_TOO_LARGE: 'The request payload is too large.',
  UNPROCESSABLE_ENTITY: 'The request could not be processed.',
  RATE_LIMITED: 'Too many requests. Please try again later.',
  INTERNAL_ERROR: 'An unexpected error occurred.',
  UPSTREAM_ERROR: 'An upstream service failed.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable.',
};

export function errorCodeForStatus(status: number): ErrorCode {
  return codeByStatus[status] ?? (status >= 500 ? ErrorCode.InternalError : ErrorCode.BadRequest);
}

export function defaultMessageFor(code: ErrorCode): string {
  return messageByCode[code];
}
