import { RequestMethod, type INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppConfig } from '../config/app-config.js';
import { mountOpenApiDocs } from '../openapi/openapi.js';

export const API_PREFIX = 'api/v1';

/**
 * HTTP application setup shared by main.ts and the integration tests, so tests
 * exercise exactly the production pipeline.
 *
 * CORS is intentionally not enabled: browsers reach the API same-origin through the
 * Next.js proxy (/api/v1/* → API), per decision A1.
 */
export function configureHttpApp(app: INestApplication): void {
  const config = app.get(AppConfig);

  app.useLogger(app.get(Logger));
  app.use(helmet());
  // Session cookies (decision 0015).
  app.use(cookieParser());
  // Requests arrive through exactly one proxy hop — the web app's /api/v1 rewrite (0001) —
  // so the client IP recorded on sessions comes from its X-Forwarded-For header.
  (app as NestExpressApplication).set('trust proxy', 1);
  app.setGlobalPrefix(API_PREFIX, {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });
  app.enableShutdownHooks();

  if (config.openApi.docsEnabled) {
    mountOpenApiDocs(app);
  }
}
