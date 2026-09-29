import { Module } from '@nestjs/common';
import { HealthService } from './health.service.js';

/** Readiness checks, shared by the HTTP API controller and the worker health server. */
@Module({
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
