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

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    // Report variable names and reasons only — never echo values, which may be secrets.
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return result.data;
}
