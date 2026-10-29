import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../../common/http/api-envelope.decorator.js';
import {
  CurrentMembership,
  CurrentPermissions,
  MembershipOnly,
  WeddingAccessGuard,
  type EffectivePermissions,
  type Membership,
} from '../../../workspace/index.js';
import { OwnershipTransfersService } from '../../application/services/ownership-transfers.service.js';
import {
  CompletedOwnershipTransferDto,
  CreateOwnershipTransferDto,
  OwnershipTransferDto,
  TransferredMembershipDto,
} from '../dto/invitation.dto.js';

const notFound = {
  status: 404,
  description: 'WEDDING_NOT_FOUND, MEMBER_NOT_FOUND or OWNERSHIP_TRANSFER_NOT_FOUND',
};
const notPending = { status: 409, description: 'OWNERSHIP_TRANSFER_NOT_PENDING' };

/**
 * Ownership-seat transfer (API Design §7.1, P10-5). Protected, not a module action: the
 * routes need an active membership, and the service lets only an owner offer, only the
 * recipient accept or decline and only the giver cancel.
 */
@ApiTags('Members')
@ApiCookieAuth('session')
@UseGuards(WeddingAccessGuard)
@Controller('weddings/:weddingId/ownership-transfers')
export class OwnershipTransfersController {
  constructor(private readonly transfers: OwnershipTransfersService) {}

  @Get()
  @MembershipOnly()
  @ApiOperation({ summary: 'Offers: all for owners, those made to the caller for others' })
  @ApiEnvelopeResponse(200, [OwnershipTransferDto])
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, notFound)
  async list(
    @Param('weddingId') weddingId: string,
    @CurrentMembership() membership: Membership,
    @CurrentPermissions() permissions: EffectivePermissions,
  ): Promise<OwnershipTransferDto[]> {
    const views = await this.transfers.list(weddingId, { membership, permissions });
    return views.map((view) => OwnershipTransferDto.from(view));
  }

  @Post()
  @MembershipOnly()
  @ApiOperation({ summary: "Offer the caller's own owner seat to a member" })
  @ApiEnvelopeResponse(201, OwnershipTransferDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED — the target is already an owner' },
    { status: 401, description: 'Not signed in' },
    { status: 403, description: 'PERMISSION_DENIED (OWNER_ONLY)' },
    notFound,
    {
      status: 409,
      description: 'OWNERSHIP_TRANSFER_ALREADY_PENDING or WEDDING_ALREADY_OWNED',
    },
  )
  async offer(
    @Param('weddingId') weddingId: string,
    @CurrentMembership() membership: Membership,
    @CurrentPermissions() permissions: EffectivePermissions,
    @Body() body: CreateOwnershipTransferDto,
  ): Promise<OwnershipTransferDto> {
    return OwnershipTransferDto.from(
      await this.transfers.offer(weddingId, { membership, permissions }, body.toMembershipId),
    );
  }

  @Post(':transferId/accept')
  @MembershipOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'The recipient accepts; the giver becomes an Admin' })
  @ApiEnvelopeResponse(200, CompletedOwnershipTransferDto)
  @ApiErrorResponses(
    { status: 401, description: 'Not signed in' },
    { status: 403, description: 'PERMISSION_DENIED — not the recipient' },
    notFound,
    { status: 409, description: 'OWNERSHIP_TRANSFER_NOT_PENDING or WEDDING_ALREADY_OWNED' },
  )
  async accept(
    @Param('weddingId') weddingId: string,
    @Param('transferId') transferId: string,
    @CurrentMembership() membership: Membership,
    @CurrentPermissions() permissions: EffectivePermissions,
  ): Promise<CompletedOwnershipTransferDto> {
    const { giver, recipient } = await this.transfers.accept(
      weddingId,
      { membership, permissions },
      transferId,
    );
    return {
      giver: TransferredMembershipDto.from(giver),
      recipient: TransferredMembershipDto.from(recipient),
    };
  }

  @Post(':transferId/decline')
  @MembershipOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'The recipient declines' })
  @ApiEnvelopeResponse(204)
  @ApiErrorResponses(
    { status: 401, description: 'Not signed in' },
    { status: 403, description: 'PERMISSION_DENIED — not the recipient' },
    notFound,
    notPending,
  )
  async decline(
    @Param('weddingId') weddingId: string,
    @Param('transferId') transferId: string,
    @CurrentMembership() membership: Membership,
    @CurrentPermissions() permissions: EffectivePermissions,
  ): Promise<void> {
    await this.transfers.decline(weddingId, { membership, permissions }, transferId);
  }

  @Post(':transferId/cancel')
  @MembershipOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'The giving owner cancels the offer' })
  @ApiEnvelopeResponse(204)
  @ApiErrorResponses(
    { status: 401, description: 'Not signed in' },
    { status: 403, description: 'PERMISSION_DENIED — not the giving owner' },
    notFound,
    notPending,
  )
  async cancel(
    @Param('weddingId') weddingId: string,
    @Param('transferId') transferId: string,
    @CurrentMembership() membership: Membership,
    @CurrentPermissions() permissions: EffectivePermissions,
  ): Promise<void> {
    await this.transfers.cancelByOwner(weddingId, { membership, permissions }, transferId);
  }
}
