import { describe, expect, it } from 'vitest';
import { AppConfig } from './app-config.js';
import { EnvValidationError, parseEnv } from './env.schema.js';

const validEnv = {
  APP_ENV: 'local',
  MONGODB_URI: 'mongodb://localhost:27017/makemymarriage',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'test-secret-that-is-at-least-32-characters-long',
};

/** The minimum a staging or production deployment must set on top of validEnv. */
const deployedEnv = {
  ...validEnv,
  WEB_APP_URL: 'https://makemymarriage.com',
  EMAIL_TRANSPORT: 'resend',
  RESEND_API_KEY: 're_x',
};

describe('parseEnv', () => {
  it('applies defaults for optional variables', () => {
    const env = parseEnv(validEnv);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3001,
      WORKER_HEALTH_PORT: 3002,
      LOG_LEVEL: 'info',
      OPENAPI_DOCS_ENABLED: false,
    });
  });

  it('coerces numeric and boolean strings', () => {
    const env = parseEnv({ ...validEnv, PORT: '8080', OPENAPI_DOCS_ENABLED: 'true' });
    expect(env.PORT).toBe(8080);
    expect(env.OPENAPI_DOCS_ENABLED).toBe(true);
  });

  it('requires a sufficiently long access-token secret', () => {
    expect(() => parseEnv({ ...validEnv, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('requires a Resend API key only when Resend is the transport', () => {
    expect(parseEnv(validEnv).EMAIL_TRANSPORT).toBe('smtp');
    expect(() => parseEnv({ ...validEnv, EMAIL_TRANSPORT: 'resend' })).toThrow(/RESEND_API_KEY/);
    expect(
      parseEnv({ ...validEnv, EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: 're_x' }).RESEND_API_KEY,
    ).toBe('re_x');
  });

  it('requires the web origin and email transport to be set explicitly when deployed', () => {
    for (const APP_ENV of ['staging', 'production']) {
      let error: unknown;
      try {
        parseEnv({ ...validEnv, APP_ENV });
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as EnvValidationError).issues).toEqual([
        `WEB_APP_URL: is required in ${APP_ENV}`,
        `EMAIL_TRANSPORT: is required in ${APP_ENV}`,
      ]);
      expect(parseEnv({ ...deployedEnv, APP_ENV }).WEB_APP_URL).toBe('https://makemymarriage.com');
    }
  });

  it('requires https and an explicit SMTP host when deployed', () => {
    expect(() =>
      parseEnv({ ...deployedEnv, APP_ENV: 'production', WEB_APP_URL: 'http://example.com' }),
    ).toThrow(/WEB_APP_URL: must use https/);
    expect(() =>
      parseEnv({ ...deployedEnv, APP_ENV: 'production', EMAIL_TRANSPORT: 'smtp' }),
    ).toThrow(/SMTP_HOST/);
    expect(
      parseEnv({
        ...deployedEnv,
        APP_ENV: 'production',
        EMAIL_TRANSPORT: 'smtp',
        SMTP_HOST: 'smtp.example.com',
      }).SMTP_HOST,
    ).toBe('smtp.example.com');
  });

  it('rejects missing required variables', () => {
    expect(() => parseEnv({})).toThrow(EnvValidationError);
  });

  it('rejects malformed connection strings without echoing their values', () => {
    const secret = 'postgres://user:hunter2@db';
    let error: unknown;
    try {
      parseEnv({ ...validEnv, MONGODB_URI: secret });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(EnvValidationError);
    expect((error as EnvValidationError).issues.join(' ')).toContain('MONGODB_URI');
    expect((error as Error).message).not.toContain('hunter2');
  });
});

describe('AppConfig', () => {
  it('auto-builds indexes only for local and test environments', () => {
    expect(new AppConfig(parseEnv(validEnv)).mongo.autoIndex).toBe(true);
    expect(new AppConfig(parseEnv({ ...deployedEnv, APP_ENV: 'staging' })).mongo.autoIndex).toBe(
      false,
    );
    expect(new AppConfig(parseEnv({ ...deployedEnv, APP_ENV: 'production' })).mongo.autoIndex).toBe(
      false,
    );
  });

  it('pretty-prints logs only in local development', () => {
    expect(new AppConfig(parseEnv(validEnv)).log.pretty).toBe(true);
    expect(new AppConfig(parseEnv({ ...validEnv, NODE_ENV: 'production' })).log.pretty).toBe(false);
    expect(new AppConfig(parseEnv({ ...deployedEnv, APP_ENV: 'staging' })).log.pretty).toBe(false);
  });

  it('uses secure cookies only in staging and production', () => {
    expect(new AppConfig(parseEnv(validEnv)).auth.secureCookies).toBe(false);
    expect(new AppConfig(parseEnv({ ...deployedEnv, APP_ENV: 'staging' })).auth.secureCookies).toBe(
      true,
    );
    expect(
      new AppConfig(parseEnv({ ...deployedEnv, APP_ENV: 'production' })).auth.secureCookies,
    ).toBe(true);
  });
});
