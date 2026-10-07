import { createApiClient, type components } from '@makemymarriage/api-client';

export type ApiUser = components['schemas']['UserDto'];

/** The standard error contract (API Design §21), or a network failure. */
export interface ApiError {
  code: string;
  message: string;
  status: number;
  /** Field name → messages, for VALIDATION_FAILED. */
  fields: Record<string, string[]>;
}

const REFRESH_PATH = '/api/v1/auth/refresh';

// One refresh at a time within this tab: refresh tokens rotate, so parallel refreshes
// would invalidate each other. Other tabs share the cookies but not this lock.
let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch(REFRESH_PATH, { method: 'POST', credentials: 'same-origin' })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/**
 * Same-origin fetch (decision 0001) that, when an access token has expired, refreshes the
 * session once and retries. The retry also happens when this tab's refresh fails: another
 * tab may have rotated the shared refresh token first, leaving fresh cookies behind (the
 * API then answers 401 without clearing them). Auth endpoints are never retried.
 */
export async function fetchWithRefresh(input: Request): Promise<Response> {
  const retry = input.clone();
  const response = await fetch(input);
  const path = new URL(input.url).pathname;
  if (response.status !== 401 || path.startsWith('/api/v1/auth/')) return response;
  await refreshSession();
  return fetch(retry);
}

/** Typed API client for the browser. */
export const api = createApiClient({ fetch: fetchWithRefresh });

/** Normalises an error body from the API (or a failed request) into an ApiError. */
export function toApiError(body: unknown, status: number): ApiError {
  const error = (body as { error?: Partial<components['schemas']['ErrorBodyDto']> } | undefined)
    ?.error;
  const fields = (error?.details as { fields?: Record<string, string[]> } | undefined)?.fields;
  return {
    code: error?.code ?? (status === 0 ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR'),
    message: error?.message ?? 'Something went wrong. Please try again.',
    status,
    fields: fields ?? {},
  };
}

/** The payload inside the standard `{ data, meta }` success envelope (API Design §20). */
type Payload<Body> = Body extends { data: infer Data } ? Data : undefined;

/**
 * Runs a request and unwraps the success envelope. Errors — including network failures,
 * reported with status 0 — come back as an ApiError instead of throwing.
 */
export async function call<Body>(
  request: () => Promise<{ data?: Body; error?: unknown; response: Response }>,
): Promise<{ data: Payload<Body>; error?: undefined } | { data?: undefined; error: ApiError }> {
  try {
    const { data, error, response } = await request();
    if (error !== undefined || !response.ok) return { error: toApiError(error, response.status) };
    return { data: (data as { data?: unknown } | undefined)?.data as Payload<Body> };
  } catch {
    return { error: toApiError(undefined, 0) };
  }
}
