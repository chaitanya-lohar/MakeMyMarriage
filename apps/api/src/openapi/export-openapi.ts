// Writes the OpenAPI contract to disk for the typed frontend client
// (packages/api-client). Runs in NestJS preview mode, so no database or Redis
// connection is opened.
//
// Usage: node dist/openapi/export-openapi.js <output-file>
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from '../app.module.js';
import { API_PREFIX } from '../bootstrap/configure-http-app.js';
import { buildOpenApiDocument } from './openapi.js';

const output = process.argv[2];
if (!output) {
  throw new Error('Usage: export-openapi <output-file>');
}

const app = await NestFactory.create(AppModule, { preview: true, logger: false });
app.setGlobalPrefix(API_PREFIX);
const document = buildOpenApiDocument(app);
writeFileSync(resolve(output), `${JSON.stringify(document, null, 2)}\n`);
await app.close();
