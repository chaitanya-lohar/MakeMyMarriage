import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from './worker/worker.module.js';

// Background runtime: same codebase and image as the HTTP API, different entry point
// (decision A2). Runs continuously in its own container — never as a Vercel function.
const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
app.enableShutdownHooks();
