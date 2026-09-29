import { z } from 'zod';

/**
 * Environment contract for both the HTTP API and the worker.
 * The process refuses to start when any value is missing or invalid.
 *
 * Variables for integrations (S3, Resend, Google Places, YouTube, auth secrets) are
 * added here by the module that first needs them — never speculatively.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['local', 'test', 'staging', 'production']),

  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(3002),

  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, 'must be a mongodb:// or mongodb+srv:// connection string'),
  REDIS_URL: z.string().regex(/^rediss?:\/\//, 'must be a redis:// or rediss:// URL'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  OPENAPI_DOCS_ENABLED: z.stringbool().default(false),
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
