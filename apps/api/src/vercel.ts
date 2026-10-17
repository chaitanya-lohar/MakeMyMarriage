import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppModule } from './app.module.js';
import { configureHttpApp } from './bootstrap/configure-http-app.js';

type RequestHandler = (request: IncomingMessage, response: ServerResponse) => void;

let ready: Promise<RequestHandler> | undefined;

async function createHandler(): Promise<RequestHandler> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureHttpApp(app);
  await app.init();
  return app.getHttpAdapter().getInstance() as RequestHandler;
}

/**
 * Vercel function entry (decision 0025), loaded from the compiled `dist/` by `api/index.js`,
 * so Vercel runs exactly what `tsc` built (with NestJS decorator metadata) instead of compiling
 * the TypeScript itself. One application instance, with its MongoDB and Redis connections,
 * serves every request for as long as Vercel keeps the function warm.
 */
export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  ready ??= createHandler().catch((error: unknown) => {
    // A failed start is retried by the next request instead of being cached.
    ready = undefined;
    throw error;
  });
  (await ready)(request, response);
}
