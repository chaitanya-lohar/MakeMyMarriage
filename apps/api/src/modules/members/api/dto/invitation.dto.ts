import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { trim, trimToNull } from '../../../../common/http/dto-transforms.js';
import { MembershipStatus, type Membership } from '../../../workspace/index.js';
import type {
  InvitationDetails,
  SentInvitation,
} from '../../application/services/member-invitations.service.js';
import type { TransferView } from '../../application/services/ownership-transfers.service.js';
import { MESSAGE_MAX_LENGTH } from '../../domain/rules/invitation-rules.js';
import {
  ASSIGNABLE_ROLES,
  MAX_OVERRIDES,
  type AssignableRole,
} from '../../domain/rules/member-authority.js';
import {
  MemberInvitationStatus,
  type MemberInvitation,
} from '../../domain/types/member-invitation.js';
import { OwnershipTransferStatus } from '../../domain/types/ownership-transfer.js';
import { PermissionOverrideDto } from './member.dto.js';

const STATUSES = Object.values(MemberInvitationStatus);
const MAX_PAGE = 100;
const EMAIL_MAX_LENGTH = 254;

export class CreateMemberInvitationDto {
  @ApiProperty({ example: 'kavita@example.com', maxLength: EMAIL_MAX_LENGTH })
  @Transform(trim)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(EMAIL_MAX_LENGTH, { message: 'Enter a valid email address.' })
  email!: string;

  @ApiProperty({ enum: ASSIGNABLE_ROLES })
  @IsIn(ASSIGNABLE_ROLES, {
    message: 'Choose Admin, Organizer, Editor or Viewer. Owners are made only by transfer.',
  })
  role!: AssignableRole;

  @ApiPropertyOptional({ type: [PermissionOverrideDto], maxItems: MAX_OVERRIDES })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_OVERRIDES)
  @ValidateNested({ each: true })
  @Type(() => PermissionOverrideDto)
  permissionOverrides?: PermissionOverrideDto[];

  @ApiPropertyOptional({ type: String, maxLength: MESSAGE_MAX_LENGTH })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(MESSAGE_MAX_LENGTH, {
    message: `Keep the message to ${MESSAGE_MAX_LENGTH} characters.`,
  })
  message?: string | null;
}

export class ListMemberInvitationsQueryDto {
  @ApiPropertyOptional({ enum: STATUSES, default: MemberInvitationStatus.Pending })
  @IsOptional()
  @IsIn(STATUSES)
  status: MemberInvitationStatus = MemberInvitationStatus.Pending;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE, default: 25 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE)
  limit: number = 25;

  @ApiPropertyOptional({ description: '`meta.pagination.nextCursor` of the previous page.' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

/** An organizer invitation as members with MEMBERS:VIEW see it (API Design §7.1). */
export class MemberInvitationDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: ASSIGNABLE_ROLES }) role!: string;
  @ApiProperty({ enum: STATUSES }) status!: string;
  @ApiProperty() expiresAt!: Date;
  @ApiProperty() invitedBy!: string;
  @ApiProperty({ type: String, nullable: true }) message!: string | null;
  @ApiProperty({ type: [PermissionOverrideDto] }) permissionOverrides!: PermissionOverrideDto[];
  @ApiProperty({ type: Date, nullable: true }) respondedAt!: Date | null;
  @ApiProperty({ type: Date, nullable: true }) lastSentAt!: Date | null;
  @ApiProperty() createdAt!: Date;

  static from(invitation: MemberInvitation, now: Date = new Date()): MemberInvitationDto {
    const expired =
      invitation.status === MemberInvitationStatus.Pending && invitation.expiresAt <= now;
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: expired ? MemberInvitationStatus.Expired : invitation.status,
      expiresAt: invitation.expiresAt,
      invitedBy: invitation.invitedBy,
      message: invitation.message,
      permissionOverrides: invitation.permissionOverrides,
      respondedAt: invitation.respondedAt ?? null,
      lastSentAt: invitation.lastSentAt ?? null,
      createdAt: invitation.createdAt,
    };
  }
}

/** The response to creating an invitation (API Design §7.1). */
export class SentMemberInvitationDto extends MemberInvitationDto {
  @ApiProperty({ description: 'False when the email could not be sent; resend is available.' })
  emailSent!: boolean;

  @ApiProperty({
    enum: [MembershipStatus.Revoked],
    nullable: true,
    description: 'REVOKED when re-inviting a removed member (P10-3).',
  })
  existingMembershipStatus!: string | null;

  static fromSent(sent: SentInvitation): SentMemberInvitationDto {
    return {
      ...MemberInvitationDto.from(sent.invitation),
      emailSent: sent.emailSent,
      existingMembershipStatus: sent.existingMembershipStatus,
    };
  }
}

export class ResentMemberInvitationDto extends MemberInvitationDto {
  @ApiProperty() emailSent!: boolean;
}

/** The public invitation page (API Design §7.1). */
export class MemberInvitationDetailsDto implements InvitationDetails {
  @ApiProperty() weddingDisplayName!: string;
  @ApiProperty() invitedByName!: string;
  @ApiProperty({ enum: ASSIGNABLE_ROLES }) role!: AssignableRole;
  @ApiProperty({ type: String, nullable: true }) message!: string | null;
  @ApiProperty({ enum: STATUSES }) status!: MemberInvitationStatus;
  @ApiProperty() expiresAt!: Date;
  @ApiProperty({ example: 'me***@gmail.com' }) emailHint!: string;
}

export class AcceptedMemberInvitationDto {
  @ApiProperty() weddingId!: string;
  @ApiProperty() membershipId!: string;
  @ApiProperty({ enum: ASSIGNABLE_ROLES }) role!: string;
}

export class CreateOwnershipTransferDto {
  @ApiProperty({ description: 'An ACTIVE non-owner member of this wedding.' })
  @IsString()
  toMembershipId!: string;
}

/** An ownership-seat offer (API Design §7.1). */
export class OwnershipTransferDto {
  @ApiProperty() id!: string;
  @ApiProperty() fromMembershipId!: string;
  @ApiProperty() fromName!: string;
  @ApiProperty() toMembershipId!: string;
  @ApiProperty() toName!: string;
  @ApiProperty({ enum: [1, 2] }) ownerSeat!: number;
  @ApiProperty({ enum: Object.values(OwnershipTransferStatus) }) status!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ type: Date, nullable: true }) respondedAt!: Date | null;

  static from({ transfer, fromName, toName }: TransferView): OwnershipTransferDto {
    return {
      id: transfer.id,
      fromMembershipId: transfer.fromMembershipId,
      fromName,
      toMembershipId: transfer.toMembershipId,
      toName,
      ownerSeat: transfer.ownerSeat,
      status: transfer.status,
      createdAt: transfer.createdAt,
      respondedAt: transfer.respondedAt ?? null,
    };
  }
}

/** A membership after a completed transfer. */
export class TransferredMembershipDto {
  @ApiProperty() membershipId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() role!: string;
  @ApiProperty() isOwner!: boolean;

  static from(membership: Membership): TransferredMembershipDto {
    return {
      membershipId: membership.id,
      userId: membership.userId,
      role: membership.role,
      isOwner: membership.memberType === 'OWNER',
    };
  }
}

export class CompletedOwnershipTransferDto {
  @ApiProperty({ type: TransferredMembershipDto }) giver!: TransferredMembershipDto;
  @ApiProperty({ type: TransferredMembershipDto }) recipient!: TransferredMembershipDto;
}
