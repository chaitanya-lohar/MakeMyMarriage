/**
 * Same-origin API proxy (decision A1): the browser only ever talks to the web origin,
 * and the Next.js server forwards /api/v1/* to the NestJS API. Authentication cookies
 * are therefore first-party and the API needs no CORS configuration.
 *
 * Health probes (/health/*) and anything outside /api/v1 are deliberately not forwarded.
 */
export const API_PATH_PREFIX = '/api/v1';

const LOCAL_API_URL = 'http://localhost:3001';

export interface ApiRewrite {
  source: string;
  destination: string;
}

export function resolveApiInternalUrl(env: NodeJS.ProcessEnv): string {
  const configured = env.API_INTERNAL_URL?.trim();
  if (!configured) {
    if (env.NODE_ENV === 'production') {
      throw new Error('API_INTERNAL_URL must be set for production builds.');
    }
    return LOCAL_API_URL;
  }

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error('API_INTERNAL_URL must be an absolute http(s) URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('API_INTERNAL_URL must be an absolute http(s) URL.');
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('API_INTERNAL_URL must be an origin only, without a path.');
  }
  return url.origin;
}

export function apiRewrites(apiInternalUrl: string): ApiRewrite[] {
  return [
    {
      source: `${API_PATH_PREFIX}/:path*`,
      destination: `${apiInternalUrl}${API_PATH_PREFIX}/:path*`,
    },
  ];
}
