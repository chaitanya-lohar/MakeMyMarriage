import type { Env } from './env.schema.js';

/**
 * Typed, grouped view of the validated environment. Injected by class so consumers
 * never read `process.env` directly.
 */
export class AppConfig {
  readonly nodeEnv: Env['NODE_ENV'];
  readonly appEnv: Env['APP_ENV'];
  readonly http: { readonly port: number };
  readonly worker: { readonly healthPort: number };
  readonly mongo: { readonly uri: string; readonly autoIndex: boolean };
  readonly redis: { readonly url: string };
  readonly log: { readonly level: Env['LOG_LEVEL']; readonly pretty: boolean };
  readonly openApi: { readonly docsEnabled: boolean };

  constructor(env: Env) {
    this.nodeEnv = env.NODE_ENV;
    this.appEnv = env.APP_ENV;
    this.http = { port: env.PORT };
    this.worker = { healthPort: env.WORKER_HEALTH_PORT };
    // Index builds are deployment operations in staging/production (Database Design §30);
    // Mongoose only auto-builds indexes for local development and tests.
    this.mongo = {
      uri: env.MONGODB_URI,
      autoIndex: env.APP_ENV === 'local' || env.APP_ENV === 'test',
    };
    this.redis = { url: env.REDIS_URL };
    // pino-pretty is a dev dependency, so production images (even run locally via
    // docker compose) always log JSON.
    this.log = {
      level: env.LOG_LEVEL,
      pretty: env.APP_ENV === 'local' && env.NODE_ENV === 'development',
    };
    this.openApi = { docsEnabled: env.OPENAPI_DOCS_ENABLED };
  }

  get isProduction(): boolean {
    return this.appEnv === 'production';
  }
}
