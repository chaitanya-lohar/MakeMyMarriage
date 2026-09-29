import { describe, expect, it } from 'vitest';
import { apiRewrites, resolveApiInternalUrl } from './api-proxy';

describe('resolveApiInternalUrl', () => {
  it('defaults to the local API outside production', () => {
    expect(resolveApiInternalUrl({ NODE_ENV: 'development' })).toBe('http://localhost:3001');
  });

  it('requires an explicit URL for production builds', () => {
    expect(() => resolveApiInternalUrl({ NODE_ENV: 'production' })).toThrow(/must be set/);
  });

  it('normalises a configured origin', () => {
    expect(
      resolveApiInternalUrl({ NODE_ENV: 'production', API_INTERNAL_URL: 'https://api.internal/' }),
    ).toBe('https://api.internal');
  });

  it.each(['api.internal', 'ftp://api.internal', 'https://api.internal/api/v1'])(
    'rejects %s',
    (value) => {
      expect(() =>
        resolveApiInternalUrl({ NODE_ENV: 'production', API_INTERNAL_URL: value }),
      ).toThrow();
    },
  );
});

describe('apiRewrites', () => {
  it('forwards only /api/v1/* to the API, preserving the path', () => {
    expect(apiRewrites('http://localhost:3001')).toEqual([
      { source: '/api/v1/:path*', destination: 'http://localhost:3001/api/v1/:path*' },
    ]);
  });
});
