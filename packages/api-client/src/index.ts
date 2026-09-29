import createClient, { type Client } from 'openapi-fetch';
import type { paths } from './schema.js';

export type { components, paths } from './schema.js';

export interface ApiClientOptions {
  /**
   * Origin the `/api/v1/*` paths are resolved against. Browsers leave this empty so
   * requests stay same-origin and reach the API through the web proxy (decision A1).
   */
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

export type ApiClient = Client<paths>;

/** Creates a client whose routes, parameters and bodies are typed from the OpenAPI contract. */
export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  return createClient<paths>({
    baseUrl: options.baseUrl ?? '',
    // Same-origin cookies only; authentication cookies are never sent cross-site.
    credentials: 'same-origin',
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
}
