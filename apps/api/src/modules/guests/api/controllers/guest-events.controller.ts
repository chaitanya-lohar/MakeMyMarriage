import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type RequestAuth } from '../../../../common/auth/request-auth.js';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../../common/http/api-envelope.decorator.js';
import { WeddingAccessGuard } from '../../../workspace/index.js';
import { GuestAssignmentsUseCase } from '../../application/use-cases/guest-assignments.use-case.js';
import { UpdateRsvpUseCase } from '../../application/use-cases/update-rsvp.use-case.js';
import { GuestEventDto, UpdateRsvpDto } from '../dto/guest-event.dto.js';

const notFound = {
  status: 404,
  description: 'WEDDING_NOT_FOUND or GUEST_EVENT_NOT_FOUND — missing, removed or not a member',
};

/** Organizer RSVP updates and assignment removal (API Design §9). */
@ApiTags('Guests')
@ApiCookieAuth('session')
@UseGuards(WeddingAccessGuard)
@Controller('weddings/:weddingId/guest-events')
export class GuestEventsController {
  constructor(
    private readonly updateRsvp: UpdateRsvpUseCase,
    private readonly assignments: GuestAssignmentsUseCase,
  ) {}

  @Patch(':guestEventId')
  @ApiOperation({
    summary: 'Organizer RSVP update; any of the four combinations, including a reset to PENDING',
  })
  @ApiEnvelopeResponse(200, GuestEventDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED — status and count do not match' },
    { status: 401, description: 'Not signed in' },
    notFound,
  )
  async update(
    @Param('weddingId') weddingId: string,
    @Param('guestEventId') guestEventId: string,
    @CurrentAuth() auth: RequestAuth,
    @Body() body: UpdateRsvpDto,
  ): Promise<GuestEventDto> {
    const assignment = await this.updateRsvp.execute(weddingId, guestEventId, auth.userId, {
      rsvpStatus: body.rsvpStatus,
      attendeeCount: body.attendeeCount,
    });
    return GuestEventDto.from(assignment);
  }

  @Delete(':guestEventId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove the assignment; it is kept as history with its RSVP' })
  @ApiEnvelopeResponse(204)
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, notFound)
  async remove(
    @Param('weddingId') weddingId: string,
    @Param('guestEventId') guestEventId: string,
    @CurrentAuth() auth: RequestAuth,
  ): Promise<void> {
    await this.assignments.remove(weddingId, guestEventId, auth.userId);
  }
}
