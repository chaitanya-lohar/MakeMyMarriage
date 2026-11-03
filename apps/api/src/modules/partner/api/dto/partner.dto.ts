import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';
import { trim } from '../../../../common/http/dto-transforms.js';
import type {
  PartnerInvitationDetails,
  PartnerInvitationView,
  PartnerState,
  PartnerView,
} from '../../application/services/partner.service.js';
import {
  PartnerConnectionStatus,
  type PartnerConnection,
} from '../../domain/types/partner-connection.js';

const STATUSES = Object.values(PartnerConnectionStatus);
const EMAIL_MAX_LENGTH = 254;

export class CreatePartnerInvitationDto {
  @ApiProperty({ example: 'aarav@example.com', maxLength: EMAIL_MAX_LENGTH })
  @Transform(trim)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(EMAIL_MAX_LENGTH, { message: 'Enter a valid email address.' })
  email!: string;
}

/** A partner invitation as the owners see it (API Design §7.2). */
export class PartnerInvitationDto {
  @ApiProperty() id!: string;
  @ApiProperty() inviteeEmail!: string;
  @ApiProperty({ enum: STATUSES }) status!: string;
  @ApiProperty() expiresAt!: Date;
  @ApiProperty() lastSentAt!: Date;
  @ApiProperty({ description: 'Whether the last email was sent.' }) emailSent!: boolean;
  @ApiProperty({ description: 'Resends left in the rolling 24 hours (at most 3).' })
  resendsLeft!: number;

  static from(view: PartnerInvitationView): PartnerInvitationDto {
    return {
      ...PartnerInvitationDto.fromConnection(view.connection, view.resendsLeft),
      status: view.status,
    };
  }

  static fromConnection(connection: PartnerConnection, resendsLeft: number): PartnerInvitationDto {
    return {
      id: connection.id,
      inviteeEmail: connection.inviteeEmail,
      status: connection.status,
      expiresAt: connection.expiresAt,
      lastSentAt: connection.lastSentAt,
      emailSent: connection.emailSent,
      resendsLeft,
    };
  }
}

/** The wedding's other owner (D3). */
export class PartnerDto {
  @ApiProperty() membershipId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() email!: string;
  @ApiProperty({
    type: Date,
    nullable: true,
    description: 'When the partner invitation was accepted; null for an owner by seat transfer.',
  })
  connectedAt!: Date | null;

  static from(view: PartnerView): PartnerDto {
    return { ...view };
  }
}

export class PartnerStateDto {
  @ApiProperty({ type: PartnerDto, nullable: true }) partner!: PartnerDto | null;
  @ApiProperty({ type: PartnerInvitationDto, nullable: true })
  invitation!: PartnerInvitationDto | null;

  static from(state: PartnerState): PartnerStateDto {
    return {
      partner: state.partner ? PartnerDto.from(state.partner) : null,
      invitation: state.invitation ? PartnerInvitationDto.from(state.invitation) : null,
    };
  }
}

/** The public invitation page (API Design §7.2): nothing else about the wedding. */
export class PartnerInvitationDetailsDto implements PartnerInvitationDetails {
  @ApiProperty() weddingDisplayName!: string;
  @ApiProperty() invitedByName!: string;
  @ApiProperty({ enum: STATUSES }) status!: PartnerConnectionStatus;
  @ApiProperty() expiresAt!: Date;
  @ApiProperty({ example: 'aa***@example.com' }) emailHint!: string;
}

export class AcceptedPartnerInvitationDto {
  @ApiProperty() weddingId!: string;
  @ApiProperty() membershipId!: string;
}
