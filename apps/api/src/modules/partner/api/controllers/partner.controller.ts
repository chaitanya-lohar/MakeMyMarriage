import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, Public, type RequestAuth } from '../../../../common/auth/request-auth.js';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../../common/http/api-envelope.decorator.js';
import {
  CurrentMembership,
  PermissionAction,
  PermissionModule,
  RequirePermission,
  type Membership,
} from '../../../workspace/index.js';
import { PartnerService } from '../../application/services/partner.service.js';
import { resendsLeft } from '../../domain/rules/partner-rules.js';
import {
  AcceptedPartnerInvitationDto,
  CreatePartnerInvitationDto,
  PartnerInvitationDetailsDto,
  PartnerInvitationDto,
  PartnerStateDto,
} from '../dto/partner.dto.js';

const notFound = { status: 404, description: 'WEDDING_NOT_FOUND or PARTNER_INVITATION_NOT_FOUND' };
const forbidden = { status: 403, description: 'PERMISSION_DENIED — owners only' };
const notLive = {
  status: 409,
  description: 'PARTNER_INVITATION_NOT_PENDING (details.status) or PARTNER_INVITATION_EXPIRED',
};
const rateLimited = { status: 429, description: 'RATE_LIMITED (details.retryAfterSeconds)' };

/**
 * The wedding's partner (API Design §7.2, decision 0038). `PARTNER_SHARING` is owner-only and
 * never grantable, so every route is for owners.
 */
@ApiTags('Partner')
@ApiCookieAuth('session')
@Controller('weddings/:weddingId/partner')
export class PartnerController {
  constructor(private readonly partner: PartnerService) {}

  @Get()
  @RequirePermission(PermissionModule.PartnerSharing, PermissionAction.View)
  @ApiOperation({ summary: 'The other owner, and the pending or just-expired invitation' })
  @ApiEnvelopeResponse(200, PartnerStateDto)
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, forbidden, notFound)
  async state(
    @Param('weddingId') weddingId: string,
    @CurrentMembership() membership: Membership,
  ): Promise<PartnerStateDto> {
    return PartnerStateDto.from(await this.partner.state(weddingId, { membership }));
  }

  @Post('invitations')
  @RequirePermission(PermissionModule.PartnerSharing, PermissionAction.Create)
  @ApiOperation({ summary: 'Invite the partner by email; the link works for 7 days' })
  @ApiEnvelopeResponse(201, PartnerInvitationDto)
  @ApiErrorResponses(
    { status: 400, description: "VALIDATION_FAILED (including the owner's own email)" },
    { status: 401, description: 'Not signed in' },
    forbidden,
    notFound,
    {
      status: 409,
      description: 'PARTNER_ALREADY_CONNECTED or PARTNER_INVITATION_ALREADY_PENDING',
    },
    rateLimited,
  )
  async invite(
    @Param('weddingId') weddingId: string,
    @CurrentMembership() membership: Membership,
    @Body() body: CreatePartnerInvitationDto,
  ): Promise<PartnerInvitationDto> {
    const { connection } = await this.partner.invite(weddingId, { membership }, body.email);
    return PartnerInvitationDto.fromConnection(
      connection,
      resendsLeft(connection.resentAt, new Date()),
    );
  }

  @Post('invitations/:invitationId/resend')
  @RequirePermission(PermissionModule.PartnerSharing, PermissionAction.Edit)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a new link; the old one stops working; 7 days from now' })
  @ApiEnvelopeResponse(200, PartnerInvitationDto)
  @ApiErrorResponses(
    { status: 401, description: 'Not signed in' },
    forbidden,
    notFound,
    notLive,
    rateLimited,
  )
  async resend(
    @Param('weddingId') weddingId: string,
    @Param('invitationId') invitationId: string,
    @CurrentMembership() membership: Membership,
  ): Promise<PartnerInvitationDto> {
    const { connection } = await this.partner.resend(weddingId, { membership }, invitationId);
    return PartnerInvitationDto.fromConnection(
      connection,
      resendsLeft(connection.resentAt, new Date()),
    );
  }

  @Post('invitations/:invitationId/revoke')
  @RequirePermission(PermissionModule.PartnerSharing, PermissionAction.Delete)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel the pending invitation; the link stops working' })
  @ApiEnvelopeResponse(204)
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, forbidden, notFound, notLive)
  async revoke(
    @Param('weddingId') weddingId: string,
    @Param('invitationId') invitationId: string,
    @CurrentMembership() membership: Membership,
  ): Promise<void> {
    await this.partner.revoke(weddingId, { membership }, invitationId);
  }

  @Post('leave')
  @RequirePermission(PermissionModule.PartnerSharing, PermissionAction.Delete)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave the wedding; access ends at once; the other owner remains' })
  @ApiEnvelopeResponse(204)
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, forbidden, notFound, {
    status: 409,
    description: 'PARTNER_NOT_CONNECTED — the only owner cannot leave',
  })
  async leave(
    @Param('weddingId') weddingId: string,
    @CurrentMembership() membership: Membership,
  ): Promise<void> {
    await this.partner.leave(weddingId, { membership });
  }
}

/**
 * The invitee's side, through the emailed token (API Design §7.2). Viewing and declining need
 * only the token; accepting needs the signed-in account with the invited email (D4).
 */
@ApiTags('Partner invitation')
@Controller('partner-invitations/:token')
export class PartnerInvitationResponseController {
  constructor(private readonly partner: PartnerService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'The invitation behind a token, with its status' })
  @ApiEnvelopeResponse(200, PartnerInvitationDetailsDto)
  @ApiErrorResponses({ status: 404, description: 'PARTNER_INVITATION_NOT_FOUND' }, rateLimited)
  details(@Param('token') token: string, @Ip() ip: string): Promise<PartnerInvitationDetailsDto> {
    return this.partner.details(token, ip);
  }

  @Post('accept')
  @ApiCookieAuth('session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept as the signed-in user; become the second owner' })
  @ApiEnvelopeResponse(200, AcceptedPartnerInvitationDto)
  @ApiErrorResponses(
    { status: 401, description: 'Not signed in' },
    { status: 403, description: 'PARTNER_INVITATION_EMAIL_MISMATCH' },
    { status: 404, description: 'PARTNER_INVITATION_NOT_FOUND' },
    {
      status: 409,
      description:
        'PARTNER_INVITATION_EXPIRED, PARTNER_INVITATION_NOT_PENDING, PARTNER_INVITEE_OWNS_WEDDING, PARTNER_SEAT_UNAVAILABLE or PARTNER_ALREADY_CONNECTED',
    },
    rateLimited,
  )
  accept(
    @Param('token') token: string,
    @Ip() ip: string,
    @CurrentAuth() auth: RequestAuth,
  ): Promise<AcceptedPartnerInvitationDto> {
    return this.partner.accept(token, ip, auth.userId);
  }

  @Post('decline')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Decline with the token alone' })
  @ApiEnvelopeResponse(204)
  @ApiErrorResponses(
    { status: 404, description: 'PARTNER_INVITATION_NOT_FOUND' },
    { status: 409, description: 'PARTNER_INVITATION_EXPIRED or PARTNER_INVITATION_NOT_PENDING' },
    rateLimited,
  )
  async decline(@Param('token') token: string, @Ip() ip: string): Promise<void> {
    await this.partner.decline(token, ip);
  }
}
