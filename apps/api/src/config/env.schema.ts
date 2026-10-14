import { z } from 'zod';

/**
 * Environment contract for the HTTP API (decision 0025: there is no worker).
 * The process refuses to start when any value is missing or invalid.
 *
 * Variables for integrations (S3, Google Places, YouTube, …) are added here by the
 * module that first needs them — never speculatively.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_ENV: z.enum(['local', 'test', 'staging', 'production']),

    PORT: z.coerce.number().int().min(1).max(65535).default(3001),

    MONGODB_URI: z
      .string()
      .regex(/^mongodb(\+srv)?:\/\//, 'must be a mongodb:// or mongodb+srv:// connection string'),
    REDIS_URL: z.string().regex(/^rediss?:\/\//, 'must be a redis:// or rediss:// URL'),

    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    OPENAPI_DOCS_ENABLED: z.stringbool().default(false),

    // Auth (decision 0015). Signs access tokens; generate with `openssl rand -base64 48`.
    JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
    // Public web origin used in links sent by email, e.g. password reset.
    WEB_APP_URL: z.url({ protocol: /^https?$/ }).default('http://localhost:3000'),

    // Email. `smtp` targets the local Mailpit inbox; `resend` sends real email.
    EMAIL_TRANSPORT: z.enum(['smtp', 'resend']).default('smtp'),
    EMAIL_FROM: z.string().min(3).default('MakeMyMarriage <no-reply@makemymarriage.com>'),
    SMTP_HOST: z.string().min(1).default('localhost'),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
    RESEND_API_KEY: z.string().min(1).optional(),

    // Invitation-token encryption keys (decision 0018), current key first, older keys after
    // it for rotation: `v2:<base64 key>,v1:<base64 key>`. Each key is 32 random bytes:
    //   openssl rand -base64 32
    INVITATION_TOKEN_KEYS: z.string().refine((value) => parseKeyRing(value) !== null, {
      message: 'must be comma-separated <version>:<base64 32-byte key> entries',
    }),
  })
  .superRefine((env, ctx) => {
    if (env.EMAIL_TRANSPORT === 'resend' && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['RESEND_API_KEY'],
        message: 'is required when EMAIL_TRANSPORT is resend',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** A versioned encryption key ring; the first entry is the current key. */
export interface KeyRing {
  currentVersion: string;
  keys: ReadonlyMap<string, Buffer>;
}

/** Parses `v2:<base64>,v1:<base64>`; null when an entry is malformed, repeated or not 32 bytes. */
export function parseKeyRing(value: string): KeyRing | null {
  const keys = new Map<string, Buffer>();
  for (const entry of value.split(',')) {
    const match = /^([A-Za-z0-9_-]{1,16}):([A-Za-z0-9+/_-]+={0,2})$/.exec(entry.trim());
    if (!match) return null;
    const [, version, encoded] = match as unknown as [string, string, string];
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32 || keys.has(version)) return null;
    keys.set(version, key);
  }
  const currentVersion = keys.keys().next().value;
  return currentVersion === undefined ? null : { currentVersion, keys };
}

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment configuration:\n  - ${issues.join('\n  - ')}`);
    this.name = 'EnvValidationError';
  }
}

/**
 * Variables whose defaults only suit local development. Staging and production must set
 * them explicitly, so a forgotten value cannot silently send reset links to localhost or
 * email to a local inbox.
 */
const REQUIRED_WHEN_DEPLOYED = ['WEB_APP_URL', 'EMAIL_TRANSPORT'] as const;

function deployedIssues(env: Env, source: NodeJS.ProcessEnv): string[] {
  if (env.APP_ENV !== 'staging' && env.APP_ENV !== 'production') return [];
  const issues = REQUIRED_WHEN_DEPLOYED.filter((name) => !source[name]).map(
    (name) => `${name}: is required in ${env.APP_ENV}`,
  );
  if (source.EMAIL_TRANSPORT === 'smtp' && !source.SMTP_HOST) {
    issues.push(`SMTP_HOST: is required in ${env.APP_ENV} when EMAIL_TRANSPORT is smtp`);
  }
  if (source.WEB_APP_URL && !env.WEB_APP_URL.startsWith('https://')) {
    issues.push(`WEB_APP_URL: must use https in ${env.APP_ENV}`);
  }
  return issues;
}

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    // Report variable names and reasons only — never echo values, which may be secrets.
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  const issues = deployedIssues(result.data, source);
  if (issues.length > 0) throw new EnvValidationError(issues);
  return result.data;
}
