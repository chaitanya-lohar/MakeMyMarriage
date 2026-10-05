import { z } from 'zod';

/**
 * Environment contract for both the HTTP API and the worker.
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
    WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(3002),

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
