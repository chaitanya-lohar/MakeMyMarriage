import { describe, expect, it } from 'vitest';
import { AppConfig } from '../../../config/app-config.js';
import { parseEnv } from '../../../config/env.schema.js';
import {
  isRememberedSession,
  SessionPolicy,
  sessionLifetimeMs,
} from '../domain/rules/auth-policy.js';
import { passwordResetEmail } from './emails/password-reset.email.js';
import { TokenService } from './services/token.service.js';

const config = new AppConfig(
  parseEnv({
    APP_ENV: 'test',
    MONGODB_URI: 'mongodb://localhost:27017/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'unit-test-secret-that-is-at-least-32-characters',
  }),
);

describe('session policy', () => {
  it('lasts 30 days when remembered and 24 hours otherwise', () => {
    expect(sessionLifetimeMs(true)).toBe(30 * 24 * 60 * 60 * 1000);
    expect(sessionLifetimeMs(false)).toBe(24 * 60 * 60 * 1000);
  });

  it('recognises a remembered session from its lifetime', () => {
    const createdAt = new Date('2026-10-01T00:00:00Z');
    const remembered = new Date(createdAt.getTime() + sessionLifetimeMs(true));
    const browser = new Date(createdAt.getTime() + SessionPolicy.browserSessionMs);
    expect(isRememberedSession({ createdAt, expiresAt: remembered })).toBe(true);
    expect(isRememberedSession({ createdAt, expiresAt: browser })).toBe(false);
  });
});

describe('TokenService', () => {
  const tokens = new TokenService(config);

  it('round-trips access-token claims and rejects tampering', async () => {
    const token = await tokens.createAccessToken({ userId: 'u1', sessionId: 's1' });
    expect(await tokens.verifyAccessToken(token)).toEqual({ userId: 'u1', sessionId: 's1' });

    const [header, payload, signature = ''] = token.split('.');
    const tampered = `${header}.${payload}.${signature.slice(0, -2)}xx`;
    expect(await tokens.verifyAccessToken(tampered)).toBeNull();
  });

  it('rejects tokens signed with another secret', async () => {
    const other = new TokenService(
      new AppConfig(
        parseEnv({
          APP_ENV: 'test',
          MONGODB_URI: 'mongodb://localhost:27017/test',
          REDIS_URL: 'redis://localhost:6379',
          JWT_ACCESS_SECRET: 'a-completely-different-secret-of-32-characters',
        }),
      ),
    );
    const token = await other.createAccessToken({ userId: 'u1', sessionId: 's1' });
    expect(await tokens.verifyAccessToken(token)).toBeNull();
  });

  it('composes and parses refresh tokens and compares secrets by hash', () => {
    const secret = tokens.randomSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokens.parseRefreshToken(tokens.composeRefreshToken('abc', secret))).toEqual({
      sessionId: 'abc',
      secret,
    });
    expect(tokens.parseRefreshToken('no-dot')).toBeNull();
    expect(tokens.parseRefreshToken('a.b.c')).toBeNull();
    expect(tokens.matchesHash(secret, tokens.hashSecret(secret))).toBe(true);
    expect(tokens.matchesHash(secret, tokens.hashSecret('other'))).toBe(false);
  });
});

describe('password reset email', () => {
  it('uses the approved subject and wording, with HTML and text versions', () => {
    const message = passwordResetEmail(
      'a@example.com',
      'Priya',
      'http://localhost:3000/reset-password?token=t',
    );
    expect(message.subject).toBe('Reset your MakeMyMarriage password');
    for (const body of [message.text, message.html]) {
      expect(body).toContain('Hi Priya,');
      expect(body).toContain('expires in 60 minutes');
      expect(body).toContain('signs you out on all your devices');
      expect(body).toContain('© 2026 MakeMyMarriage. All rights reserved.');
    }
    expect(message.html).toContain('href="http://localhost:3000/reset-password?token=t"');
  });

  it('escapes the recipient name in HTML', () => {
    const message = passwordResetEmail('a@example.com', '<script>x</script>', 'http://x/reset');
    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&lt;script&gt;');
  });
});
