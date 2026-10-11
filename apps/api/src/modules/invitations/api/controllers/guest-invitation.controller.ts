import { Body, Controller, Get, Ip, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../common/auth/request-auth.js';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../../common/http/api-envelope.decorator.js';
import { GuestInvitationAccessUseCase } from '../../application/use-cases/guest-invitation-access.use-case.js';
import { GuestInvitationViewDto, GuestRsvpDto } from '../dto/guest-invitation.dto.js';

const invalidLink = {
  status: 404,
  description: 'INVITATION_NOT_FOUND — unknown, revoked or replaced link, or a deleted guest',
};
const rateLimited = { status: 429, description: 'RATE_LIMITED — per link and per IP' };

/** The guest's invitation, opened without an account (API Design §10, decision 0017). */
@ApiTags('Guest invitation')
@Public()
@Controller('guest/invitations/:token')
export class GuestInvitationController {
  constructor(private readonly access: GuestInvitationAccessUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Open the invitation: the guest’s own events and RSVPs' })
  @ApiEnvelopeResponse(200, GuestInvitationViewDto)
  @ApiErrorResponses(invalidLink, rateLimited)
  async open(@Param('token') token: string, @Ip() ip: string): Promise<GuestInvitationViewDto> {
    return GuestInvitationViewDto.from(await this.access.open(token, ip));
  }

  @Patch('rsvp')
  @ApiOperation({ summary: 'Submit or update RSVPs — all apply, or none' })
  @ApiEnvelopeResponse(200, GuestInvitationViewDto)
  @ApiErrorResponses({ status: 400, description: 'VALIDATION_FAILED' }, invalidLink, rateLimited)
  async respond(
    @Param('token') token: string,
    @Ip() ip: string,
    @Body() body: GuestRsvpDto,
  ): Promise<GuestInvitationViewDto> {
    const view = await this.access.respond(
      token,
      ip,
      body.responses.map((response) => ({
        guestEventId: response.guestEventId,
        rsvpStatus: response.rsvpStatus,
        attendeeCount: response.attendeeCount,
      })),
    );
    return GuestInvitationViewDto.from(view);
  }
}
