import { describe, expect, it } from 'vitest';
import { AppConfig } from '../../../../config/app-config.js';
import { parseEnv } from '../../../../config/env.schema.js';
import { InvitationTokensService } from './invitation-tokens.service.js';

const K1 = Buffer.alloc(32, 1).toString('base64');
const K2 = Buffer.alloc(32, 2).toString('base64');
const GUEST = '6650f0c2a1b2c3d4e5f6071a';

function service(keys: string): InvitationTokensService {
  return new InvitationTokensService(
    new AppConfig(
      parseEnv({
        APP_ENV: 'test',
        MONGODB_URI: 'mongodb://localhost:27017/test',
        REDIS_URL: 'redis://localhost:6379',
        JWT_ACCESS_SECRET: 'unit-test-secret-at-least-32-characters-long',
        INVITATION_TOKEN_KEYS: keys,
      }),
    ),
  );
}

describe('InvitationTokensService', () => {
  const tokens = service(`v1:${K1}`);

  it('issues a 256-bit URL-safe token stored only as a hash and a ciphertext', () => {
    const { token, stored } = tokens.issue(GUEST);
    expect(tokens.isWellFormed(token)).toBe(true);
    expect(stored.tokenHash).toBe(tokens.hash(token));
    expect(stored.tokenKeyVersion).toBe('v1');
    expect(stored.tokenHash).not.toContain(token);
    expect(stored.tokenCiphertext).not.toContain(token);
    expect(tokens.decrypt(stored.tokenCiphertext, 'v1', GUEST)).toBe(token);
  });

  it('issues a different token every time', () => {
    const first = tokens.issue(GUEST);
    const second = tokens.issue(GUEST);
    expect(first.token).not.toBe(second.token);
    expect(first.stored.tokenCiphertext).not.toBe(second.stored.tokenCiphertext);
  });

  it('refuses a ciphertext that was tampered with or moved to another guest', () => {
    const { stored } = tokens.issue(GUEST);
    const [iv, body, tag] = stored.tokenCiphertext.split('.') as [string, string, string];
    const flipped = `${iv}.${body.startsWith('A') ? 'B' : 'A'}${body.slice(1)}.${tag}`;
    expect(tokens.decrypt(flipped, 'v1', GUEST)).toBeNull();
    expect(tokens.decrypt(stored.tokenCiphertext, 'v1', '6650f0c2a1b2c3d4e5f6071b')).toBeNull();
    expect(tokens.decrypt('garbage', 'v1', GUEST)).toBeNull();
    expect(tokens.decrypt(stored.tokenCiphertext, 'v9', GUEST)).toBeNull();
  });

  it('decrypts with an older key after rotation and encrypts with the new one', () => {
    const { token, stored } = tokens.issue(GUEST);
    const rotated = service(`v2:${K2},v1:${K1}`);
    expect(rotated.decrypt(stored.tokenCiphertext, 'v1', GUEST)).toBe(token);
    expect(rotated.issue(GUEST).stored.tokenKeyVersion).toBe('v2');
  });

  it('accepts only token-shaped path segments', () => {
    expect(tokens.isWellFormed('a'.repeat(43))).toBe(true);
    for (const value of ['', 'a'.repeat(42), 'a'.repeat(44), `${'a'.repeat(42)}=`, '../etc']) {
      expect(tokens.isWellFormed(value)).toBe(false);
    }
  });
});
