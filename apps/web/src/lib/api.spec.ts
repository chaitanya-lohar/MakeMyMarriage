import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithRefresh } from './api';

const ORIGIN = 'http://localhost:3000';

/** Stubs global fetch with one response per call, recording the paths called. */
function stubFetch(statuses: number[]): string[] {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: Request | string) => {
      calls.push(new URL(typeof input === 'string' ? input : input.url, ORIGIN).pathname);
      return Promise.resolve(new Response(null, { status: statuses[calls.length - 1] ?? 500 }));
    }),
  );
  return calls;
}

const me = () => new Request(`${ORIGIN}/api/v1/me`);

describe('fetchWithRefresh', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes through anything but a 401', async () => {
    const calls = stubFetch([200]);
    expect((await fetchWithRefresh(me())).status).toBe(200);
    expect(calls).toEqual(['/api/v1/me']);
  });

  it('refreshes the session once and retries after a 401', async () => {
    const calls = stubFetch([401, 200, 200]);
    expect((await fetchWithRefresh(me())).status).toBe(200);
    expect(calls).toEqual(['/api/v1/me', '/api/v1/auth/refresh', '/api/v1/me']);
  });

  it('still retries when the refresh fails, in case another tab already refreshed', async () => {
    const calls = stubFetch([401, 401, 200]);
    expect((await fetchWithRefresh(me())).status).toBe(200);
    expect(calls).toEqual(['/api/v1/me', '/api/v1/auth/refresh', '/api/v1/me']);
  });

  it('reports a 401 when the session has really ended', async () => {
    stubFetch([401, 401, 401]);
    expect((await fetchWithRefresh(me())).status).toBe(401);
  });

  it('never retries the auth endpoints', async () => {
    const calls = stubFetch([401]);
    const login = new Request(`${ORIGIN}/api/v1/auth/login`, { method: 'POST' });
    expect((await fetchWithRefresh(login)).status).toBe(401);
    expect(calls).toEqual(['/api/v1/auth/login']);
  });
});
