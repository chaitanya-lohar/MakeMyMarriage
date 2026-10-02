import { Injectable } from '@nestjs/common';
import { jwtVerify, SignJWT } from 'jose';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AppConfig } from '../../../../config/app-config.js';
import { SessionPolicy } from '../../domain/rules/auth-policy.js';

const ISSUER = 'makemymarriage-api';
const AUDIENCE = 'makemymarriage-web';

export interface AccessTokenClaims {
  userId: string;
  sessionId: string;
}

/** Signs and checks the tokens behind the session cookies (decision 0015). */
@Injectable()
export class TokenService {
  private readonly key: Uint8Array;

  constructor(config: AppConfig) {
    this.key = new TextEncoder().encode(config.auth.accessTokenSecret);
  }

  createAccessToken(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({ sid: claims.sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${SessionPolicy.accessTokenTtlSeconds}s`)
      .sign(this.key);
  }

  /** The token's claims, or null if it is invalid, tampered with or expired. */
  async verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;
      return { userId: payload.sub, sessionId: payload.sid };
    } catch {
      return null;
    }
  }

  /** A new random secret (256 bits), URL-safe. */
  randomSecret(): string {
    return randomBytes(32).toString('base64url');
  }

  /** Only hashes of refresh and reset tokens are stored (Database Design §6.2–6.3). */
  hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('base64url');
  }

  /** Refresh tokens are `<sessionId>.<secret>` so the session can be found directly. */
  composeRefreshToken(sessionId: string, secret: string): string {
    return `${sessionId}.${secret}`;
  }

  parseRefreshToken(token: string): { sessionId: string; secret: string } | null {
    const [sessionId, secret, ...rest] = token.split('.');
    if (!sessionId || !secret || rest.length > 0) return null;
    return { sessionId, secret };
  }

  matchesHash(secret: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hashSecret(secret));
    const expected = Buffer.from(expectedHash);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
