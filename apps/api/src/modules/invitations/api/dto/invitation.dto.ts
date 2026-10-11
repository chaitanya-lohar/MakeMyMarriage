import { ApiProperty } from '@nestjs/swagger';
import {
  ActivityType,
  AttemptStatus,
  DELIVERY_STATUSES,
  DeliveryKind,
  type DeliveryStatus,
  type Invitation,
  type InvitationActivity,
  type InvitationDelivery,
} from '../../domain/types/invitation.js';

const iso = (date: Date | null) => date?.toISOString() ?? null;

/** An invitation as returned to organizers (API Design §10). Never carries the token. */
export class InvitationDto {
  @ApiProperty()
  guestId!: string;

  @ApiProperty({
    enum: DELIVERY_STATUSES,
    description: 'The email delivery state. SENT is the highest status in Phase 4.',
  })
  deliveryStatus!: DeliveryStatus;

  @ApiProperty({ description: 'The link has been revoked and no longer works.' })
  isRevoked!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  tokenCreatedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastSentAt!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Activity only: the link was opened — not proof that the email was delivered.',
  })
  firstOpenedAt!: string | null;

  static from(invitation: Invitation): InvitationDto {
    return {
      guestId: invitation.guestId,
      deliveryStatus: invitation.deliveryStatus,
      isRevoked: invitation.isRevoked,
      tokenCreatedAt: iso(invitation.tokenCreatedAt),
      lastSentAt: iso(invitation.lastSentAt),
      firstOpenedAt: iso(invitation.firstOpenedAt),
    };
  }
}

/** Create and regenerate: the invitation and its new link. */
export class InvitationWithLinkDto extends InvitationDto {
  @ApiProperty({ example: 'https://makemymarriage.com/invite/3q2-…' })
  invitationUrl!: string;

  static withLink(invitation: Invitation, invitationUrl: string): InvitationWithLinkDto {
    return { ...InvitationDto.from(invitation), invitationUrl };
  }
}

export class InvitationLinkDto {
  @ApiProperty({ example: 'https://makemymarriage.com/invite/3q2-…' })
  invitationUrl!: string;
}

export class InvitationDeliveryDto {
  @ApiProperty({ example: 1 })
  attemptNumber!: number;

  @ApiProperty({ enum: Object.values(DeliveryKind) })
  kind!: string;

  @ApiProperty({ enum: Object.values(AttemptStatus) })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  sentAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  failedAt!: string | null;

  @ApiProperty({ type: String, nullable: true, description: "The provider's reason." })
  failureReason!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static from(delivery: InvitationDelivery): InvitationDeliveryDto {
    return {
      attemptNumber: delivery.attemptNumber,
      kind: delivery.kind,
      status: delivery.status,
      sentAt: iso(delivery.sentAt),
      failedAt: iso(delivery.failedAt),
      failureReason: delivery.failureReason,
      createdAt: delivery.createdAt.toISOString(),
    };
  }
}

export class InvitationActivityDto {
  @ApiProperty({ enum: Object.values(ActivityType) })
  type!: string;

  @ApiProperty({ format: 'date-time' })
  occurredAt!: string;

  static from(activity: InvitationActivity): InvitationActivityDto {
    return { type: activity.type, occurredAt: activity.occurredAt.toISOString() };
  }
}

/** GET …/invitation/deliveries: send attempts and activity, oldest first. */
export class InvitationHistoryDto {
  @ApiProperty({ type: [InvitationDeliveryDto] })
  deliveries!: InvitationDeliveryDto[];

  @ApiProperty({ type: [InvitationActivityDto] })
  activities!: InvitationActivityDto[];
}
