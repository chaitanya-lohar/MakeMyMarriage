import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

/**
 * OpenAPI contract generated from controllers and DTOs (API Design §37).
 * Security schemes and tags are added as the Auth and domain modules land.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('MakeMyMarriage API')
    .setDescription('REST API for the MakeMyMarriage wedding planning platform.')
    .setVersion('v1')
    .build();
  return SwaggerModule.createDocument(app, config);
}

/** Interactive docs for local/staging only; controlled by OPENAPI_DOCS_ENABLED. */
export function mountOpenApiDocs(app: INestApplication): void {
  SwaggerModule.setup('api/v1/docs', app, () => buildOpenApiDocument(app), {
    jsonDocumentUrl: 'api/v1/docs/openapi.json',
  });
}
