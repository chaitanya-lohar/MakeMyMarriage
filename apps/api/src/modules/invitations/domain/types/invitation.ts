/**
 * Invitation delivery state (Phase 4 PRD §7.3, decisions 0017 #9–10, 0018 #8, 0020).
 * `DELIVERED` needs provider webhooks and is never set in Phase 4.
 */
export const DeliveryStatus = {
  Draft: 'DRAFT',
  Sent: 'SENT',
  Delivered: 'DELIVERED',
  Failed: 'FAILED',
} as const;

export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const DELIVERY_STATUSES = Object.values(DeliveryStatus);

/** Send attempts are SENT on provider acceptance or FAILED on immediate rejection. */
export const AttemptStatus = {
  Sent: 'SENT',
  Delivered: 'DELIVERED',
  Failed: 'FAILED',
} as const;

export type AttemptStatus = (typeof AttemptStatus)[keyof typeof AttemptStatus];

export const DeliveryKind = { Send: 'SEND', Resend: 'RESEND' } as const;
export type DeliveryKind = (typeof DeliveryKind)[keyof typeof DeliveryKind];

export const ActivityType = { Opened: 'OPENED' } as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

/** A guest's invitation (Database Design §10.3). The token forms never leave the module. */
export interface Invitation {
  id: string;
  weddingId: string;
  guestId: string;
  deliveryStatus: DeliveryStatus;
  /** True after revocation (by the organizer or by deleting the guest) until regenerated. */
  isRevoked: boolean;
  tokenCreatedAt: Date | null;
  lastSentAt: Date | null;
  firstOpenedAt: Date | null;
}

/** The encrypted token copy, for building the link. Absent while revoked. */
export interface InvitationSecret {
  invitation: Invitation;
  tokenCiphertext: string;
  tokenKeyVersion: string;
}

/** One send or resend attempt (Database Design §10.4). */
export interface InvitationDelivery {
  attemptNumber: number;
  kind: DeliveryKind;
  status: AttemptStatus;
  sentAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
}

/** Timestamped activity, such as an open (Database Design §10.5). */
export interface InvitationActivity {
  type: ActivityType;
  occurredAt: Date;
}

/** The outcome of one send attempt, recorded with it (0025). */
export type AttemptOutcome =
  | { status: typeof AttemptStatus.Sent; providerMessageId: string | null }
  | { status: typeof AttemptStatus.Failed; failureReason: string };

/** A token's stored forms. The raw token is never stored or logged (decision 0018). */
export interface StoredToken {
  tokenHash: string;
  tokenCiphertext: string;
  tokenKeyVersion: string;
}
