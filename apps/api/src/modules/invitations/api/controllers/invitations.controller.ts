import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type RequestAuth } from '../../../../common/auth/request-auth.js';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../../common/http/api-envelope.decorator.js';
import { WeddingAccessGuard } from '../../../workspace/index.js';
import { ManageInvitationUseCase } from '../../application/use-cases/manage-invitation.use-case.js';
import { DeliveryKind } from '../../domain/types/invitation.js';
import {
  InvitationActivityDto,
  InvitationDeliveryDto,
  InvitationDto,
  InvitationHistoryDto,
  InvitationLinkDto,
  InvitationWithLinkDto,
} from '../dto/invitation.dto.js';

const signedOut = { status: 401, description: 'Not signed in' };
const notFound = {
  status: 404,
  description: 'WEDDING_NOT_FOUND, GUEST_NOT_FOUND or INVITATION_NOT_FOUND (not created yet)',
};
const revoked = { status: 409, description: 'INVITATION_REVOKED — regenerate the link first' };
const idempotencyKey = {
  name: 'Idempotency-Key',
  required: false,
  description: 'The same key queues the email at most once.',
};

/**
 * A guest's invitation, managed from the guest detail screen (API Design §10, decisions
 * 0017–0020). Token management is separate from sending email.
 */
@ApiTags('Invitations')
@ApiCookieAuth('session')
@UseGuards(WeddingAccessGuard)
@Controller('weddings/:weddingId/guests/:guestId/invitation')
export class InvitationsController {
  constructor(private readonly invitations: ManageInvitationUseCase) {}

  @Post()
  @ApiOperation({ summary: 'Create the invitation and its first link' })
  @ApiEnvelopeResponse(201, InvitationWithLinkDto)
  @ApiErrorResponses(signedOut, notFound, {
    status: 409,
    description: 'INVITATION_ALREADY_EXISTS',
  })
  async create(
    @Param('weddingId') weddingId: string,
    @Param('guestId') guestId: string,
    @CurrentAuth() auth: RequestAuth,
  ): Promise<InvitationWithLinkDto> {
    const { invitation, invitationUrl } = await this.invitations.create(
      weddingId,
      guestId,
      auth.userId,
    );
    return InvitationWithLinkDto.withLink(invitation, invitationUrl);
  }

  @Post('regenerate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Replace the link (also when revoked); the old one stops working; status DRAFT',
  })
  @ApiEnvelopeResponse(200, InvitationWithLinkDto)
  @ApiErrorResponses(signedOut, notFound)
  async regenerate(
    @Param('weddingId') weddingId: string,
    @Param('guestId') guestId: string,
    @CurrentAuth() auth: RequestAuth,
  ): Promise<InvitationWithLinkDto> {
    const { invitation, invitationUrl } = await this.invitations.regenerate(
      weddingId,
      guestId,
      auth.userId,
    );
    return InvitationWithLinkDto.withLink(invitation, invitationUrl);
  }

  @Post('send')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiHeader(idempotencyKey)
  @ApiOperation({ summary: 'Queue the invitation email' })
  @ApiEnvelopeResponse(202, InvitationDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED — invalid Idempotency-Key' },
    signedOut,
    notFound,
    revoked,
    { status: 422, description: 'GUEST_EMAIL_REQUIRED' },
  )
  async send(
    @Param('weddingId') weddingId: string,
    @Param('guestId') guestId: string,
    @Headers('idempotency-key') key: string | undefined,
  ): Promise<InvitationDto> {
    return InvitationDto.from(
      await this.invitations.queueEmail(weddingId, guestId, DeliveryKind.Send, key),
    );
  }

  @Post('resend')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiHeader(idempotencyKey)
  @ApiOperation({ summary: 'Queue the invitation email again, with the same link' })
  @ApiEnvelopeResponse(202, InvitationDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED — invalid Idempotency-Key' },
    signedOut,
    notFound,
    revoked,
    { status: 422, description: 'GUEST_EMAIL_REQUIRED' },
  )
  async resend(
    @Param('weddingId') weddingId: string,
    @Param('guestId') guestId: string,
    @Headers('idempotency-key') key: string | undefined,
  ): Promise<InvitationDto> {
    return InvitationDto.from(
      await this.invitations.queueEmail(weddingId, guestId, DeliveryKind.Resend, key),
    );
  }

  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the link; no new link is created; email status unchanged' })
  @ApiEnvelopeResponse(200, InvitationDto)
  @ApiErrorResponses(signedOut, notFound)
  async revoke(
    @Param('weddingId') weddingId: string,
    @Param('guestId') guestId: string,
    @CurrentAuth() auth: RequestAuth,
  ): Promise<InvitationDto> {
    return InvitationDto.from(await this.invitations.revoke(weddingId, guestId, auth.userId));
  }

  @Get('link')
  @ApiOperation({ summary: 'The current link, for Copy Link and WhatsApp (audited)' })
  @ApiEnvelopeResponse(200, InvitationLinkDto)
  @ApiErrorResponses(signedOut, notFound, revoked)
  async link(
    @Param('weddingId') weddingId: string,
    @Param('guestId') guestId: string,
    @CurrentAuth() auth: RequestAuth,
  ): Promise<InvitationLinkDto> {
    return { invitationUrl: await this.invitations.link(weddingId, guestId, auth.userId) };
  }

  @Get('deliveries')
  @ApiOperation({ summary: 'Email attempts and activity (opens), oldest first' })
  @ApiEnvelopeResponse(200, InvitationHistoryDto)
  @ApiErrorResponses(signedOut, notFound)
  async deliveries(
    @Param('weddingId') weddingId: string,
    @Param('guestId') guestId: string,
  ): Promise<InvitationHistoryDto> {
    const { deliveries, activities } = await this.invitations.history(weddingId, guestId);
    return {
      deliveries: deliveries.map((delivery) => InvitationDeliveryDto.from(delivery)),
      activities: activities.map((activity) => InvitationActivityDto.from(activity)),
    };
  }
}
