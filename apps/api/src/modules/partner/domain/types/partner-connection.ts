/**
 * Partner connection statuses (Database Design §7.3, decision 0038). One record per partner
 * invitation; the same record becomes the connection when it is accepted.
 */
export const PartnerConnectionStatus = {
  Pending: 'PENDING',
  Active: 'ACTIVE',
  Declined: 'DECLINED',
  Revoked: 'REVOKED',
  Expired: 'EXPIRED',
  Disconnected: 'DISCONNECTED',
} as const;
export type PartnerConnectionStatus =
  (typeof PartnerConnectionStatus)[keyof typeof PartnerConnectionStatus];

/** A partner invitation or connection. Never carries the token or its hash. */
export interface PartnerConnection {
  id: string;
  weddingId: string;
  /** As stored; `effectiveStatus` reports a pending one past `expiresAt` as EXPIRED. */
  status: PartnerConnectionStatus;
  inviteeEmail: string;
  expiresAt: Date;
  lastSentAt: Date;
  emailSent: boolean;
  resentAt: Date[];
  inviterUserId: string;
  inviteeUserId?: string;
  membershipId?: string;
  acceptedAt?: Date;
  respondedAt?: Date;
  createdAt: Date;
}

export interface NewPartnerConnection {
  weddingId: string;
  inviteeEmail: string;
  tokenHash: string;
  expiresAt: Date;
  inviterUserId: string;
  now: Date;
}

/** The status to report: a PENDING invitation past `expiresAt` is EXPIRED (0038 D4). */
export function effectiveStatus(
  connection: Pick<PartnerConnection, 'status' | 'expiresAt'>,
  now: Date,
): PartnerConnectionStatus {
  return connection.status === PartnerConnectionStatus.Pending && connection.expiresAt <= now
    ? PartnerConnectionStatus.Expired
    : connection.status;
}

/** The wedding already has a pending or active connection (`one_open_partner_connection`). */
export class PartnerConnectionOpenError extends Error {
  constructor() {
    super('The wedding has an open partner connection');
    this.name = 'PartnerConnectionOpenError';
  }
}
