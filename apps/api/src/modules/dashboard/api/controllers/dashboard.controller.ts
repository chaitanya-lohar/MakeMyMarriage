import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../../common/http/api-envelope.decorator.js';
import { WeddingAccessGuard } from '../../../workspace/index.js';
import { GetDashboardUseCase } from '../../application/use-cases/get-dashboard.use-case.js';
import { DashboardDto } from '../dto/dashboard.dto.js';

/** The wedding dashboard's Phase 4 summaries (API Design §6, decision 0022). */
@ApiTags('Weddings')
@ApiCookieAuth('session')
@UseGuards(WeddingAccessGuard)
@Controller('weddings/:weddingId/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: GetDashboardUseCase) {}

  @Get()
  @ApiOperation({
    summary: 'Upcoming events (at most five), guest totals and RSVP breakdown',
  })
  @ApiEnvelopeResponse(200, DashboardDto)
  @ApiErrorResponses(
    { status: 401, description: 'Not signed in' },
    { status: 404, description: 'WEDDING_NOT_FOUND — missing, or not a member' },
  )
  async get(@Param('weddingId') weddingId: string): Promise<DashboardDto> {
    return DashboardDto.from(await this.dashboard.execute(weddingId));
  }
}
