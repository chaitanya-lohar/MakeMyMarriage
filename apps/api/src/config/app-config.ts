import { parseKeyRing, type Env, type KeyRing } from './env.schema.js';

/**
 * Typed, grouped view of the validated environment. Injected by class so consumers
 * never read `process.env` directly.
 */
export class AppConfig {
  readonly nodeEnv: Env['NODE_ENV'];
  readonly appEnv: Env['APP_ENV'];
  readonly http: { readonly port: number };
  readonly mongo: { readonly uri: string; readonly autoIndex: boolean };
  readonly redis: { readonly url: string };
  readonly log: { readonly level: Env['LOG_LEVEL']; readonly pretty: boolean };
  readonly openApi: { readonly docsEnabled: boolean };
  readonly auth: {
    readonly accessTokenSecret: string;
    /** Secure cookies everywhere except plain-HTTP local development and tests. */
    readonly secureCookies: boolean;
  };
  readonly web: { readonly appUrl: string };
  readonly email: {
    readonly transport: Env['EMAIL_TRANSPORT'];
    readonly from: string;
    readonly smtp: { readonly host: string; readonly port: number };
    readonly resendApiKey: string | undefined;
    readonly brevoApiKey: string | undefined;
  };
  /** Encryption keys for the stored invitation-token copy (decision 0018). */
  readonly invitations: { readonly tokenKeys: KeyRing };

  constructor(env: Env) {
    this.nodeEnv = env.NODE_ENV;
    this.appEnv = env.APP_ENV;
    this.http = { port: env.PORT };
    // Migrations and index builds are deployment operations in staging/production (Database
    // Design §30); only local development and tests run them automatically at start-up.
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
    this.auth = {
      accessTokenSecret: env.JWT_ACCESS_SECRET,
      secureCookies: env.APP_ENV === 'staging' || env.APP_ENV === 'production',
    };
    this.web = { appUrl: env.WEB_APP_URL.replace(/\/+$/, '') };
    this.email = {
      transport: env.EMAIL_TRANSPORT,
      from: env.EMAIL_FROM,
      smtp: { host: env.SMTP_HOST, port: env.SMTP_PORT },
      resendApiKey: env.RESEND_API_KEY,
      brevoApiKey: env.BREVO_API_KEY,
    };
    // Validated by the environment schema.
    this.invitations = { tokenKeys: parseKeyRing(env.INVITATION_TOKEN_KEYS) as KeyRing };
  }

  get isProduction(): boolean {
    return this.appEnv === 'production';
  }
}
