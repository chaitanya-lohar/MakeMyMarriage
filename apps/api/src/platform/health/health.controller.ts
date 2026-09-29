import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { SkipEnvelope } from '../../common/http/skip-envelope.decorator.js';
import { HealthService, type ReadinessReport } from './health.service.js';

/**
 * Infrastructure probes (API Design §29). Served outside /api/v1 and excluded from
 * the public OpenAPI contract; the web proxy does not forward them.
 */
@ApiExcludeController()
@SkipEnvelope()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<ReadinessReport> {
    const report = await this.health.readiness();
    if (report.status !== 'ok') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return report;
  }
}
