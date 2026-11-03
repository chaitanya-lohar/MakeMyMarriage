/**
 * Audited actions. Phase 4 audits organizer RSVP resets (0018), invitation token
 * regeneration and revocation, and every invitation link retrieval (0019) — Database
 * Design §22. Later modules add their own actions.
 */
export const AuditAction = {
  RsvpResetToPending: 'RSVP_RESET_TO_PENDING',
  InvitationTokenRegenerated: 'INVITATION_TOKEN_REGENERATED',
  InvitationTokenRevoked: 'INVITATION_TOKEN_REVOKED',
  InvitationLinkRetrieved: 'INVITATION_LINK_RETRIEVED',
  /** Phase 7: other task changes are in the task's own history (decision 0026 #17). */
  TaskDeleted: 'TASK_DELETED',
  /** Phase 8: every expense and payment change is audited; there is no history (0028 #18). */
  ExpenseCreated: 'EXPENSE_CREATED',
  ExpenseUpdated: 'EXPENSE_UPDATED',
  ExpenseDeleted: 'EXPENSE_DELETED',
  ExpenseEventUnlinked: 'EXPENSE_EVENT_UNLINKED',
  ExpensePaymentAdded: 'EXPENSE_PAYMENT_ADDED',
  ExpensePaymentUpdated: 'EXPENSE_PAYMENT_UPDATED',
  /** Keeps the removed payment's details; the entry's time is the removal time. */
  ExpensePaymentRemoved: 'EXPENSE_PAYMENT_REMOVED',
  VendorCreated: 'VENDOR_CREATED',
  VendorUpdated: 'VENDOR_UPDATED',
  VendorDeleted: 'VENDOR_DELETED',
  VendorBookingCreated: 'VENDOR_BOOKING_CREATED',
  VendorBookingUpdated: 'VENDOR_BOOKING_UPDATED',
  VendorBookingStatusChanged: 'VENDOR_BOOKING_STATUS_CHANGED',
  VendorBookingEventUnlinked: 'VENDOR_BOOKING_EVENT_UNLINKED',
  /** Phase 10: membership, invitation and ownership changes (Database Design §22). */
  MemberInvitationCreated: 'MEMBER_INVITATION_CREATED',
  MemberInvitationResent: 'MEMBER_INVITATION_RESENT',
  MemberInvitationAccepted: 'MEMBER_INVITATION_ACCEPTED',
  MemberInvitationDeclined: 'MEMBER_INVITATION_DECLINED',
  MemberInvitationExpired: 'MEMBER_INVITATION_EXPIRED',
  MemberInvitationRevoked: 'MEMBER_INVITATION_REVOKED',
  MemberRoleChanged: 'MEMBER_ROLE_CHANGED',
  MemberPermissionsChanged: 'MEMBER_PERMISSIONS_CHANGED',
  MemberRemoved: 'MEMBER_REMOVED',
  MemberReactivated: 'MEMBER_REACTIVATED',
  OwnershipTransferOffered: 'OWNERSHIP_TRANSFER_OFFERED',
  OwnershipTransferDeclined: 'OWNERSHIP_TRANSFER_DECLINED',
  OwnershipTransferCancelled: 'OWNERSHIP_TRANSFER_CANCELLED',
  OwnershipTransferred: 'OWNERSHIP_TRANSFERRED',
  /** Phase 16: partner invitation, connection and leaving (Database Design §22, 0038). */
  PartnerInvitationCreated: 'PARTNER_INVITATION_CREATED',
  PartnerInvitationResent: 'PARTNER_INVITATION_RESENT',
  PartnerInvitationRevoked: 'PARTNER_INVITATION_REVOKED',
  PartnerInvitationAccepted: 'PARTNER_INVITATION_ACCEPTED',
  PartnerInvitationDeclined: 'PARTNER_INVITATION_DECLINED',
  PartnerInvitationExpired: 'PARTNER_INVITATION_EXPIRED',
  PartnerConnected: 'PARTNER_CONNECTED',
  PartnerDisconnected: 'PARTNER_DISCONNECTED',
  MemberPromotedToOwner: 'MEMBER_PROMOTED_TO_OWNER',
  /** A refused management action (§8.3); never written for ordinary 404s. */
  PermissionDenied: 'PERMISSION_DENIED',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

/** One audit entry (Database Design §22). Metadata never holds secrets or tokens. */
export interface AuditEntry {
  weddingId?: string;
  actorUserId?: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

/** Filters of the audit history view (API Design §7.1); `from` and `to` are instants. */
export interface AuditListQuery {
  action?: AuditAction;
  resourceType?: string;
  actorUserId?: string;
  from?: Date;
  /** Exclusive. */
  to?: Date;
  limit: number;
  cursor?: string;
}

export interface AuditPage {
  records: AuditRecord[];
  nextCursor: string | null;
}

export interface AuditRecord extends AuditEntry {
  id: string;
  createdAt: Date;
}
