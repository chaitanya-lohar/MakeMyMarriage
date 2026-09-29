import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const REQUEST_ID_HEADER = 'x-request-id';

// Accept an upstream ID (e.g. from the web proxy) only if it is short and plain,
// so it cannot be used to inject content into logs or responses.
const INBOUND_REQUEST_ID = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Resolves the request ID used in logs, the response envelope and the error contract,
 * and echoes it back in the `x-request-id` response header.
 */
export function resolveRequestId(req: IncomingMessage, res: ServerResponse): string {
  const inbound = req.headers[REQUEST_ID_HEADER];
  const id =
    typeof inbound === 'string' && INBOUND_REQUEST_ID.test(inbound)
      ? inbound
      : `req_${randomUUID().replaceAll('-', '')}`;
  res.setHeader(REQUEST_ID_HEADER, id);
  return id;
}

/** Reads the request ID assigned by resolveRequestId (pino-http stores it on `req.id`). */
export function requestIdOf(req: IncomingMessage): string {
  return typeof req.id === 'string' ? req.id : 'unknown';
}
