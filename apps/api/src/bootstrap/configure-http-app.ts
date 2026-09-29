import { RequestMethod, type INestApplication } from '@nestjs/common';
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
