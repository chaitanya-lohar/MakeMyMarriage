import { describe, expect, it } from 'vitest';
import { AppConfig } from './app-config.js';
import { EnvValidationError, parseEnv } from './env.schema.js';

const validEnv = {
  APP_ENV: 'local',
  MONGODB_URI: 'mongodb://localhost:27017/makemymarriage',
  REDIS_URL: 'redis://localhost:6379',
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
    expect(new AppConfig(parseEnv({ ...validEnv, APP_ENV: 'staging' })).mongo.autoIndex).toBe(
      false,
    );
    expect(new AppConfig(parseEnv({ ...validEnv, APP_ENV: 'production' })).mongo.autoIndex).toBe(
      false,
    );
  });

  it('pretty-prints logs only in local development', () => {
    expect(new AppConfig(parseEnv(validEnv)).log.pretty).toBe(true);
    expect(new AppConfig(parseEnv({ ...validEnv, NODE_ENV: 'production' })).log.pretty).toBe(false);
    expect(new AppConfig(parseEnv({ ...validEnv, APP_ENV: 'staging' })).log.pretty).toBe(false);
  });
});
