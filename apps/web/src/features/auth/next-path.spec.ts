import { describe, expect, it } from 'vitest';
import { nextPath } from './next-path';

const TOKEN = 'a'.repeat(43);

describe('nextPath', () => {
  it('returns to a member invitation', () => {
    expect(nextPath(`/member-invite/${TOKEN}`)).toBe(`/member-invite/${TOKEN}`);
  });

  it('returns to a partner invitation', () => {
    expect(nextPath(`/partner-invite/${TOKEN}`)).toBe(`/partner-invite/${TOKEN}`);
  });

  it('goes to the dashboard for anything else', () => {
    for (const value of [
      undefined,
      '',
      '/dashboard',
      'https://evil.example/member-invite/x',
      '//evil.example',
      `/member-invite/${TOKEN}/../../members`,
      ['/member-invite/x'],
      `/partner-invite/${TOKEN}x`,
      `/other-invite/${TOKEN}`,
    ]) {
      expect(nextPath(value)).toBe('/dashboard');
    }
  });
});
