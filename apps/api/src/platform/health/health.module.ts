import { Module } from '@nestjs/common';
import { HealthService } from './health.service.js';

/** Readiness checks for the HTTP API's health controller. */
@Module({
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
