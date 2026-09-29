import { Module } from '@nestjs/common';
import { CoreModule } from '../core.module.js';
import { HealthModule } from '../platform/health/health.module.js';
import { SystemProcessor } from './system.processor.js';
import { WorkerHealthServer } from './worker-health.server.js';

/**
 * Root module of the worker runtime. Job processors live here (or in worker-only
 * modules exported by domain modules) so the HTTP API never consumes jobs.
 */
@Module({
  imports: [CoreModule.forRoot('worker'), HealthModule],
  providers: [SystemProcessor, WorkerHealthServer],
})
export class WorkerModule {}
