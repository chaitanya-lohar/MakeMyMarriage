import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { AppConfig } from '../../../../config/app-config.js';
import type { StoredToken } from '../../domain/types/invitation.js';

const CIPHER = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Invitation tokens (decision 0018, Phase 4 PRD §7.1):
 * - a 256-bit random value, URL-safe;
 * - stored as a SHA-256 hash, used to look up guest requests (a high-entropy token needs no
 *   salt or slow hash);
 * - and as an AES-256-GCM ciphertext, decrypted by the server only to send the email or
 *   return the link to an organizer. The ciphertext is bound to its guest (additional
 *   authenticated data) and records the key version, so keys can be rotated.
 */
@Injectable()
export class InvitationTokensService {
  constructor(private readonly config: AppConfig) {}

  /** A new token and its stored forms. */
  issue(guestId: string): { token: string; stored: StoredToken } {
    const token = randomBytes(32).toString('base64url');
    return { token, stored: { tokenHash: this.hash(token), ...this.encrypt(token, guestId) } };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('base64url');
  }

  /** The raw token, or null if the key is unknown or the ciphertext was tampered with. */
  decrypt(ciphertext: string, keyVersion: string, guestId: string): string | null {
    const key = this.config.invitations.tokenKeys.keys.get(keyVersion);
    const parts = ciphertext.split('.');
    if (!key || parts.length !== 3) return null;
    const [iv, encrypted, tag] = parts.map((part) => Buffer.from(part, 'base64url')) as [
      Buffer,
      Buffer,
      Buffer,
    ];
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return null;
    try {
      const decipher = createDecipheriv(CIPHER, key, iv);
      decipher.setAAD(Buffer.from(guestId));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
  }

  /** Whether a request path segment could be a token, checked before any lookup. */
  isWellFormed(token: string): boolean {
    return /^[A-Za-z0-9_-]{43}$/.test(token);
  }

  private encrypt(
    token: string,
    guestId: string,
  ): Pick<StoredToken, 'tokenCiphertext' | 'tokenKeyVersion'> {
    const { currentVersion, keys } = this.config.invitations.tokenKeys;
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(CIPHER, keys.get(currentVersion) as Buffer, iv);
    cipher.setAAD(Buffer.from(guestId));
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const parts = [iv, encrypted, cipher.getAuthTag()].map((part) => part.toString('base64url'));
    return { tokenCiphertext: parts.join('.'), tokenKeyVersion: currentVersion };
  }
}
