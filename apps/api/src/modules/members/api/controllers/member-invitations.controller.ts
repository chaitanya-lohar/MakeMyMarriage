import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, Public, type RequestAuth } from '../../../../common/auth/request-auth.js';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
  ApiPaginatedResponse,
} from '../../../../common/http/api-envelope.decorator.js';
import { Paginated } from '../../../../common/http/paginated.js';
import {
  CurrentMembership,
  CurrentPermissions,
  PermissionAction,
  PermissionModule,
  RequirePermission,
  WeddingAccessGuard,
  type EffectivePermissions,
  type Membership,
} from '../../../workspace/index.js';
import { MemberInvitationsService } from '../../application/services/member-invitations.service.js';
import {
  AcceptedMemberInvitationDto,
  CreateMemberInvitationDto,
  ListMemberInvitationsQueryDto,
  MemberInvitationDetailsDto,
  MemberInvitationDto,
  ResentMemberInvitationDto,
  SentMemberInvitationDto,
} from '../dto/invitation.dto.js';

const notFound = {
  status: 404,
  description: 'WEDDING_NOT_FOUND or MEMBER_INVITATION_NOT_FOUND',
};
const conflicts = {
  status: 409,
  description: 'MEMBER_INVITATION_NOT_PENDING (details.status) or MEMBER_INVITATION_EXPIRED',
};
const rateLimited = { status: 429, description: 'RATE_LIMITED (details.retryAfterSeconds)' };

/** Organizer invitations of a wedding (API Design §7.1, 0034 R1, R2, R5). */
@ApiTags('Members')
@ApiCookieAuth('session')
@UseGuards(WeddingAccessGuard)
@Controller('weddings/:weddingId/members/invitations')
export class MemberInvitationsController {
  constructor(private readonly invitations: MemberInvitationsService) {}

  @Post()
  @RequirePermission(PermissionModule.Members, PermissionAction.Invite)
  @ApiOperation({ summary: 'Invite an organizer by email; expires in 7 days' })
  @ApiEnvelopeResponse(201, SentMemberInvitationDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED' },
    { status: 401, description: 'Not signed in' },
    { status: 403, description: 'PERMISSION_DENIED (ADMIN_ROLE_OWNER_ONLY, GRANT_EXCEEDS_CALLER)' },
    notFound,
    { status: 409, description: 'MEMBER_ALREADY_ACTIVE or MEMBER_INVITATION_ALREADY_PENDING' },
    rateLimited,
  )
  async create(
    @Param('weddingId') weddingId: string,
    @CurrentMembership() membership: Membership,
    @CurrentPermissions() permissions: EffectivePermissions,
    @Body() body: CreateMemberInvitationDto,
  ): Promise<SentMemberInvitationDto> {
    const sent = await this.invitations.create(
      weddingId,
      { membership, permissions },
      {
        email: body.email,
        role: body.role,
        permissionOverrides: body.permissionOverrides ?? [],
        message: body.message ?? null,
      },
    );
    return SentMemberInvitationDto.fromSent(sent);
  }

  @Get()
  @RequirePermission(PermissionModule.Members, PermissionAction.View)
  @ApiOperation({ summary: 'Invitations by status (default PENDING), newest first' })
  @ApiPaginatedResponse(MemberInvitationDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED — invalid query or cursor' },
    { status: 401, description: 'Not signed in' },
    { status: 403, description: 'PERMISSION_DENIED' },
    notFound,
  )
  async list(
    @Param('weddingId') weddingId: string,
    @Query() query: ListMemberInvitationsQueryDto,
  ): Promise<Paginated<MemberInvitationDto>> {
    const page = await this.invitations.list(weddingId, query);
    return new Paginated(
      page.invitations.map((invitation) => MemberInvitationDto.from(invitation)),
      page.nextCursor,
    );
  }

  @Post(':invitationId/resend')
  @RequirePermission(PermissionModule.Members, PermissionAction.Invite)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a new link; the old one stops working; expires in 7 days' })
  @ApiEnvelopeResponse(200, ResentMemberInvitationDto)
  @ApiErrorResponses(
    { status: 401, description: 'Not signed in' },
    { status: 403, description: 'PERMISSION_DENIED (ADMIN_ROLE_OWNER_ONLY)' },
    notFound,
    conflicts,
    rateLimited,
  )
  async resend(
    @Param('weddingId') weddingId: string,
    @Param('invitationId') invitationId: string,
    @CurrentMembership() membership: Membership,
    @CurrentPermissions() permissions: EffectivePermissions,
  ): Promise<ResentMemberInvitationDto> {
    const { invitation, emailSent } = await this.invitations.resend(
      weddingId,
      { membership, permissions },
      invitationId,
    );
    return { ...MemberInvitationDto.from(invitation), emailSent };
  }

  @Post(':invitationId/revoke')
  @RequirePermission(PermissionModule.Members, PermissionAction.Invite)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a pending invitation; the link stops working' })
  @ApiEnvelopeResponse(204)
  @ApiErrorResponses(
    { status: 401, description: 'Not signed in' },
    { status: 403, description: 'PERMISSION_DENIED (ADMIN_ROLE_OWNER_ONLY)' },
    notFound,
    conflicts,
  )
  async revoke(
    @Param('weddingId') weddingId: string,
    @Param('invitationId') invitationId: string,
    @CurrentMembership() membership: Membership,
    @CurrentPermissions() permissions: EffectivePermissions,
  ): Promise<void> {
    await this.invitations.revoke(weddingId, { membership, permissions }, invitationId);
  }
}

/**
 * The invitee's side, through the emailed token (API Design §7.1). Viewing and declining
 * need only the token (0034 R6); accepting needs the signed-in account whose email matches
 * (P10-1). Rate-limited per token and per IP.
 */
@ApiTags('Member invitation')
@Controller('member-invitations/:token')
export class MemberInvitationResponseController {
  constructor(private readonly invitations: MemberInvitationsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'The invitation behind a token, with its status' })
  @ApiEnvelopeResponse(200, MemberInvitationDetailsDto)
  @ApiErrorResponses(
    { status: 404, description: 'MEMBER_INVITATION_NOT_FOUND — unknown token' },
    rateLimited,
  )
  details(@Param('token') token: string, @Ip() ip: string): Promise<MemberInvitationDetailsDto> {
    return this.invitations.details(token, ip);
  }

  @Post('accept')
  @ApiCookieAuth('session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept as the signed-in user; no email verification needed' })
  @ApiEnvelopeResponse(200, AcceptedMemberInvitationDto)
  @ApiErrorResponses(
    { status: 401, description: 'Not signed in' },
    { status: 403, description: 'MEMBER_INVITATION_EMAIL_MISMATCH' },
    { status: 404, description: 'MEMBER_INVITATION_NOT_FOUND' },
    {
      status: 409,
      description:
        'MEMBER_INVITATION_EXPIRED, MEMBER_INVITATION_NOT_PENDING or MEMBER_ALREADY_ACTIVE',
    },
    rateLimited,
  )
  accept(
    @Param('token') token: string,
    @Ip() ip: string,
    @CurrentAuth() auth: RequestAuth,
  ): Promise<AcceptedMemberInvitationDto> {
    return this.invitations.accept(token, ip, auth.userId);
  }

  @Post('decline')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Decline with the token alone' })
  @ApiEnvelopeResponse(204)
  @ApiErrorResponses(
    { status: 404, description: 'MEMBER_INVITATION_NOT_FOUND' },
    { status: 409, description: 'MEMBER_INVITATION_EXPIRED or MEMBER_INVITATION_NOT_PENDING' },
    rateLimited,
  )
  async decline(@Param('token') token: string, @Ip() ip: string): Promise<void> {
    await this.invitations.decline(token, ip);
  }
}
